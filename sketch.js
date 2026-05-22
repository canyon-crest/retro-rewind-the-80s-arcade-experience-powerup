await Canvas();
noSmooth();

// 1. Spawns the ball at your designated starting position
let ball = new Sprite(0, 170);
let alley = await loadImage('Images/New Piskel.png');

// --- BALL SELECTOR SELECTION SETTING ---
const BALL_OPTIONS = ['cosmic', 'ember', 'galaxy', 'inferno', 'toxic', 'vapor'];
let p1SelectedBall = null;
let p2SelectedBall = null;

// Pre-load raw sprite sheets to extract individual frames for menu UI previewing
let ballTextures = {};
for (let option of BALL_OPTIONS) {
  ballTextures[option] = await loadImage(`Sprites/bowling_ball_${option}_spritesheet.png`);
}

// Track active player rolling turn state
let activePlayer = 1;

// --- ARCADE TIMING CONTROL STATE FLAGS ---
let gameState = -2;
let angleTimer = 0;
let powerTimer = 0;

// Track mouse click state to prevent a single click from skipping through menus
let isClickReleased = true;

// Aiming and physics configuration variables
const MAX_ANGLE_RAD = 0.60;
const SAFE_ANGLE_RAD = 0.35;
const LANE_LIMIT = 200;
let angle = 0;
let power = 6;
let isThrown = false;
let rawPowerSin = 0;
let launchAngle = 0;
let isFrictionLocked = false;

// ==========================================
// OFFICIAL TEN-PIN BOWLING STATE LOGIC
// ==========================================
let p1Frames = Array.from({ length: 10 }, () => ({ rolls: [], score: 0 }));
let p2Frames = Array.from({ length: 10 }, () => ({ rolls: [], score: 0 }));

let p1TotalScore = 0;
let p2TotalScore = 0;

let currentFrameIndex = 0; // 0 to 9 (Frame 1 to 10)
let pinsStanding = 10;

// 10-pin layout for visible lanes
const PIN_LAYOUT = [
  { x: 0, y: -420 }, // apex
  { x: -45, y: -392 }, // row 2
  { x: 45, y: -392 },
  { x: -90, y: -364 }, // row 3
  { x: 0, y: -364 },
  { x: 90, y: -364 },
  { x: -135, y: -336 }, // row 4
  { x: -45, y: -336 },
  { x: 45, y: -336 },
  { x: 135, y: -336 }
];

let pinStanding = Array(10).fill(true);
let pinInstances = [];

