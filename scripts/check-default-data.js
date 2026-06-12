const fs = require("fs");
const assert = require("assert");

const required = ["palette.json", "projects.json", "palette-limit.json", "settings.json", "manifest.json"];
for (const fileName of required) {
  assert.ok(fs.existsSync(`defaults/${fileName}`), `default data missing ${fileName}`);
}

const palette = readJson("palette.json");
const projects = readJson("projects.json");
const paletteLimit = readJson("palette-limit.json");
const settings = readJson("settings.json");
const manifest = readJson("manifest.json");

assert.ok(Array.isArray(palette), "default palette should be an array");
assert.strictEqual(palette.length, 221, "default palette should include the current 221 blocks");
assert.strictEqual(palette.filter((block) => Number.isInteger(block.stock)).length, palette.length, "default palette should include stock counts");
assert.strictEqual(paletteLimit, 221, "default palette limit should match current configuration");
assert.ok(Array.isArray(projects), "default projects should be an array");
assert.strictEqual(projects.length, 8, "default gallery should include the current 8 sample projects");
assert.strictEqual(projects.filter((project) => project.assemblyProgress).length, 0, "sample projects should not include assembly progress");

assert.strictEqual(settings.activeConfigId, "local-default", "default settings should use the local config");
assert.strictEqual(settings.configs.length, 1, "default settings should only include one local config");
assert.strictEqual(settings.configs[0].provider, "local", "default AI provider should be local");
assert.strictEqual(settings.configs[0].apiKey, "", "default settings should not include an API key");
assert.strictEqual(settings.configs[0].apiKeyPresent, false, "default settings should not report an API key");
assert.ok(manifest.version, "default manifest should include a version");
assert.strictEqual(manifest.paletteCount, 221, "default manifest should count current palette blocks");
assert.strictEqual(manifest.projectCount, 8, "default manifest should count current gallery projects");
assert.strictEqual(manifest.paletteLimit, 221, "default manifest should include current palette limit");

console.log("Default data check passed.");

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(`defaults/${fileName}`, "utf8"));
}
