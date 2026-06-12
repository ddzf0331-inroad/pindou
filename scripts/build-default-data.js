const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const DEFAULTS_DIR = path.join(ROOT, "defaults");

const DEFAULT_SETTINGS = {
  activeConfigId: "local-default",
  configs: [
    {
      id: "local-default",
      name: "本地预处理",
      provider: "local",
      model: "local-cartoon-preprocess",
      endpoint: "",
      prompt: "保留主体轮廓，减少渐变和杂色，输出适合像素化的清晰卡通图片。",
      enabled: false,
      apiKey: "",
      apiKeyPresent: false
    }
  ]
};

function main() {
  fs.mkdirSync(DEFAULTS_DIR, { recursive: true });

  writeJson("palette.json", sanitizePalette(readJson("palette.json", [])));
  copyJson("palette-limit.json");
  writeJson("projects.json", sanitizeProjects(readJson("projects.json", [])));
  writeJson("settings.json", DEFAULT_SETTINGS);
  writeManifest();

  const palette = readJson("palette.json", []);
  const projects = readJson("projects.json", []);
  const defaultsProjects = readDefaultJson("projects.json", []);
  console.log(`Default data built: ${palette.length} palette blocks, ${defaultsProjects.length || projects.length} gallery projects.`);
}

function copyJson(fileName) {
  writeJson(fileName, readJson(fileName, null));
}

function sanitizeProjects(projects) {
  if (!Array.isArray(projects)) return [];
  return projects.map((project) => {
    const next = { ...project };
    delete next.assemblyProgress;
    return next;
  });
}

function sanitizePalette(palette) {
  if (!Array.isArray(palette)) return [];
  return palette.map((block) => ({
    ...block,
    stock: normalizeStock(block.stock ?? block.inventory ?? block.quantity ?? 0)
  }));
}

function normalizeStock(value) {
  return Math.max(0, Math.floor(Math.min(999999, Number(value) || 0)));
}

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));
  } catch {
    return fallback;
  }
}

function readDefaultJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DEFAULTS_DIR, fileName), "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(DEFAULTS_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function writeManifest() {
  const palette = readDefaultJson("palette.json", []);
  const projects = readDefaultJson("projects.json", []);
  const paletteLimit = readDefaultJson("palette-limit.json", null);
  writeJson("manifest.json", {
    version: hashJson({ palette, projects, paletteLimit }).slice(0, 16),
    generatedAt: new Date().toISOString(),
    paletteCount: Array.isArray(palette) ? palette.length : 0,
    projectCount: Array.isArray(projects) ? projects.length : 0,
    paletteLimit
  });
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

main();
