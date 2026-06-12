const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const source = fs.readFileSync("src/app.js", "utf8");
const defaults = {
  "defaults/manifest.json": JSON.parse(fs.readFileSync("defaults/manifest.json", "utf8")),
  "defaults/palette.json": JSON.parse(fs.readFileSync("defaults/palette.json", "utf8")),
  "defaults/projects.json": JSON.parse(fs.readFileSync("defaults/projects.json", "utf8")),
  "defaults/palette-limit.json": JSON.parse(fs.readFileSync("defaults/palette-limit.json", "utf8")),
  "defaults/settings.json": JSON.parse(fs.readFileSync("defaults/settings.json", "utf8"))
};

class MockClassList {
  contains() {
    return false;
  }
}

class MockElement {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.classList = new MockClassList();
    this.width = 0;
    this.height = 0;
  }

  getContext() {
    return {
      fillStyle: "",
      fillRect() {},
      drawImage() {}
    };
  }

  toDataURL() {
    return "data:image/png;base64,bW9iaWxlLWRlZmF1bHRz";
  }
}

async function runCase(initialStorage = {}) {
  const storage = new Map(Object.entries(initialStorage));
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
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    window: {
      PixelToyIOS: {},
      location: { protocol: "file:" },
      addEventListener() {},
      confirm: () => true
    },
    document: {
      documentElement: { classList: new MockClassList() },
      addEventListener() {},
      createElement: (tag) => new MockElement(tag),
      querySelectorAll: () => []
    },
    Image: class {},
    fetch: async (filePath) => ({
      ok: Object.prototype.hasOwnProperty.call(defaults, filePath),
      json: async () => structuredClone(defaults[filePath])
    })
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "src/app.js" });
  await vm.runInContext("loadBundledDefaults()", context);
  const snapshot = vm.runInContext(
    `({
      paletteLength: state.palette.length,
      firstPaletteId: state.palette[0]?.id,
      projectsLength: state.projects.length,
      paletteLimit: state.paletteLimit
    })`,
    context
  );
  return { snapshot, storage };
}

(async () => {
  const fresh = await runCase();
  assert.strictEqual(fresh.snapshot.paletteLength, 221, "fresh mobile launch should load current bundled palette");
  assert.strictEqual(fresh.snapshot.projectsLength, 8, "fresh mobile launch should load current bundled gallery");
  assert.strictEqual(fresh.snapshot.paletteLimit, 221, "fresh mobile launch should load current palette limit");
  assert.strictEqual(
    JSON.parse(fresh.storage.get("pixelToy.bundledDefaults.v1")),
    defaults["defaults/manifest.json"].version,
    "fresh mobile launch should record bundled defaults version"
  );

  const oldBundled = await runCase({
    "pixelToy.palette.v1": JSON.stringify([{ id: "old", code: "01", name: "旧色", rgb: [0, 0, 0], status: "active" }]),
    "pixelToy.projects.v1": JSON.stringify([]),
    "pixelToy.paletteLimit.v1": JSON.stringify(1),
    "pixelToy.bundledDefaults.v1": JSON.stringify("old-version")
  });
  assert.strictEqual(oldBundled.snapshot.paletteLength, 221, "untouched mobile defaults should refresh palette after bundle update");
  assert.strictEqual(oldBundled.snapshot.projectsLength, 8, "untouched mobile defaults should refresh gallery after bundle update");
  assert.strictEqual(oldBundled.snapshot.paletteLimit, 221, "untouched mobile defaults should refresh palette limit after bundle update");

  const userTouched = await runCase({
    "pixelToy.palette.v1": JSON.stringify(
      Array.from({ length: 20 }, (_, index) => ({
        id: `user-${index}`,
        code: `U${index}`,
        name: `用户色 ${index}`,
        rgb: [index, index, index],
        status: "active"
      }))
    ),
    "pixelToy.projects.v1": JSON.stringify([
      {
        id: "user-project",
        name: "用户作品",
        inputType: "cartoon",
        width: 1,
        height: 1,
        pixelMatrix: { width: 1, height: 1, rows: [[["user-0", 1]]] },
        paletteSnapshot: [{ id: "user-0", code: "U0", name: "用户色 0", rgb: [0, 0, 0], status: "active" }],
        createdAt: "2026-06-11T00:00:00.000Z",
        updatedAt: "2026-06-11T00:00:00.000Z",
        thumbnail: "data:image/png;base64,dXNlcg=="
      }
    ]),
    "pixelToy.paletteLimit.v1": JSON.stringify(1),
    "pixelToy.bundledDefaults.v1": JSON.stringify("old-version"),
    "pixelToy.userDataTouched.v1": JSON.stringify(true)
  });
  assert.strictEqual(userTouched.snapshot.paletteLength, 20, "user-touched mobile palette should not be overwritten");
  assert.strictEqual(userTouched.snapshot.firstPaletteId, "user-0", "user-touched mobile palette should preserve user data");
  assert.strictEqual(userTouched.snapshot.projectsLength, 1, "user-touched mobile gallery should not be overwritten");
  assert.strictEqual(userTouched.snapshot.paletteLimit, 221, "user-touched mobile palette limit should still catch up to the current bundled limit");

  const oldStarterData = await runCase({
    "pixelToy.palette.v1": JSON.stringify(
      Array.from({ length: 12 }, (_, index) => ({
        id: `old-${index}`,
        code: `${index}`,
        name: `旧默认色 ${index}`,
        rgb: [index, index, index],
        status: "active"
      }))
    ),
    "pixelToy.projects.v1": JSON.stringify([]),
    "pixelToy.paletteLimit.v1": JSON.stringify(12),
    "pixelToy.bundledDefaults.v1": JSON.stringify(defaults["defaults/manifest.json"].version),
    "pixelToy.userDataTouched.v1": JSON.stringify(true)
  });
  assert.strictEqual(oldStarterData.snapshot.paletteLength, 221, "old starter mobile palette should be repaired to current defaults");
  assert.strictEqual(oldStarterData.snapshot.projectsLength, 8, "empty mobile gallery should be repaired to current defaults");
  assert.strictEqual(oldStarterData.snapshot.paletteLimit, 221, "old starter mobile limit should be repaired to current defaults");

  console.log("Mobile defaults check passed.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
