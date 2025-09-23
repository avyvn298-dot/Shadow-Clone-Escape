const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Load ninja image
const ninja = new Image();
ninja.src = "ninja_spritesheet.png";

ninja.onload = () => {
  console.log("✅ Ninja loaded!");
  ctx.drawImage(ninja, 100, 100, 64, 64); // draw at x=100, y=100, size 64x64
};

ninja.onerror = () => {
  console.error("❌ Could not load ninja_spritesheet.png");
};
