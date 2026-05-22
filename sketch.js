await Canvas();
noSmooth();

// 1. Spawns the ball at your designated starting position
let ball = new Sprite(0, 170);
let alley = await loadImage('Images/New Piskel.png');

// --- BALL SELECTOR SELECTION SETTING ---
const BALL_OPTIONS = ['cosmic', 'ember', 'galaxy', 'inferno', 'toxic', 'vapor'];
let p1SelectedBall = null;
let p2SelectedBall = null;

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

let rolling = null;

q5.update = function () {
    // Clear canvas view
    background('black');

    // Handle mouse click tracking variables securely
    if (!mouseIsPressed) {
        isClickReleased = true;
    }

    // ==========================================
    // STEP 1: INTERACTIVE BALL SELECTION SCREEN
    // ==========================================
    if (gameState === -2 || gameState === -1) {
        camera.on(); // FIX: Keep camera on so (0,0) stays perfectly in the screen center
        ball.visible = false; 
        
        textSize(20);
        fill('white');
        textAlign(CENTER, CENTER);
        
        if (gameState === -2) {
            text("PLAYER 1: CLICK TO CHOOSE YOUR BALL", 0, -120);
        } else {
            text("PLAYER 2: CLICK TO CHOOSE YOUR BALL", 0, -120);
        }

        // Layout 6 boxes cleanly using centered camera space
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
                // FIX: Check boundaries against centered camera engine mouse properties (mouse.x / mouse.y)
                if (mouse.x > xPos - 45 && mouse.x < xPos + 45 && mouse.y > yPos - 45 && mouse.y < yPos + 45) {
                    fill(80);
                    stroke('yellow');
                    strokeWeight(3);
                    
                    if (mouseIsPressed && isClickReleased) {
                        isClickReleased = false; // Input gate lock
                        
                        if (gameState === -2) {
                            p1SelectedBall = option;
                            gameState = -1; 
                        } else {
                            p2SelectedBall = option;
                            
                            // Load the spritesheet using player 1's starting ball choice
                            rolling = ball.addAni(`Sprites/bowling_ball_${p1SelectedBall}_spritesheet.png`, { width: 32, height: 32, frames: 8 });
                            rolling.frameDelay = 8;
                            
                            ball.visible = true; 
                            gameState = 0; // Transition to standard targeting loop
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
                text(option.toUpperCase(), xPos, yPos + 30);
                
                // Visual layout placeholder circle markers
                fill('cyan');
                circle(xPos, yPos - 10, 30);
            }
            pop();
        }
        return; 
    }

    // ==========================================
    // STEP 2: ORIGINAL STABLE GAMEPLAY LOOP
    // ==========================================
    camera.on();
    imageMode(CENTER);
    image(alley, 0, 0, canvas.h, canvas.h);

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

            // FIXED: Replaced spacebar check with engine mouse press detection
            if (mouse.presses()) {
                gameState = 1; 
            }
        }
        // --- STATE 1: EXPANDING/SHRINKING POWER SELECTOR ---
        else if (gameState === 1) {
            let speedMultiplier = 1.0 + 2.2 * abs(cos(powerTimer));
            powerTimer += 0.034 * speedMultiplier;
            rawPowerSin = sin(powerTimer);
            power = map(rawPowerSin, -1, 1, 5, 9); 

            // FIXED: Replaced spacebar check with engine mouse press detection
            if (mouse.presses()) {
                gameState = 2; 
            }
        }
        // --- STATE 2: LAUNCH CONFIRMATION CLICK ---
        else if (gameState === 2) {
            // FIXED: Replaced spacebar check with engine mouse press detection
            if (mouse.presses()) {
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

    } else {
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
        }
        else if (ball.y < targetPinY * 0.25) { 
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

        if (ball.y < targetPinY && ball.x >= (LANE_LIMIT - 2)) { 
            ball.x = 0;
            ball.y = 170;
            ball.vel.x = 0; 
            ball.vel.y = 0;
            isThrown = false;
            gameState = 0;
            angle = 0;
            power = 6;
            rawPowerSin = 0; 
        }
    }
    camera.off(); 
};
