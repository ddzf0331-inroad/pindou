const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

class MockElement {
  constructor(tag = "div") {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.value = "";
    this.checked = false;
    this.disabled = false;
    this.title = "";
    this.className = "";
    this.innerHTML = "";
    this.textContent = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}

  querySelector() {
    return new MockElement("button");
  }

  getContext() {
    return {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      fillRect() {},
      strokeRect() {},
      clearRect() {},
      drawImage() {},
      fillText() {},
      beginPath() {},
      arc() {},
      stroke() {},
      fill() {},
      moveTo() {},
      lineTo() {},
      createImageData(width, height) {
        return { data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData() {}
    };
  }

  toDataURL() {
    return "data:image/png;base64,d29ya2Zsb3c=";
  }
}

const storage = new Map();
const context = {
  console,
  structuredClone,
  Uint8ClampedArray,
  Date,
  Math,
  Number,
  String,
  Array,
  Map,
  Set,
  Blob,
  URL,
  MockElement,
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
    createElement: (tag) => new MockElement(tag),
    querySelectorAll: () => []
  },
  Image: class {},
  fetch: async () => ({ ok: true, json: async () => ({}) })
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("src/app.js", "utf8"), context, { filename: "src/app.js" });

vm.runInContext(`
  Object.assign(els, {
    projectName: new MockElement("input"),
    matrixStatus: new MockElement("div"),
    galleryGrid: new MockElement("div"),
    usedPalette: new MockElement("div"),
    replacementSelect: new MockElement("select"),
    paintBlockSelect: new MockElement("select"),
    riskStatus: new MockElement("div"),
    undoBtn: new MockElement("button"),
    riskList: new MockElement("div"),
    candidateHistory: new MockElement("div")
  });

  state.palette = [
    { id: "c1", code: "01", name: "红", rgb: [255, 0, 0], status: "active" },
    { id: "c2", code: "02", name: "蓝", rgb: [0, 0, 255], status: "active" }
  ];
  state.projectPaletteSnapshot = null;
  state.matrix = {
    width: 3,
    height: 2,
    rows: [
      ["c1", "c2", "c1"],
      ["c2", "c1", "c2"]
    ]
  };
  state.candidateStatus = "pending";
  state.candidates = [];
  state.projects = [];
  state.history = [];
  state.risks = [];
  state.sourceName = "workflow.png";
  els.projectName.value = "工作流测试";
  addCandidateSnapshot();
  saveProject();
`, context);

const result = vm.runInContext(`({
  projectCount: state.projects.length,
  projectName: state.projects[0].name,
  candidateStatus: state.candidateStatus,
  candidateCount: state.candidates.length,
  snapshotCount: state.projects[0].paletteSnapshot.length,
  decompressed: decompressMatrix(state.projects[0].pixelMatrix),
  storedProjects: localStorage.getItem(STORAGE_KEYS.projects)
})`, context);

assert.strictEqual(result.projectCount, 1, "saving should create one gallery project");
assert.strictEqual(result.projectName, "工作流测试", "project name should persist");
assert.strictEqual(result.candidateStatus, "accepted", "saving should mark candidate accepted");
assert.strictEqual(result.candidateCount, 1, "candidate history should keep current candidate");
assert.strictEqual(result.snapshotCount, 2, "palette snapshot should be saved");
assert.strictEqual(result.decompressed.rows[0][1], "c2", "project matrix should round-trip");
assert.ok(result.storedProjects.includes("工作流测试"), "projects should be written to local storage");

console.log("Workflow check passed.");
