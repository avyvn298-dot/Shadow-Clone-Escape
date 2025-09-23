function loadAssets(assets, callback) {
  let loaded = 0;
  let needed = Object.keys(assets).length;

  for (const [key, src] of Object.entries(assets)) {
    const img = new Image();
    img.onload = () => {
      loadedAssets[key] = img;
      console.log(`✅ Loaded: ${src}`);
      checkDone();
    };
    img.onerror = () => {
      console.warn(`❌ Missing asset: ${src} (skipping)`);
      checkDone(); // still count it as loaded
    };
    img.src = src;
  }

  function checkDone() {
    loaded++;
    if (loaded === needed) {
      console.log("✅ All available assets loaded:", loadedAssets);
      callback();
    }
  }
}
