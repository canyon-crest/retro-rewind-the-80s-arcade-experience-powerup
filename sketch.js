await Canvas();
noSmooth();

// 1. Spawns the ball at your designated starting position
let ball = new Sprite(0, 170);
let alley = await loadImage('Images/New Piskel.png');

// Add and slice the spritesheet animation onto the ball
let rolling = ball.addAni('Sprites/bowling_ball_cosmic_spritesheet.png', { width: 32, height: 32, frames: 8 });
rolling.frameDelay = 8;

// --- DYNAMIC GEOMETRIC RULES DESIGNATION ---
const MAX_ANGLE_RAD = 1.0472;  // Strict 60-degree boundary cutoff
const SAFE_ANGLE_RAD = 0.5236; // Strict 30-degree pin target baseline zone

// --- ARCADE TIMING CONTROL STATE FLAGS ---
let gameState = 0;             // 0: Angle Selection, 1: Power Selection, 2: Ready, 3: Thrown
let angleTimer = 0;            // Progression tracker for angle swing
let powerTimer = 0;            // Progression tracker for power scale

// Aiming and physics configuration variables
let angle = 0; // Controls left/right tilt exclusively
let power = 5; // Controls length and forward velocity exclusively
let isThrown = false; // Throw state controller

// Physics variable for launch angle tracking
let launchAngle = 0;
let isFrictionLocked = false; // Tracks if the hook has settled into its straight rolling path

q5.update = function () {
  // Clear canvas view
  background('black');
  imageMode(CENTER);

  // Render background image matching your established configuration rules
  image(alley, 0, 0, canvas.h, canvas.h);

  // Bowling Control Logic Loop
  if (gameState < 3) {
    ball.vel.x = 0;
    ball.vel.y = 0;
    isFrictionLocked = false;

    // --- STATE 0: SWINGING ANGLE SELECTOR ---
    if (gameState === 0) {
      // Core acceleration curve remains, but base step is raised to 0.028 for faster pacing
      let speedMultiplier = 1.0 + 2.2 * abs(cos(angleTimer));
      angleTimer += 0.028 * speedMultiplier;
      
      let rawAngleSin = sin(angleTimer);
      angle = rawAngleSin * MAX_ANGLE_RAD;

      if (kb.presses('space')) {
        gameState = 1; // Lock angle, advance to power meter
      }
    }
    // --- STATE 1: EXPANDING/SHRINKING POWER SELECTOR ---
    else if (gameState === 1) {
      // Core acceleration curve remains, but base step is raised to 0.034 for faster pacing
      let speedMultiplier = 1.0 + 2.2 * abs(cos(powerTimer));
      powerTimer += 0.034 * speedMultiplier;
      
      let rawPowerSin = sin(powerTimer);
      power = map(rawPowerSin, -1, 1, 2, 15);

      if (kb.presses('space')) {
        gameState = 2; // Lock power, ready to launch
      }
    }
    // --- STATE 2: LAUNCH CONFIRMATION CLICK ---
    else if (gameState === 2) {
      if (kb.presses('space')) {
        isThrown = true;
        gameState = 3; // Shift to physics engine loop
        launchAngle = angle;

        // Calculate initial trajectory momentum once upon release
        ball.vel.x = cos(launchAngle - 1.57) * power;
        ball.vel.y = sin(launchAngle - 1.57) * power;
      }
    }

    // --- SOLID RED ARROW RENDERING CONFIGURATION ---
    push();
    angleMode(RADIANS);
    translate(ball.x, ball.y);
    rotate(angle - 1.57);

    // Flash arrow solid white ONLY when locked and waiting for the final launch spacebar trigger
    if (gameState === 2) {
      stroke(255);
      fill(255);
    } else {
      stroke('red');
      fill('red');
    }

    let arrowLength = power * 12;
    strokeWeight(4);
    line(0, 0, arrowLength, 0);
    noStroke();
    triangle(arrowLength, -10, arrowLength, 10, arrowLength + 12, 0);
    pop();

  } else {
    // Determine frame limits based on canvas geometry properties using your exact values
    let topLimitY = -canvas.h / 2;
    let targetPinY = -425; // Maintained your exact pixel ramp layout designation

    // --- ZONE CHECK: Determine if ball has entered the mechanical back return deck ---
    if (ball.y < targetPinY) {
      // 1. Decelerate forward drive momentum gracefully to simulate hitting the collection wall
      ball.vel.y = ball.vel.y * 0.82; 
      
      // 2. Forcefully feed the ball to the right until it falls into the right gutter track at x = 170
      if (ball.x < 170) {
        ball.vel.x = 2.5; 
      } else {
        ball.vel.x = 0;
      }
      
      // 3. Keep the ball visible at the true visual top edge of the play space while it sweeps right
      if (ball.y < topLimitY + 16) {
        ball.y = topLimitY + 16;
      }

    } else if (ball.y < targetPinY * 0.15) {
      // --- ACTIVE LANE BACKEND SECTION: HOOK FRICTION ZONE ---
      let baseFriction = (1.2 / power);
      let smoothHookForce = constrain(baseFriction, 0.01, 0.12);

      if (abs(launchAngle) <= SAFE_ANGLE_RAD) {
        // Safe zone vector straight alignment calculations
        if (!isFrictionLocked) {
          if (ball.x > 8) {
            ball.vel.x -= smoothHookForce * (abs(ball.x) / 170);
          } else if (ball.x < -8) {
            ball.vel.x += smoothHookForce * (abs(ball.x) / 170);
          } else {
            isFrictionLocked = true; 
          }
        }
      } else {
        // Wild zone hook mechanics
        if (launchAngle > 0) {
          ball.vel.x -= smoothHookForce;
        } else if (launchAngle < 0) {
          ball.vel.x += smoothHookForce;
        }
      }
    }

    // --- PHYSICAL GUTTER CONTAINMENT RULES ---
    if (ball.y >= targetPinY) {
      if (ball.x <= -170) {
        ball.x = -170;
        ball.vel.x = 0;
      } else if (ball.x >= 170) {
        ball.x = 170;
        ball.vel.x = 0;
      }
    }

    // Clean reset trigger: returns state machine back to angle choosing mode
    if (ball.y < targetPinY && ball.x >= 168) {
      ball.x = 0;
      ball.y = 170;
      isThrown = false;
      gameState = 0; // State machine rolls back to 0 perfectly
      angle = 0;
      power = 5;
    }
  }
};
