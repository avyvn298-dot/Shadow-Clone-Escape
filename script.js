// === ASSET LOADER (Only using what we have) === //
const assets = {
  ninja: "assets/ninja_spritesheet.png",
  clone: "assets/clones_spritesheet.png",
  portal: "assets/portal.png"
};

const loadedAssets = {};

function loadAssets(callback) {
  let loaded = 0;
  const keys = Object.keys(assets);
  const total = keys.length;

  keys.forEach(key => {
    const img = new Image();
    img.src = assets[key];

    img.onload = () => {
      loadedAssets[key] = img;
      loaded++;
      console.log(`✅ Loaded: ${assets[key]}`);
      if (loaded === total) callback();
    };

    img.onerror = () => {
      console.error(`❌ Missing asset: ${assets[key]}`);
      loaded++;
      if (loaded === total) callback();
    };
  });
}

// === GAME START === //
function startGame() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Ninja (center left)
    if (loadedAssets.ninja) {
      ctx.drawImage(
        loadedAssets.ninja,
        0, 0, 64, 64,        // source (first frame of sheet)
        canvas.width / 2 - 200, canvas.height / 2 - 32, // destination pos
        64, 64               // destination size
      );
    }

    // Draw Clone (center)
    if (loadedAssets.clone) {
      ctx.drawImage(
        loadedAssets.clone,
        0, 0, 64, 64,
        canvas.width / 2 - 32, canvas.height / 2 - 32,
        64, 64
      );
    }

    // Draw Portal (center right)
    if (loadedAssets.portal) {
      ctx.drawImage(
        loadedAssets.portal,
        0, 0, 64, 64,
        canvas.width / 2 + 150, canvas.height / 2 - 32,
        64, 64
      );
    }

    requestAnimationFrame(draw);
  }

  draw();
}


    // Example: draw ninja sprite in middle of screen
    if (loadedAssets.ninja) {
      ctx.drawImage(loadedAssets.ninja, 0, 0, 64, 64, canvas.width/2 - 32, canvas.height/2 - 32, 64, 64);
    }

    requestAnimationFrame(draw);
  }

  draw();
}
