window.onload = () => {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  // Resize canvas to fill window
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let x = 50;
  let speed = 2;

  function gameLoop() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "red";
    ctx.fillRect(x, 100, 50, 50);

    x += speed;
    if (x + 50 > canvas.width || x < 0) speed *= -1;

    requestAnimationFrame(gameLoop);
  }

  gameLoop();
};

