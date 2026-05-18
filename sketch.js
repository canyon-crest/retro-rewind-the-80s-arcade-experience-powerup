await Canvas(); 
noSmooth(); 

// 1. Spawns the ball at your designated starting position
let ball = new Sprite(0, 170); 

let alley = await loadImage('Images/New Piskel.png'); 

// Add and slice the spritesheet animation onto the ball
let rolling = ball.addAni('Sprites/bowling_ball_cosmic_spritesheet.png', { 
  width: 32, 
  height: 32, 
  frames: 8 
});
rolling.frameDelay = 8; 

// Aiming and physics configuration variables
let angle = 0;        // Controls left/right tilt exclusively
let power = 5;        // Controls length and forward velocity exclusively
let isThrown = false; // Throw state controller

// Physics variable for launch angle tracking
let launchAngle = 0;

q5.update = function () {
  // Clear canvas view 
  background('black'); 
  imageMode(CENTER);
  
  // Render background image matching your established configuration rules
  image(alley, 0, 0, canvas.h, canvas.h); 

  // Bowling Control Logic Loop
  if (!isThrown) {
    ball.vel.x = 0;
    ball.vel.y = 0;

    // Use Left/Right Arrow Keys to rotate the angle vector exclusively
    if (kb.pressing('left')) angle -= 0.04;
    if (kb.pressing('right')) angle += 0.04;
    
    // Use Up/Down Arrow Keys to scale power length exclusively
    if (kb.pressing('up')) power = min(power + 0.15, 15);
    if (kb.pressing('down')) power = max(power - 0.15, 2);

    // Launch ball using precise math matching the arrow direction
    if (kb.presses('space')) {
      isThrown = true;
      launchAngle = angle; 
      
      // Calculate perfect trigonometric vector directions
      ball.vel.x = cos(launchAngle - 1.57) * power;
      ball.vel.y = sin(launchAngle - 1.57) * power;
    }

    // --- Dynamic Arrow Rendering Configuration ---
    push(); 
    angleMode(RADIANS); 
    translate(ball.x, ball.y);
    rotate(angle - 1.57); 
    
    let arrowLength = power * 12; 
    stroke('red');
    strokeWeight(4);
    line(0, 0, arrowLength, 0); 
    
    fill('red');
    noStroke();
    triangle(arrowLength, -10, arrowLength, 10, arrowLength + 12, 0);
    pop(); 

  } else {
    // --- REALISTIC DYNAMIC HOOK PHYSICS ENGINE ---
    let topLimit = -canvas.h / 2;

    // Check if the ball has crossed into the last 35% section of the visible lane
    if (ball.y < topLimit * 0.15) {
      // 1. DYNAMIC FRICTION BALANCING:
      // Lower power throws mean more friction grip, but we cap it to prevent over-hooking.
      // High power throws break through friction, resulting in a tighter, shallower hook.
      let baseHook = 0.85 / power; 
      
      // 2. POSITION WEIGHT BALANCE:
      // Scales down the hook intensity the closer the ball gets to the target lane center (0).
      // If you throw close to the center line, the side push naturally dampens out.
      let lateralDistanceFactor = abs(ball.x) / 170; 
      let dynamicHookForce = baseHook * lateralDistanceFactor;
      
      // Enforce realistic bounds so it never clips out or behaves like an unnatural circle
      dynamicHookForce = constrain(dynamicHookForce, 0.01, 0.18);

      // Back-third friction grab: snap back smoothly toward pocket alignment
      if (launchAngle > 0) {
        ball.vel.x -= dynamicHookForce;
      } else if (launchAngle < 0) {
        ball.vel.x += dynamicHookForce;
      }
    } else {
      // FIRST TWO-THIRDS OF THE LANE: Pure oil slide
      ball.vel.x = cos(launchAngle - 1.57) * power;
      ball.vel.y = sin(launchAngle - 1.57) * power;
    }

    // Relative gutter intersection monitoring bounds rules
    if (ball.x <= -170) { 
      ball.x = -170;      
      ball.vel.x = 0;     
    } else if (ball.x >= 170) {
      ball.x = 170;       
      ball.vel.x = 0;     
    }

    // Clean reset triggers when the ball exits the true TOP edge of your centered layout
    if (ball.y < topLimit - 50) {
      ball.x = 0; 
      ball.y = 170;
      isThrown = false;
      angle = 0;
      power = 5;
    }
  }
};
