const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

class MockClassList {
  constructor() {
    this.items = new Set();
  }

  toggle(name, force) {
    const shouldAdd = force ?? !this.items.has(name);
    if (shouldAdd) this.items.add(name);
    else this.items.delete(name);
  }

  add(name) {
    this.items.add(name);
  }

  remove(name) {
    this.items.delete(name);
  }
}

class MockElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
    this.children = [];
    this.style = {};
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.title = "";
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.clientWidth = 80;
    this.clientHeight = 80;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}

  setAttribute() {}

  setPointerCapture() {}

  querySelector() {
    return new MockElement("button");
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }

  getContext() {
    return {
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "",
      textBaseline: "",
      globalAlpha: 1,
      fillRect() {},
      strokeRect() {},
      clearRect() {},
      fillText() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {}
    };
  }

  toDataURL() {
    return "data:image/png;base64,YXNzZW1ibHk=";
  }
}

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

const result = vm.runInContext(`
  Object.assign(els, {
    assemblyCanvas: new MockElement("canvas"),
    assemblyCanvasScroll: new MockElement("div"),
    assemblySaveProgressBtn: new MockElement("button"),
    assemblyMajorGridSelect: new MockElement("select"),
    assemblyProjectStatus: new MockElement("div"),
    assemblyProgressStatus: new MockElement("div"),
    assemblyNotice: new MockElement("div"),
    assemblySummary: new MockElement("div"),
    assemblyUsedPalette: new MockElement("div"),
    galleryGrid: new MockElement("div")
  });

  const palette = [
    { id: "c1", code: "01", name: "红", rgb: [255, 0, 0], status: "active", stock: 10 },
    { id: "c2", code: "02", name: "蓝", rgb: [0, 0, 255], status: "active", stock: 10 }
  ];
  state.palette = palette.map((block) => ({ ...block }));
  const matrix = {
    width: 3,
    height: 2,
    rows: [
      ["c1", "c2", "c1"],
      ["c2", "c1", "c2"]
    ]
  };
  state.projects = [
    normalizeProject({
      id: "p1",
      name: "拼装测试",
      width: 3,
      height: 2,
      pixelMatrix: compressMatrix(matrix),
      paletteSnapshot: palette,
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z"
    })
  ];

  loadAssemblyProject(state.projects[0]);
  syncAssemblyMajorGridControl();
  const defaultMajorGrid = els.assemblyMajorGridSelect.value;
  state.assemblyMajorGridSize = 5;
  syncAssemblyMajorGridControl();
  const fiveMajorGrid = els.assemblyMajorGridSelect.value;
  state.assemblyMajorGridSize = 0;
  renderAssemblyCanvas();
  const hiddenMajorGrid = state.assemblyMajorGridSize;
  state.assemblySelectedBlockId = "c1";
  handleAssemblyCanvasClick({ clientX: 8, clientY: 8 });
  const afterMark = countAssemblyBlocks().get("c1");
  const stockAfterMark = state.palette.find((block) => block.id === "c1").stock;
  handleAssemblyCanvasClick({ clientX: 8, clientY: 8 });
  const stockAfterUnmark = state.palette.find((block) => block.id === "c1").stock;
  handleAssemblyCanvasClick({ clientX: 8, clientY: 8 });
  handleAssemblyCanvasClick({ clientX: 24, clientY: 8 });
  const blueAfterWrongClick = countAssemblyBlocks().get("c2");
  const selectedAfterWrongClick = state.assemblySelectedBlockId;
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects))[0].assemblyProgress.marked;

  locateAssemblyBlock("c1");
  const located = { ...state.assemblyLocatedCell };
  const zoomAfterLocate = state.assemblyZoom;
  const scrollAfterLocate = els.assemblyCanvasScroll.scrollLeft;

  state.assemblyMarked = new Set(["0,0"]);
  state.assemblySelectedBlockId = "c1";
  state.assemblyZoom = 16;
  renderAssemblyStats();
  const summaryMarkup = els.assemblySummary.innerHTML;
  const paletteOrderByRemaining = els.assemblyUsedPalette.children.map((child) => child.innerHTML);
  handleAssemblyCanvasPointerDown({ button: 0, clientX: 8, clientY: 8, pointerId: 3, preventDefault() {} });
  handleAssemblyCanvasPointerMove({ clientX: 40, clientY: 24 });
  handleWindowPointerUp({ clientX: 40, clientY: 24 });
  const afterBoxSelect = countAssemblyBlocks();
  const stockAfterBoxSelect = state.palette.find((block) => block.id === "c1").stock;
  const markedAfterBoxSelect = [...state.assemblyMarked].sort();

  state.assemblyMarked = new Set();
  state.palette.find((block) => block.id === "c1").stock = 10;
  state.assemblySelectedBlockId = "c1";
  beginAssemblyTouchTrail({ x: 0, y: 0 }, 9);
  markAssemblyTrailTo({ x: 2, y: 0 });
  finishAssemblyTouchTrail();
  const afterTouchTrail = countAssemblyBlocks();
  const stockAfterTouchTrail = state.palette.find((block) => block.id === "c1").stock;
  const markedAfterTouchTrail = [...state.assemblyMarked].sort();

  state.assemblyMarked = new Set(["0,0", "2,0", "1,1"]);
  saveAssemblyProgress();
  locateAssemblyBlock("c1");
  const completeNotice = els.assemblyNotice.textContent;
  saveAssemblyProgressManually();
  const manualSaved = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects))[0].assemblyProgress.marked;
  const manualSaveStatus = els.assemblyProgressStatus.textContent;

  const normalized = normalizeAssemblyProgress({ marked: ["0,0", "99,99", "bad", "0,0"] }, matrix);
  ({
    marked: afterMark.marked,
    remaining: afterMark.remaining,
    stockAfterMark,
    stockAfterUnmark,
    stockAfterBoxSelect,
    blueAfterWrongClick,
    selectedAfterWrongClick,
    defaultMajorGrid,
    fiveMajorGrid,
    hiddenMajorGrid,
    saved,
    located,
    zoomAfterLocate,
    scrollAfterLocate,
    redAfterBoxSelect: afterBoxSelect.get("c1"),
    blueAfterBoxSelect: afterBoxSelect.get("c2"),
    markedAfterBoxSelect,
    redAfterTouchTrail: afterTouchTrail.get("c1"),
    blueAfterTouchTrail: afterTouchTrail.get("c2"),
    stockAfterTouchTrail,
    markedAfterTouchTrail,
    summaryMarkup,
    paletteOrderByRemaining,
    manualSaved,
    manualSaveStatus,
    completeNotice,
    normalizedMarked: normalized.marked
  });
`, context);