// --- BowlingPins API bootstrap (same API as bowling-pins.html) ---
function ensureBowlingPinsAPI() {
  if (window.BowlingPins) {
    return;
  }

  const BP = {
    ANGLE_STEP: 15,
    ANGLE_COUNT: 24,
    FRAME_COUNT: 8,
    FALL_DURATION: 420,
    ANGLES: []
  };

  function renderFrame(angleIndex, frameIndex) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const deg = angleIndex * BP.ANGLE_STEP;
    const rad = (deg - 90) * Math.PI / 180;
    const t = frameIndex / (BP.FRAME_COUNT - 1);

    const baseRadius = 5 - (t * 1.2);
    const headRadius = 3 - (t * 0.5);
    const fallDistance = t * 11;

    const cx = 16;
    const cy = 16;
    const hx = cx + Math.cos(rad) * fallDistance;
    const hy = cy + Math.sin(rad) * fallDistance;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(cx + 1 + t * 3 * Math.cos(rad), cy + 3 + t * 3 * Math.sin(rad), baseRadius + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(hx + 1 + t * 2 * Math.cos(rad), hy + 3 + t * 2 * Math.sin(rad), headRadius + 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius, rad + Math.PI / 2, rad - Math.PI / 2);
    ctx.lineTo(hx + Math.cos(rad - Math.PI / 2) * headRadius, hy + Math.sin(rad - Math.PI / 2) * headRadius);
    ctx.arc(hx, hy, headRadius, rad - Math.PI / 2, rad + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const rx = cx + (hx - cx) * 0.65;
    const ry = cy + (hy - cy) * 0.65;
    ctx.fillStyle = '#d94545';
    ctx.beginPath();
    ctx.arc(rx, ry, headRadius + 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#000000';
    ctx.beginPath();
    ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e6f2ff';
    ctx.beginPath();
    ctx.arc(hx - 0.8, hy - 0.8, headRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  for (let i = 0; i < BP.ANGLE_COUNT; i++) {
    const deg = i * BP.ANGLE_STEP;
    const rad = deg * Math.PI / 180;
    const angleObj = {
      index: i,
      degrees: deg,
      radians: rad,
      direction: {
        x: parseFloat(Math.sin(rad).toFixed(4)),
        y: parseFloat((-Math.cos(rad)).toFixed(4))
      },
      frames: []
    };

    for (let f = 0; f < BP.FRAME_COUNT; f++) {
      angleObj.frames.push(renderFrame(i, f));
    }

    BP.ANGLES.push(angleObj);
  }

  BP.angleFromVector = function (dx, dy) {
    let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    return angle;
  };

  BP.nearestAngleIndex = function (deg) {
    let normalized = ((deg % 360) + 360) % 360;
    let idx = Math.round(normalized / BP.ANGLE_STEP);
    return idx % BP.ANGLE_COUNT;
  };

  BP.getIdleSprite = function () {
    return BP.ANGLES[0].frames[0];
  };

  BP.createPin = function () {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const pin = {
      canvas,
      state: 'idle',
      angleIndex: 0,
      frameIndex: 0,
      startTime: 0,

      knock(dx, dy) {
        if (this.state !== 'idle') return;
        const deg = BP.angleFromVector(dx, dy);
        this.angleIndex = BP.nearestAngleIndex(deg);
        this.state = 'falling';
        this.frameIndex = 0;
        this.startTime = performance.now();
      },

      reset() {
        this.state = 'idle';
        this.angleIndex = 0;
        this.frameIndex = 0;
        this.render();
      },

      update(now) {
        if (this.state !== 'falling') return;
        const elapsed = now - this.startTime;
        const progress = Math.min(elapsed / BP.FALL_DURATION, 1);
        this.frameIndex = Math.floor(progress * (BP.FRAME_COUNT - 1));

        if (progress >= 1) {
          this.state = 'fallen';
          this.frameIndex = BP.FRAME_COUNT - 1;
        }

        this.render();
      },

      render() {
        ctx.clearRect(0, 0, 32, 32);
        ctx.drawImage(BP.ANGLES[this.angleIndex].frames[this.frameIndex], 0, 0);
      }
    };

    pin.render();
    return pin;
  };

  window.BowlingPins = BP;
}

function createPinField() {
  ensureBowlingPinsAPI();

  pinInstances = PIN_LAYOUT.map((pos) => {
    const api = window.BowlingPins.createPin();
    return {
      api,
      x: pos.x,
      y: pos.y,
      standing: true
    };
  });

  pinStanding = Array(10).fill(true);
  pinsStanding = 10;
}

function resetPins() {
  pinStanding = Array(10).fill(true);
  pinsStanding = 10;

  for (let i = 0; i < pinInstances.length; i++) {
    pinInstances[i].standing = true;
    pinInstances[i].api.reset();
  }
}

function knockPins(knocked) {
  const count = Math.max(0, Math.min(10, Math.floor(knocked)));
  if (count === 0) return;

  const eligible = pinInstances.filter((pin) => pin.standing);
  const order = eligible.sort(() => random() - 0.5);

  for (let i = 0; i < count && i < order.length; i++) {
    const pin = order[i];
    pin.standing = false;
    pin.api.knock(pin.x - ball.x, pin.y - ball.y);
  }

  pinsStanding = pinInstances.filter((pin) => pin.standing).length;
  pinStanding = pinInstances.map((pin) => pin.standing);
}

function drawPins() {
  imageMode(CENTER);

  for (let i = 0; i < pinInstances.length; i++) {
    const pin = pinInstances[i];
    pin.api.update(performance.now());
    image(pin.api.canvas, pin.x, pin.y, 64, 64);
  }
}

// Helper to safely fetch frame sequences
function getPlayerFrames(pNum) {
  return pNum === 1 ? p1Frames : p2Frames;
}

// FIXED: Now loops frame-by-frame and applies standard multi-throw look-aheads for strikes/spares
function calculateBowlingScores(frames) {
  let rollSequence = [];
  for (let i = 0; i < frames.length; i++) {
    rollSequence.push(...frames[i].rolls);
  }

  let total = 0;
  let rollPtr = 0;

  for (let f = 0; f < 10; f++) {
    let fRolls = frames[f].rolls;
    if (!fRolls || fRolls.length === 0) break;

    if (fRolls[0] === 10) {
      let bonus1 = rollSequence[rollPtr + 1] !== undefined ? rollSequence[rollPtr + 1] : 0;
      let bonus2 = rollSequence[rollPtr + 2] !== undefined ? rollSequence[rollPtr + 2] : 0;
      total += 10 + bonus1 + bonus2;
      rollPtr += 1;
    } else if (fRolls[0] + (fRolls[1] || 0) === 10) {
      let bonus1 = rollSequence[rollPtr + 2] !== undefined ? rollSequence[rollPtr + 2] : 0;
      total += 10 + bonus1;
      rollPtr += 2;
    } else {
      total += (fRolls[0] || 0) + (fRolls[1] || 0);
      rollPtr += fRolls.length;
    }

    frames[f].score = total;
  }

  return total;
}

function processTurnScore(knocked) {
  const playerWhoRolled = activePlayer;
  const frames = getPlayerFrames(playerWhoRolled);
  const f = frames[currentFrameIndex];

  const pinsHit = Math.max(0, Math.min(pinsStanding, Math.floor(knocked)));
  f.rolls.push(pinsHit);

  if (pinsHit > 0) {
    knockPins(pinsHit);
  }

  if (playerWhoRolled === 1) {
    p1TotalScore = calculateBowlingScores(p1Frames);
  } else {
    p2TotalScore = calculateBowlingScores(p2Frames);
  }

  if (currentFrameIndex < 9) {
    const isStrike = f.rolls[0] === 10;
    const isSecondRoll = f.rolls.length === 2;

    if (isStrike || isSecondRoll) {
      advancePlayerTurn();
    }
  } else {
    const rLen = f.rolls.length;
    if (pinsStanding === 0) {
      pinsStanding = 10;
    }

    if (rLen === 2) {
      const earnedBonus = (f.rolls[0] === 10 || f.rolls[0] + f.rolls[1] === 10);
      if (!earnedBonus) {
        advancePlayerTurn();
      }
    } else if (rLen === 3) {
      advancePlayerTurn();
    }
  }
}

function advancePlayerTurn() {
  pinsStanding = 10;
  resetPins();

  if (activePlayer === 1) {
    activePlayer = 2;
    ball.changeAni('p2_roll');
  } else {
    activePlayer = 1;
    ball.changeAni('p1_roll');
    currentFrameIndex++;
  }

  if (currentFrameIndex > 9) {
    gameState = 4;
  }
}

function draw7SegmentDigit(digit, x, y, size) {
  const w = size * 0.6;
  const h = size;
  const t = size * 0.1;

  const segMap = {
    0: [true, true, true, false, true, true, true],
    1: [false, true, true, false, false, false, false],
    2: [true, true, false, true, true, false, true],
    3: [true, true, true, true, false, false, true],
    4: [false, true, true, true, false, true, false],
    5: [true, false, true, true, false, true, true],
    6: [true, false, true, true, true, true, true],
    7: [true, true, true, false, false, false, false],
    8: [true, true, true, true, true, true, true],
    9: [true, true, true, true, false, true, true]
  };

  const active = segMap[digit] || [true, true, true, false, true, true, true];
  rectMode(CORNER);
  noStroke();

  const litColor = color(255, 0, 0);
  const unlitColor = color(0, 0, 0);

  if (active[0]) fill(litColor); else fill(unlitColor); rect(x + t, y, w - 2 * t, t);
  if (active[1]) fill(litColor); else fill(unlitColor); rect(x + w - t, y + t, t, h / 2 - t);
  if (active[2]) fill(litColor); else fill(unlitColor); rect(x + w - t, y + h / 2, t, h / 2 - t);
  if (active[3]) fill(litColor); else fill(unlitColor); rect(x + t, y + h / 2 - t / 2, w - 2 * t, t);
  if (active[4]) fill(litColor); else fill(unlitColor); rect(x, y + h / 2, t, h / 2 - t);
  if (active[5]) fill(litColor); else fill(unlitColor); rect(x, y + t, t, h / 2 - t);
  if (active[6]) fill(litColor); else fill(unlitColor); rect(x + t, y + h - t, w - 2 * t, t);
}

function draw7SegmentScore(score, x, y, size) {
  const sString = nf(score, 3);
  const spacing = size * 0.8;

  for (let i = 0; i < 3; i++) {
    draw7SegmentDigit(parseInt(sString[i]), x + (i * spacing), y, size);
  }
}

createPinField();

q5.update = function () {
  background('black');

  if (!mouseIsPressed) {
    isClickReleased = true;
  }

  if (gameState === -2 || gameState === -1) {
    camera.on();
    ball.visible = false;
    textSize(20);
    fill('white');
    textAlign(CENTER, CENTER);

    if (gameState === -2) {
      text('PLAYER 1: CLICK TO CHOOSE YOUR BALL', 0, -120);
    } else {
      text('PLAYER 2: CLICK TO CHOOSE YOUR BALL', 0, -120);
    }

    const colWidth = 110;
    const startX = -((BALL_OPTIONS.length - 1) * colWidth) / 2;

    for (let i = 0; i < BALL_OPTIONS.length; i++) {
      const option = BALL_OPTIONS[i];
      const xPos = startX + (i * colWidth);
      const yPos = 0;
      const isClaimedByP1 = (gameState === -1 && option === p1SelectedBall);

      push();
      if (isClaimedByP1) {
        fill(40);
        stroke(100);
        rectMode(CENTER);
        rect(xPos, yPos, 90, 90, 10);
        fill(100);
        textSize(12);
        text('TAKEN', xPos, yPos);
      } else {
        if (mouse.x > xPos - 45 && mouse.x < xPos + 45 && mouse.y > yPos - 45 && mouse.y < yPos + 45) {
          fill(80);
          stroke('yellow');
          strokeWeight(3);

          if (mouseIsPressed && isClickReleased) {
            isClickReleased = false;

            if (gameState === -2) {
              p1SelectedBall = option;
              ball.addAni('p1_roll', `Sprites/bowling_ball_${option}_spritesheet.png`, { width: 32, height: 32, frames: 8 });
              gameState = -1;
            } else {
              p2SelectedBall = option;
              ball.addAni('p2_roll', `Sprites/bowling_ball_${option}_spritesheet.png`, { width: 32, height: 32, frames: 8 });

              ball.changeAni('p1_roll');
              ball.ani.frameDelay = 8;
              ball.visible = true;
              activePlayer = 1;
              resetPins();
              gameState = 0;
            }
          }
        } else {
          fill(30);
          stroke(255);
          strokeWeight(1);
        }

        rectMode(CENTER);
        rect(xPos, yPos, 90, 90, 10);

        fill(255);
        noStroke();
        textSize(12);
        text(option.toUpperCase(), xPos, yPos + 32);

        const sheet = ballTextures[option];
        if (sheet) {
          imageMode(CENTER);
          image(sheet, xPos, yPos, 54, 54, 0, 0, 32, 32);
        }
      }
      pop();
    }

    return;
  }

  camera.on();

  const leftMarginX = -canvas.w / 2 + 30;
  const rightMarginX = canvas.w / 2 - 150;
  const scoreY = -160;

  noStroke();
  fill(activePlayer === 1 && gameState !== 4 ? 'yellow' : 140);
  textSize(16);
  textAlign(LEFT);
  text('PLAYER 1', leftMarginX, scoreY - 20);
  draw7SegmentScore(p1TotalScore, leftMarginX, scoreY, 50);

  const p1CurrentRolls = p1Frames[currentFrameIndex]?.rolls.length || 0;
  const p1IsActive = (activePlayer === 1 && gameState !== 4);

  fill(p1IsActive && p1CurrentRolls === 0 ? color(255, 0, 0) : color(240, 240, 240));
  circle(leftMarginX + 25, scoreY + 70, 14);
  fill(p1IsActive && p1CurrentRolls === 1 ? color(255, 0, 0) : color(240, 240, 240));
  circle(leftMarginX + 65, scoreY + 70, 14);

  noStroke();
  fill(activePlayer === 2 && gameState !== 4 ? 'yellow' : 140);
  textSize(16);
  textAlign(LEFT);
  text('PLAYER 2', rightMarginX, scoreY - 20);
  draw7SegmentScore(p2TotalScore, rightMarginX, scoreY, 50);

  const p2CurrentRolls = p2Frames[currentFrameIndex]?.rolls.length || 0;
  const p2IsActive = (activePlayer === 2 && gameState !== 4);

  fill(p2IsActive && p2CurrentRolls === 0 ? color(255, 0, 0) : color(240, 240, 240));
  circle(rightMarginX + 25, scoreY + 70, 14);
  fill(p2IsActive && p2CurrentRolls === 1 ? color(255, 0, 0) : color(240, 240, 240));
  circle(rightMarginX + 65, scoreY + 70, 14);

  imageMode(CENTER);
  image(alley, 0, 0, canvas.h, canvas.h);
  drawPins();

  fill('white');
  noStroke();
  textSize(14);
  textAlign(CENTER, TOP);

  if (gameState !== 4) {
    text(`FRAME: ${currentFrameIndex + 1}  |  PINS STANDING: ${pinsStanding}`, 0, -canvas.h / 2 + 15);
    textSize(12);
    fill(200);
    text('PRESS SPACEBAR TO LOCK / LAUNCH', 0, canvas.h / 2 - 25);
  } else {
    fill('yellow');
    textSize(18);
    text(`GAME OVER! FINAL SCORE P1: ${p1TotalScore} vs P2: ${p2TotalScore}`, 0, -canvas.h / 2 + 15);
  }

  if (gameState < 3) {
    ball.vel.x = 0;
    ball.vel.y = 0;
    isFrictionLocked = false;

    if (ball.ani) {
      ball.ani.frame = 0;
    }

    if (gameState === 0) {
      const speedMultiplier = 1.0 + 2.2 * abs(cos(angleTimer));
      angleTimer += 0.028 * speedMultiplier;
      const rawAngleSin = sin(angleTimer);
      angle = rawAngleSin * MAX_ANGLE_RAD;

      if (kb.presses('space')) {
        gameState = 1;
      }
    } else if (gameState === 1) {
      const speedMultiplier = 1.0 + 2.2 * abs(cos(powerTimer));
      powerTimer += 0.034 * speedMultiplier;
      rawPowerSin = sin(powerTimer);
      power = map(rawPowerSin, -1, 1, 5, 9);

      if (kb.presses('space')) {
        gameState = 2;
      }
    } else if (gameState === 2) {
      if (kb.presses('space')) {
        isThrown = true;
        gameState = 3;
        launchAngle = angle;
        ball.vel.x = cos(launchAngle - 1.57) * power;
        ball.vel.y = sin(launchAngle - 1.57) * power;
      }
    }

    push();
    angleMode(RADIANS);
    translate(ball.x, ball.y);
    rotate(angle - 1.57);

    if (gameState === 2) {
      stroke(255);
      fill(255);
    } else {
      stroke('red');
      fill('red');
    }

    const arrowLength = map(rawPowerSin, -1, 1, 2, 15) * 12;
    strokeWeight(4);
    line(0, 0, arrowLength, 0);
    noStroke();
    triangle(arrowLength, -10, arrowLength, 10, arrowLength + 12, 0);
    pop();
  } else if (gameState === 3) {
    const topLimitY = -canvas.h / 2;
    const targetPinY = -425;

    if (ball.y < targetPinY) {
      ball.vel.y = ball.vel.y * 0.82;

      if (ball.x < LANE_LIMIT) {
        ball.vel.x = 2.5;
      } else {
        ball.vel.x = 0;
      }

      if (ball.y < topLimitY + 16) {
        ball.y = topLimitY + 16;
      }
    } else if (ball.y < targetPinY * 0.25) {
      const baseFriction = (2.8 / power);
      const smoothHookForce = constrain(baseFriction, 0.05, 0.28);

      if (abs(launchAngle) <= SAFE_ANGLE_RAD) {
        if (!isFrictionLocked) {
          if (ball.x > 8) {
            ball.vel.x -= smoothHookForce * (abs(ball.x) / LANE_LIMIT) * 1.5;
          } else if (ball.x < -8) {
            ball.vel.x += smoothHookForce * (abs(ball.x) / LANE_LIMIT) * 1.5;
          } else {
            isFrictionLocked = true;
          }
        }
      } else if (launchAngle > 0) {
        ball.vel.x -= smoothHookForce * 1.3;
      } else if (launchAngle < 0) {
        ball.vel.x += smoothHookForce * 1.3;
      }
    }

    if (ball.y >= targetPinY) {
      if (ball.x <= -LANE_LIMIT) {
        ball.x = -LANE_LIMIT;
        ball.vel.x = 0;

        if (ball.ani) {
          ball.ani.frame = 0;
        }
      } else if (ball.x >= LANE_LIMIT) {
        ball.x = LANE_LIMIT;
        ball.vel.x = 0;

        if (ball.ani) {
          ball.ani.frame = 0;
        }
      }
    }

    if (ball.y < targetPinY && ball.x >= (LANE_LIMIT - 2)) {
      const knockedDown = Math.floor(random(0, pinsStanding + 1));
      processTurnScore(knockedDown);

      ball.x = 0;
      ball.y = 170;
      ball.vel.x = 0;
      ball.vel.y = 0;
      isThrown = false;

      if (gameState !== 4) {
        gameState = 0;
      }

      angle = 0;
      power = 6;
      rawPowerSin = 0;

      if (ball.ani) {
        ball.ani.frameDelay = 8;
      }
    }
  }

  camera.off();
};