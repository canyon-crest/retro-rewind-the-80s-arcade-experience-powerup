await Canvas();
//world.gravity.y = 50;

let ball = new Sprite();
let alley = await loadImage('Images/New Piskel.png');



// Replace ball.img with ball.addAni to slice the spritesheet
let rolling = ball.addAni('Sprites/bowling_ball_cosmic_spritesheet.png', { 
    width: 32, 
    height: 32, 
    frames: 8 
});

rolling.frameDelay = 8;
// Force the animation sequence to run over and over

q5.update = function () {
    background(0); 
    image(alley, 0, 0, width, height, 0, 0, alley.width, alley.height, COVER);

    text('click to jump!', 0, -50);
    if (mouse.presses()) ball.vel.y = -5;

    
};

function draw(){
  rolling.ani.nextFrame();
}