assert.strictEqual(result.marked, 1, "marking a cell should increment completed count");
assert.strictEqual(result.remaining, 2, "remaining count should subtract completed cells");
assert.strictEqual(result.stockAfterMark, 9, "marking a cell should deduct one inventory bead");
assert.strictEqual(result.stockAfterUnmark, 10, "unmarking a cell should return one inventory bead");
assert.strictEqual(result.blueAfterWrongClick.marked, 0, "clicking a different color should not mark it");
assert.strictEqual(result.selectedAfterWrongClick, "c1", "canvas clicks should not switch the selected assembly color");
assert.strictEqual(result.defaultMajorGrid, "10", "assembly major grid should default to 10 cells");
assert.strictEqual(result.fiveMajorGrid, "5", "assembly major grid should support 5-cell divisions");
assert.strictEqual(result.hiddenMajorGrid, 0, "assembly major grid should support hidden state");
assert.strictEqual(JSON.stringify(result.saved), JSON.stringify(["0,0"]), "assembly progress should persist on the project");
assert.strictEqual(JSON.stringify(result.located), JSON.stringify({ x: 2, y: 0 }), "locate should scan from top-left to bottom-right");
assert.strictEqual(result.zoomAfterLocate, 16, "locate should keep the current zoom level");
assert.ok(result.scrollAfterLocate >= 0, "locate should keep scroll position valid");
assert.strictEqual(result.redAfterBoxSelect.marked, 3, "box select should mark all selected-color cells in range");
assert.strictEqual(result.blueAfterBoxSelect.marked, 0, "box select should not mark other colors");
assert.strictEqual(result.stockAfterBoxSelect, 7, "box select should deduct newly marked matching cells");
assert.strictEqual(JSON.stringify(result.markedAfterBoxSelect), JSON.stringify(["0,0", "1,1", "2,0"]), "box select should store only selected-color cells");
assert.strictEqual(result.redAfterTouchTrail.marked, 2, "touch trail should mark selected-color cells along the path");
assert.strictEqual(result.blueAfterTouchTrail.marked, 0, "touch trail should ignore different colors along the path");
assert.strictEqual(result.stockAfterTouchTrail, 8, "touch trail should deduct newly marked matching cells");
assert.strictEqual(JSON.stringify(result.markedAfterTouchTrail), JSON.stringify(["0,0", "2,0"]), "touch trail should only store selected-color cells");
assert.ok(result.summaryMarkup.includes("summary-item"), "summary should group each metric with its label");
assert.ok(result.summaryMarkup.indexOf("已拼") < result.summaryMarkup.indexOf("剩余"), "summary should label completed before remaining");
assert.ok(result.paletteOrderByRemaining[0].includes("02") && result.paletteOrderByRemaining[0].includes("蓝"), "palette rows should sort by remaining count descending");
assert.strictEqual(JSON.stringify(result.manualSaved), JSON.stringify(["0,0", "2,0", "1,1"]), "manual save should persist current assembly marks");
assert.ok(/^\d+\/\d+$/.test(result.manualSaveStatus), "manual save should keep the compact mobile progress status");
assert.ok(result.completeNotice.includes("已全部完成"), "complete colors should show a completion notice");
assert.strictEqual(JSON.stringify(result.normalizedMarked), JSON.stringify(["0,0"]), "normalization should remove invalid and duplicate marks");

console.log("Assembly workflow check passed.");
