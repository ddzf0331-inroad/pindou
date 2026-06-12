const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const requiredFiles = [
  "app/settings.gradle",
  "app/build.gradle",
  "app/android-app/build.gradle",
  "app/android-app/src/main/AndroidManifest.xml",
  "app/android-app/src/main/java/com/pixeltoy/designer/MainActivity.java",
  "app/ios-app/PixelToyDesigner.xcodeproj/project.pbxproj",
  "app/ios-app/PixelToyDesigner/PixelToyDesignerApp.swift",
  "app/ios-app/PixelToyDesigner/WebViewContainer.swift",
  "app/ios-app/PixelToyDesigner/Info.plist",
  "app/scripts/build-apk.sh",
  "app/scripts/check-ios-env.sh",
  "app/scripts/build-ipa.sh",
  "app/scripts/sync-web-assets.js"
];

for (const file of requiredFiles) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) throw new Error(`Missing mobile app file: ${file}`);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const js = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
const assetHtml = fs.readFileSync(path.join(root, "app/android-app/src/main/assets/index.html"), "utf8");
const assetCss = fs.readFileSync(path.join(root, "app/android-app/src/main/assets/styles.css"), "utf8");
const assetJs = fs.readFileSync(path.join(root, "app/android-app/src/main/assets/src/app.js"), "utf8");
const assetDefaultManifest = fs.readFileSync(path.join(root, "app/android-app/src/main/assets/defaults/manifest.json"), "utf8");
const assetDefaultPalette = fs.readFileSync(path.join(root, "app/android-app/src/main/assets/defaults/palette.json"), "utf8");
const assetDefaultProjects = fs.readFileSync(path.join(root, "app/android-app/src/main/assets/defaults/projects.json"), "utf8");
const iosAssetHtml = fs.readFileSync(path.join(root, "app/ios-app/PixelToyDesigner/WebAssets/index.html"), "utf8");
const iosAssetCss = fs.readFileSync(path.join(root, "app/ios-app/PixelToyDesigner/WebAssets/styles.css"), "utf8");
const iosAssetJs = fs.readFileSync(path.join(root, "app/ios-app/PixelToyDesigner/WebAssets/src/app.js"), "utf8");
const iosDefaultManifest = fs.readFileSync(path.join(root, "app/ios-app/PixelToyDesigner/WebAssets/defaults/manifest.json"), "utf8");
const iosDefaultPalette = fs.readFileSync(path.join(root, "app/ios-app/PixelToyDesigner/WebAssets/defaults/palette.json"), "utf8");
const iosDefaultProjects = fs.readFileSync(path.join(root, "app/ios-app/PixelToyDesigner/WebAssets/defaults/projects.json"), "utf8");
const defaultManifest = fs.readFileSync(path.join(root, "defaults/manifest.json"), "utf8");
const defaultPalette = fs.readFileSync(path.join(root, "defaults/palette.json"), "utf8");
const defaultProjects = fs.readFileSync(path.join(root, "defaults/projects.json"), "utf8");
const iosSwift = fs.readFileSync(path.join(root, "app/ios-app/PixelToyDesigner/WebViewContainer.swift"), "utf8");
const androidActivity = fs.readFileSync(path.join(root, "app/android-app/src/main/java/com/pixeltoy/designer/MainActivity.java"), "utf8");

[
  "appToast",
  "mobileGenerateBtn",
  "mobileSaveProjectBtn",
  "mobileExportBtn",
  "mobileAddColorBtn",
  "mobileAssemblySaveBtn",
  "mobileSaveAiBtn",
  "mobile-action-bar"
].forEach((marker) => {
  if (!html.includes(marker) && !js.includes(marker) && !css.includes(marker)) {
    throw new Error(`Missing mobile marker: ${marker}`);
  }
});

[
  ".app-shell[data-active-panel=\"workspace\"] .mobile-action-bar",
  ".app-shell[data-active-panel=\"settings\"] .mobile-action-bar [data-mobile-panel=\"settings\"]",
  "bottom: calc(var(--mobile-nav-height) + 14px + env(safe-area-inset-bottom))",
  "grid-template-columns: repeat(5, minmax(0, 1fr))",
  ".nav-item[data-panel=\"settings\"]",
  "touch-action: pan-x pan-y",
  "button:active",
  "font-size: 16px",
  "input:focus-visible",
  ".app-toast",
  ".modal-header {\n    position: sticky",
  ".palette-table {\n    order: 1",
  ".editor-form {\n    order: 2",
  "scroll-margin-top: 92px"
].forEach((marker) => {
  if (!css.includes(marker)) throw new Error(`Missing mobile CSS marker: ${marker}`);
});

[
  "handleCanvasTouchStart",
  "handleCanvasTouchMove",
  "handleAssemblyTouchStart",
  "createCanvasPinchState",
  "createAssemblyPinchState",
  "getTouchDistance",
  "revealPaletteEditorOnMobile",
  "scrollElementIntoMobileView",
  "showAppFeedback",
  "triggerNativeFeedback",
  "isBundledMobileRuntime",
  "getMobileDefaultRepairPlan",
  "PixelToyBundledDefaults",
  "bundledDefaults",
  "userDataTouched",
  "markUserDataTouched"
].forEach((marker) => {
  if (!js.includes(marker)) throw new Error(`Missing mobile pinch marker: ${marker}`);
});

[
  "viewport-fit=cover",
  "PixelToyIOS",
  "ios-webview"
].forEach((marker) => {
  if (!html.includes(marker) && !js.includes(marker) && !css.includes(marker)) {
    throw new Error(`Missing iOS web marker: ${marker}`);
  }
});

[
  "WKWebView",
  "PixelToyIOS",
  "UIActivityViewController",
  "UINotificationFeedbackGenerator",
  "loadFileURL",
  "bundledDefaultsScript",
  "readWebAsset",
  "notifyFeedback",
  "action: \"notify\""
].forEach((marker) => {
  if (!iosSwift.includes(marker)) throw new Error(`Missing iOS native marker: ${marker}`);
});

[
  "public void notify",
  "performHapticFeedback",
  "HapticFeedbackConstants"
].forEach((marker) => {
  if (!androidActivity.includes(marker)) throw new Error(`Missing Android native marker: ${marker}`);
});

if (assetHtml !== html || assetCss !== css || assetJs !== js) {
  throw new Error("Android assets are not synced. Run npm run app:sync.");
}

if (iosAssetHtml !== html || iosAssetCss !== css || iosAssetJs !== js) {
  throw new Error("iOS assets are not synced. Run npm run app:sync.");
}

if (assetDefaultManifest !== defaultManifest || assetDefaultPalette !== defaultPalette || assetDefaultProjects !== defaultProjects) {
  throw new Error("Android default data is not synced. Run npm run app:sync.");
}

if (iosDefaultManifest !== defaultManifest || iosDefaultPalette !== defaultPalette || iosDefaultProjects !== defaultProjects) {
  throw new Error("iOS default data is not synced. Run npm run app:sync.");
}

const manifest = JSON.parse(defaultManifest);
if (manifest.paletteCount !== 221 || manifest.projectCount !== 8 || manifest.paletteLimit !== 221) {
  throw new Error("Mobile defaults must include the current 221-color palette and 8 gallery projects.");
}

console.log("Mobile app check passed.");
