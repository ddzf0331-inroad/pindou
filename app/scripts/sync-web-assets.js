const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..");
const assetRoots = [
  path.join(repoRoot, "app/android-app/src/main/assets"),
  path.join(repoRoot, "app/ios-app/PixelToyDesigner/WebAssets")
];

const entries = [
  ["index.html", "index.html"],
  ["styles.css", "styles.css"],
  ["src/app.js", "src/app.js"],
  ["defaults/palette.json", "defaults/palette.json"],
  ["defaults/projects.json", "defaults/projects.json"],
  ["defaults/palette-limit.json", "defaults/palette-limit.json"],
  ["defaults/settings.json", "defaults/settings.json"],
  ["defaults/manifest.json", "defaults/manifest.json"],
  ["README.md", "README.md"],
  ["使用手册.md", "使用手册.md"]
];

for (const assetRoot of assetRoots) {
  fs.rmSync(assetRoot, { recursive: true, force: true });

  for (const [source, target] of entries) {
    const sourcePath = path.join(repoRoot, source);
    const targetPath = path.join(assetRoot, target);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

console.log(`已同步 ${entries.length} 个移动端资源到 ${assetRoots.length} 个 App 工程`);
