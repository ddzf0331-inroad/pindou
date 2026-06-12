const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync("src/app.js", "utf8");

const storage = new Map();
const context = {
  console,
  structuredClone,
  Date,
  Math,
  Number,
  String,
  Array,
  Map,
  Set,
  Blob,
  URL,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  },
  window: {
    location: { protocol: "file:" },
    addEventListener: () => {},
    confirm: () => true
  },
  document: {
    addEventListener: () => {},
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: "",
        fillRect: () => {},
        drawImage: () => {}
      }),
      toDataURL: () => "data:image/png;base64,"
    }),
    querySelectorAll: () => []
  },
  Image: class {}
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "src/app.js" });

const matrix = {
  width: 5,
  height: 2,
  rows: [
    ["a", "a", "b", "b", "b"],
    ["c", "a", "a", "a", "c"]
  ]
};
assert.strictEqual(JSON.stringify(context.decompressMatrix(context.compressMatrix(matrix))), JSON.stringify(matrix), "matrix should round-trip");

assert.strictEqual(
  context.blocksMatch({ name: "蓝", rgb: [1, 2, 3] }, { name: "蓝", rgb: [1, 2, 3] }),
  true,
  "same name and rgb should match"
);
assert.strictEqual(
  context.blocksMatch({ name: "蓝", rgb: [1, 2, 3] }, { name: "蓝", rgb: [1, 2, 4] }),
  false,
  "same name but different rgb should not match"
);

const legacy = context.normalizeSettings({
  provider: "openai",
  model: "gpt-image-1.5",
  endpoint: "",
  apiKeyPresent: true,
  prompt: "cartoon",
  enabled: true
});
assert.strictEqual(legacy.configs.length, 1, "legacy settings should migrate to one config");
assert.strictEqual(legacy.configs[0].provider, "openai", "legacy provider should be preserved");
assert.strictEqual(legacy.configs[0].enabled, true, "legacy enabled flag should be preserved");

const normalizedBlock = context.normalizeBlock({ code: "01", name: "红", rgb: [300, -1, 22], status: "active" });
assert.strictEqual(JSON.stringify(normalizedBlock.rgb), JSON.stringify([255, 0, 22]), "rgb should be clamped");

const template = context.createPaletteTemplatePayload();
assert.strictEqual(template.type, "pixel-toy-palette", "palette template should use palette import type");
assert.ok(Array.isArray(template.palette), "palette template should include palette array");
assert.ok(template.palette.length >= 3, "palette template should include examples");
assert.strictEqual(context.normalizeBlock(template.palette[0]).code, "A1", "template block should normalize");

const red = context.hslToRgb(0, 100, 50);
assert.strictEqual(JSON.stringify(red), JSON.stringify([255, 0, 0]), "hsl red should convert to rgb red");
const hsl = context.rgbToHsl([255, 0, 0]);
assert.strictEqual(Math.round(hsl[0]), 0, "rgb red hue should be 0");

const paletteLab = [
  { id: "red", code: "01", name: "红", rgb: [255, 0, 0], status: "active", lab: context.rgbToLab([255, 0, 0]) },
  { id: "blue", code: "02", name: "蓝", rgb: [0, 0, 255], status: "active", lab: context.rgbToLab([0, 0, 255]) },
  { id: "green", code: "03", name: "绿", rgb: [0, 255, 0], status: "active", lab: context.rgbToLab([0, 255, 0]) }
];
const sampledPixels = [
  ...Array.from({ length: 4 }, (_, index) => ({ x: index, y: 0, rgb: [250, 0, 0], lab: context.rgbToLab([250, 0, 0]) })),
  { x: 0, y: 1, rgb: [0, 0, 250], lab: context.rgbToLab([0, 0, 250]) },
  { x: 1, y: 1, rgb: [0, 250, 0], lab: context.rgbToLab([0, 250, 0]) }
];
const selectedPalette = context.selectGenerationPalette(sampledPixels, paletteLab, 2);
assert.strictEqual(selectedPalette.length, 2, "generation palette should respect requested color type limit");
assert.strictEqual(selectedPalette[0].id, "red", "most common source color should be selected first");
const recommendationRows = context.getPaletteRecommendationRows(sampledPixels, paletteLab);
assert.strictEqual(recommendationRows[0].id, "red", "recommendation rows should sort by matched pixel count");

context.paletteLabForManualTest = paletteLab;
const manualPalette = vm.runInContext(
  `
  state.palette = paletteLabForManualTest;
  state.generationPaletteIds = new Set(["blue"]);
  getSelectedGenerationPalette(paletteLabForManualTest);
`,
  context
);
assert.strictEqual(manualPalette.length, 1, "manual generation palette should include only selected colors");
assert.strictEqual(manualPalette[0].id, "blue", "manual generation palette should preserve selected color");

const replacedPalette = vm.runInContext(
  `
  state.palette = paletteLabForManualTest;
  state.generationPaletteIds = new Set(["red"]);
  replaceGenerationPaletteBlock("red", "green");
  getSelectedGenerationPalette(paletteLabForManualTest);
`,
  context
);
assert.strictEqual(replacedPalette.length, 1, "replacement should keep the manual palette size");
assert.strictEqual(replacedPalette[0].id, "green", "replacement should swap to the requested color");

console.log("Core data check passed.");
