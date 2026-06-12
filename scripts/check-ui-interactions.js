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

  contains(name) {
    return this.items.has(name);
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
    this.title = "";
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.attributes = {};
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  setPointerCapture() {}

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 500, height: 400 };
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
      fillText() {},
      drawImage() {},
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {}
    };
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

vm.runInContext(`
  Object.assign(els, {
    appShell: new MockElement(),
    workspaceGrid: new MockElement(),
    controlPanel: new MockElement(),
    railCollapseBtn: new MockElement("button"),
    controlPanelToggle: new MockElement("button"),
    canvasScroll: new MockElement(),
    pixelCanvas: new MockElement("canvas"),
    zoomRange: new MockElement("input"),
    zoomValue: new MockElement("strong")
  });

  Object.assign(els, {
    cropZoom: new MockElement("input"),
    cropZoomValue: new MockElement("strong"),
    cropX: new MockElement("input"),
    cropXValue: new MockElement("small"),
    cropY: new MockElement("input"),
    cropYValue: new MockElement("small"),
    pixelWidth: new MockElement("input"),
    pixelHeight: new MockElement("input"),
    cursorStatus: new MockElement("div")
  });

  state.ui = { railCollapsed: true, controlPanelCollapsed: true };
  updateUiLayout();

  state.palette = [{ id: "c1", code: "01", name: "红", rgb: [255, 0, 0], status: "active" }];
  state.projectPaletteSnapshot = null;
  state.matrix = { width: 2, height: 2, rows: [["c1", "c1"], ["c1", "c1"]] };
  state.zoom = 10;
  els.canvasScroll.scrollLeft = 20;
  els.canvasScroll.scrollTop = 10;
  let prevented = false;
  handleCanvasWheel({
    ctrlKey: true,
    deltaY: -120,
    clientX: 100,
    clientY: 90,
    preventDefault: () => { prevented = true; }
  });

  handlePanPointerDown({ button: 1, clientX: 100, clientY: 100, pointerId: 1, preventDefault() {} });
  handlePanPointerMove({ clientX: 80, clientY: 70, preventDefault() {} });

  state.matrix = null;
  state.image = { width: 800, height: 600 };
  state.cropMode = "manual";
  state.cropZoom = 100;
  state.cropX = 0;
  state.cropY = 0;
  els.pixelWidth.value = 64;
  els.pixelHeight.value = 64;
  els.pixelCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 375 });
  let cropWheelPrevented = false;
  handleCropWheel({ deltaY: -24, preventDefault: () => { cropWheelPrevented = true; } });
  handleCropPointerDown({ button: 0, clientX: 250, clientY: 180, pointerId: 2, preventDefault() {} });
  handleCropPointerMove({ clientX: 300, clientY: 210, preventDefault() {} });

  ({
    railCollapsedClass: els.appShell.classList.contains("rail-collapsed"),
    controlsCollapsedClass: els.workspaceGrid.classList.contains("controls-collapsed"),
    controlCollapsedClass: els.controlPanel.classList.contains("collapsed"),
    zoom: state.zoom,
    zoomValue: els.zoomValue.textContent,
    wheelPrevented: prevented,
    panning: state.isPanning,
    panScrollLeft: els.canvasScroll.scrollLeft,
    panScrollTop: els.canvasScroll.scrollTop,
    cropZoom: state.cropZoom,
    cropX: state.cropX,
    cropY: state.cropY,
    cropWheelPrevented,
    cropDragging: state.isCropDragging
  });
`, context);

const result = vm.runInContext(`({
  railCollapsedClass: els.appShell.classList.contains("rail-collapsed"),
  controlsCollapsedClass: els.workspaceGrid.classList.contains("controls-collapsed"),
  controlCollapsedClass: els.controlPanel.classList.contains("collapsed"),
  zoom: state.zoom,
  zoomValue: els.zoomValue.textContent,
  wheelPrevented: prevented,
  panning: state.isPanning,
  panScrollLeft: els.canvasScroll.scrollLeft,
  panScrollTop: els.canvasScroll.scrollTop,
  cropZoom: state.cropZoom,
  cropX: state.cropX,
  cropY: state.cropY,
  cropWheelPrevented,
  cropDragging: state.isCropDragging
})`, context);

assert.strictEqual(result.railCollapsedClass, true, "rail collapsed class should be applied");
assert.strictEqual(result.controlsCollapsedClass, true, "workspace collapsed class should be applied");
assert.strictEqual(result.controlCollapsedClass, true, "control panel collapsed class should be applied");
assert.ok(result.zoom > 10, "pinch wheel should increase zoom");
assert.ok(result.zoomValue.includes("px/格"), "zoom label should update");
assert.strictEqual(result.wheelPrevented, true, "pinch wheel should prevent browser zoom");
assert.strictEqual(result.panning, true, "middle pointer should start panning");
assert.ok(result.panScrollLeft > 0, "panning should update horizontal scroll");
assert.ok(result.panScrollTop > 0, "panning should update vertical scroll");
assert.ok(result.cropZoom > 100, "crop wheel should increase manual crop zoom");
assert.notStrictEqual(result.cropX, 0, "crop dragging should update horizontal crop offset");
assert.notStrictEqual(result.cropY, 0, "crop dragging should update vertical crop offset");
assert.strictEqual(result.cropWheelPrevented, true, "crop wheel should prevent page scroll");
assert.strictEqual(result.cropDragging, true, "crop pointer should enter crop dragging mode");

console.log("UI interaction check passed.");
