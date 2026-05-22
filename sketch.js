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
        
        // Scenario A: Strike (First roll knocks down all 10 pins)
        if (fRolls[0] === 10) {
            let bonus1 = rollSequence[rollPtr + 1] !== undefined ? rollSequence[rollPtr + 1] : 0;
            let bonus2 = rollSequence[rollPtr + 2] !== undefined ? rollSequence[rollPtr + 2] : 0;
            total += 10 + bonus1 + bonus2;
            rollPtr += 1; // Strikes only use up 1 roll slot in that frame
        } 
        // Scenario B: Spare (First and second roll combined equal 10 pins)
        else if (fRolls[0] + (fRolls[1] || 0) === 10) {
            let bonus1 = rollSequence[rollPtr + 2] !== undefined ? rollSequence[rollPtr + 2] : 0;
            total += 10 + bonus1;
            rollPtr += 2; // Spares use up 2 roll slots
        } 
        // Scenario C: Open Frame (Fewer than 10 pins knocked down total)
        else {
            total += (fRolls[0] || 0) + (fRolls[1] || 0);
            rollPtr += fRolls.length;
        }
        frames[f].score = total;
    }
    return total;
}

function processTurnScore(knocked) {
    let frames = getPlayerFrames(activePlayer);
    let f = frames[currentFrameIndex];
    
    f.rolls.push(knocked);
    pinsStanding -= knocked;
    
    if (activePlayer === 1) {
        p1TotalScore = calculateBowlingScores(p1Frames);
    } else {
        p2TotalScore = calculateBowlingScores(p2Frames);
    }

    if (currentFrameIndex < 9) {
        let isStrike = (f.rolls[0] === 10);
        let isSecondRoll = (f.rolls.length === 2);
        
        if (isStrike || isSecondRoll) {
            advancePlayerTurn();
        }
    } else { // Handle complex bonus checks for Frame 10
        let rLen = f.rolls.length;
        if (pinsStanding === 0) pinsStanding = 10; 
        
        if (rLen === 2) {
            let earnedBonus = (f.rolls[0] === 10 || f.rolls[0] + f.rolls[1] === 10);
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
    
    if (activePlayer === 1) {
        activePlayer = 2;
        ball.changeAni('p2_roll');
    } else {
        activePlayer = 1;
        ball.changeAni('p1_roll');
        currentFrameIndex++; 
    }
    
    if (currentFrameIndex > 9) {
        gameState = 4; // Game Over
    }
}

function draw7SegmentDigit(digit, x, y, size) {
    let w = size * 0.6;
    let h = size;
    let t = size * 0.1;
    
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
    
    let active = segMap[digit] || [true, true, true, false, true, true, true];
    rectMode(CORNER);
    noStroke();
    
    let litColor = color(255, 0, 0);
    let unlitColor = color(0, 0, 0); // Matte black unlit segments
    
    if (active[0]) fill(litColor); else fill(unlitColor); rect(x + t, y, w - 2*t, t);
    if (active[1]) fill(litColor); else fill(unlitColor); rect(x + w - t, y + t, t, h/2 - t);
    if (active[2]) fill(litColor); else fill(unlitColor); rect(x + w - t, y + h/2, t, h/2 - t);
    if (active[3]) fill(litColor); else fill(unlitColor); rect(x + t, y + h/2 - t/2, w - 2*t, t);
    if (active[4]) fill(litColor); else fill(unlitColor); rect(x, y + h/2, t, h/2 - t);
    if (active[5]) fill(litColor); else fill(unlitColor); rect(x, y + t, t, h/2 - t);
    if (active[6]) fill(litColor); else fill(unlitColor); rect(x + t, y + h - t, w - 2*t, t);
}

function draw7SegmentScore(score, x, y, size) {
    let sString = nf(score, 3); 
    let spacing = size * 0.8;
    for (let i = 0; i < 3; i++) {
        draw7SegmentDigit(parseInt(sString[i]), x + (i * spacing), y, size);
    }
}
q5.update = function () {
    background('black');

    if (!mouseIsPressed) {
        isClickReleased = true;
    }

    // ==========================================
    // STEP 1: BALL SELECTION SCREEN
    // ==========================================
    if (gameState === -2 || gameState === -1) {
        camera.on(); 
        ball.visible = false;
        textSize(20);
        fill('white');
        textAlign(CENTER, CENTER);

        if (gameState === -2) {
            text("PLAYER 1: CLICK TO CHOOSE YOUR BALL", 0, -120);
        } else {
            text("PLAYER 2: CLICK TO CHOOSE YOUR BALL", 0, -120);
        }

        let colWidth = 110;
        let startX = -((BALL_OPTIONS.length - 1) * colWidth) / 2;

        for (let i = 0; i < BALL_OPTIONS.length; i++) {
            let option = BALL_OPTIONS[i];
            let xPos = startX + (i * colWidth);
            let yPos = 0;
            let isClaimedByP1 = (gameState === -1 && option === p1SelectedBall);

            push();
            if (isClaimedByP1) {
                fill(40);
                stroke(100);
                rectMode(CENTER);
                rect(xPos, yPos, 90, 90, 10);
                fill(100);
                textSize(12);
                text("TAKEN", xPos, yPos);
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

                let sheet = ballTextures[option];
                if (sheet) {
                    imageMode(CENTER);
                    image(sheet, xPos, yPos, 54, 54, 0, 0, 32, 32);
                }
            }
            pop();
        }
        return;
    }

    // ==========================================
    // STEP 2: STABLE GAMEPLAY LOOP + UI PANELS
    // ==========================================
    camera.on();
    
    let leftMarginX = -canvas.w / 2 + 30;
    let rightMarginX = canvas.w / 2 - 150;
    let scoreY = -160;

    // --- RENDER PLAYER 1 DISPLAY (LEFT SIDE) ---
    noStroke();
    fill(activePlayer === 1 && gameState !== 4 ? 'yellow' : 140);
    textSize(16);
    textAlign(LEFT);
    text("PLAYER 1", leftMarginX, scoreY - 20);
    draw7SegmentScore(p1TotalScore, leftMarginX, scoreY, 50);

    // Ball Indicators Player 1
    let p1CurrentRolls = p1Frames[currentFrameIndex]?.rolls.length || 0;
    let p1IsActive = (activePlayer === 1 && gameState !== 4);
    
    fill(p1IsActive && p1CurrentRolls === 0 ? color(255, 0, 0) : color(240, 240, 240));
    circle(leftMarginX + 25, scoreY + 70, 14); 
    fill(p1IsActive && p1CurrentRolls === 1 ? color(255, 0, 0) : color(240, 240, 240));
    circle(leftMarginX + 65, scoreY + 70, 14); 

    // --- RENDER PLAYER 2 DISPLAY (RIGHT SIDE) ---
    noStroke();
    fill(activePlayer === 2 && gameState !== 4 ? 'yellow' : 140);
    textSize(16);
    textAlign(LEFT);
    text("PLAYER 2", rightMarginX, scoreY - 20);
    draw7SegmentScore(p2TotalScore, rightMarginX, scoreY, 50);

    // Ball Indicators Player 2
    let p2CurrentRolls = p2Frames[currentFrameIndex]?.rolls.length || 0;
    let p2IsActive = (activePlayer === 2 && gameState !== 4);
    
    fill(p2IsActive && p2CurrentRolls === 0 ? color(255, 0, 0) : color(240, 240, 240));
    circle(rightMarginX + 25, scoreY + 70, 14); 
    fill(p2IsActive && p2CurrentRolls === 1 ? color(255, 0, 0) : color(240, 240, 240));
    circle(rightMarginX + 65, scoreY + 70, 14); 

    // Main Lane Assembly Layout Drawing
    imageMode(CENTER);
    image(alley, 0, 0, canvas.h, canvas.h);

    // Live Game Info Header Bar
    fill('white');
    noStroke();
    textSize(14);
    textAlign(CENTER, TOP);
    if (gameState !== 4) {
        text(`FRAME: ${currentFrameIndex + 1}  |  PINS STANDING: ${pinsStanding}`, 0, -canvas.h/2 + 15);
        textSize(12);
        fill(200);
        text("PRESS SPACEBAR TO LOCK / LAUNCH", 0, canvas.h/2 - 25);
    } else {
        fill('yellow');
        textSize(18);
        text(`GAME OVER! FINAL SCORE P1: ${p1TotalScore} vs P2: ${p2TotalScore}`, 0, -canvas.h/2 + 15);
    }

    if (gameState < 3) {
        ball.vel.x = 0;
        ball.vel.y = 0;
        isFrictionLocked = false;
        if (ball.ani) {
            ball.ani.frame = 0;
        }

        // --- STATE 0: SWINGING ANGLE SELECTOR ---
        if (gameState === 0) {
            let speedMultiplier = 1.0 + 2.2 * abs(cos(angleTimer));
            angleTimer += 0.028 * speedMultiplier;
            let rawAngleSin = sin(angleTimer);
            angle = rawAngleSin * MAX_ANGLE_RAD;

            if (kb.presses('space')) {
                gameState = 1;
            }
        }
        // --- STATE 1: EXPANDING/SHRINKING POWER SELECTOR ---
        else if (gameState === 1) {
            let speedMultiplier = 1.0 + 2.2 * abs(cos(powerTimer));
            powerTimer += 0.034 * speedMultiplier;
            rawPowerSin = sin(powerTimer);
            power = map(rawPowerSin, -1, 1, 5, 9);

            if (kb.presses('space')) {
                gameState = 2;
            }
        }
        // --- STATE 2: LAUNCH CONFIRMATION TRIGGER ---
        else if (gameState === 2) {
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
        let arrowLength = map(rawPowerSin, -1, 1, 2, 15) * 12;
        strokeWeight(4);
        line(0, 0, arrowLength, 0);
        noStroke();
        triangle(arrowLength, -10, arrowLength, 10, arrowLength + 12, 0);
        pop();
    } else if (gameState === 3) {
        let topLimitY = -canvas.h / 2;
        let targetPinY = -425;

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
            let baseFriction = (2.8 / power);
            let smoothHookForce = constrain(baseFriction, 0.05, 0.28);
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
            } else {
                if (launchAngle > 0) {
                    ball.vel.x -= smoothHookForce * 1.3;
                } else if (launchAngle < 0) {
                    ball.vel.x += smoothHookForce * 1.3;
                }
            }
        }

        if (ball.y >= targetPinY) {
            if (ball.x <= -LANE_LIMIT) {
                ball.x = -LANE_LIMIT;
                ball.vel.x = 0;
                if (ball.ani) ball.ani.frame = 0;
            } else if (ball.x >= LANE_LIMIT) {
                ball.x = LANE_LIMIT;
                ball.vel.x = 0;
                if (ball.ani) ball.ani.frame = 0;
            }
        }

        // Handle path exit reset conditions and trigger official rules calculator
        if (ball.y < targetPinY && ball.x >= (LANE_LIMIT - 2)) {
            let knockedDown = Math.floor(random(0, pinsStanding + 1));
            
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
``