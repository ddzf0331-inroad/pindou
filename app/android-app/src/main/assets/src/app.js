const STORAGE_KEYS = {
  palette: "pixelToy.palette.v1",
  projects: "pixelToy.projects.v1",
  settings: "pixelToy.settings.v1",
  ui: "pixelToy.ui.v1",
  bundledDefaults: "pixelToy.bundledDefaults.v1",
  userDataTouched: "pixelToy.userDataTouched.v1"
};

const DEFAULT_PALETTE = [
  { id: "c01", code: "01", name: "雪白", rgb: [248, 248, 240], status: "active" },
  { id: "c02", code: "02", name: "奶油黄", rgb: [245, 216, 92], status: "active" },
  { id: "c03", code: "03", name: "橙色", rgb: [235, 128, 45], status: "active" },
  { id: "c04", code: "04", name: "珊瑚红", rgb: [210, 76, 70], status: "active" },
  { id: "c05", code: "05", name: "玫红", rgb: [212, 82, 132], status: "active" },
  { id: "c06", code: "06", name: "浅粉", rgb: [246, 176, 190], status: "active" },
  { id: "c07", code: "07", name: "湖蓝", rgb: [62, 157, 190], status: "active" },
  { id: "c08", code: "08", name: "深蓝", rgb: [36, 75, 145], status: "active" },
  { id: "c09", code: "09", name: "草绿", rgb: [82, 160, 90], status: "active" },
  { id: "c10", code: "10", name: "深绿", rgb: [38, 105, 76], status: "active" },
  { id: "c11", code: "11", name: "浅棕", rgb: [178, 126, 78], status: "active" },
  { id: "c12", code: "12", name: "黑色", rgb: [34, 36, 40], status: "active" }
];

const DEFAULT_SETTINGS = {
  activeConfigId: "local-default",
  configs: [
    {
      id: "local-default",
      name: "本地模拟",
      provider: "local",
      model: "local-cartoon-preprocess",
      endpoint: "",
      apiKey: "",
      apiKeyPresent: false,
      prompt: "保留主体轮廓，减少渐变和杂色，输出适合像素化的清晰卡通图片。",
      enabled: false
    }
  ]
};

const LOW_STOCK_THRESHOLD = 100;
const DEFAULT_DELTA_THRESHOLD = 28;
let appFeedbackTimer = null;

const state = {
  serverMode: false,
  runtimeMode: "static",
  publicMode: false,
  auth: { checked: false, required: false, authenticated: true },
  activePanel: "dashboard",
  inputType: "cartoon",
  image: null,
  sourceName: "",
  currentProjectId: null,
  palette: loadJson(STORAGE_KEYS.palette, DEFAULT_PALETTE),
  projects: loadJson(STORAGE_KEYS.projects, []),
  settings: loadJson(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
  paletteLimit: loadJson("pixelToy.paletteLimit.v1", DEFAULT_PALETTE.length),
  matrix: null,
  candidateStatus: "empty",
  candidates: [],
  projectPaletteSnapshot: null,
  patternParse: null,
  risks: [],
  generationPaletteIds: new Set(loadJson(STORAGE_KEYS.ui, {}).generationPaletteIds || []),
  generationPaletteStats: new Map(),
  selectedBlockId: null,
  editingBlockId: null,
  activeTool: "inspect",
  paintBlockId: null,
  isPainting: false,
  history: [],
  zoom: 10,
  showGrid: true,
  showLabels: true,
  cropMode: "cover",
  cropZoom: 100,
  cropX: 0,
  cropY: 0,
  ui: loadJson(STORAGE_KEYS.ui, { railCollapsed: false, controlPanelCollapsed: false }),
  spaceDown: false,
  isPanning: false,
  panStart: null,
  canvasPinch: null,
  canvasTouchPan: null,
  cropPinch: null,
  isCropDragging: false,
  cropDragStart: null,
  suppressNextCanvasClick: false,
  assemblyProjectId: null,
  assemblyMatrix: null,
  assemblyPaletteSnapshot: null,
  assemblyMarked: new Set(),
  assemblySelectedBlockId: null,
  assemblyZoom: 16,
  assemblyShowGrid: true,
  assemblyMajorGridSize: 10,
  assemblyShowLabels: false,
  assemblyLocatedCell: null,
  isAssemblySelecting: false,
  assemblySelection: null,
  assemblyTouchTrail: null,
  assemblyLongPress: null,
  assemblyLongPressTimer: null,
  assemblyTouchPan: null,
  isAssemblyPanning: false,
  assemblyPanStart: null,
  assemblyPinch: null,
  suppressNextAssemblyClick: false,
  stockAdjustDirection: 1
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  bindEvents();
  initializeApp();
});

async function initializeApp() {
  await loadBundledDefaults();
  await loadAuthStatus();
  if (state.auth.required && !state.auth.authenticated) {
    renderAuthGate();
    return;
  }
  await loadServerState();
  renderAll();
  updateRuntimeControls();
  updateUiLayout();
}

function bindElements() {
  [
    "dashboardOpenGalleryBtn",
    "dashboardOpenPaletteBtn",
    "authGate",
    "authForm",
    "authPassword",
    "authNotice",
    "appToast",
    "mobileDashboardGalleryBtn",
    "mobileDashboardPaletteBtn",
    "dashboardGalleryStats",
    "dashboardAssemblyStats",
    "dashboardInventoryNotice",
    "dashboardLowStockList",
    "imageInput",
    "appShell",
    "railCollapseBtn",
    "workspaceGrid",
    "controlPanel",
    "controlPanelToggle",
    "runtimeBanner",
    "parsePatternSheetBtn",
    "patternSheetInput",
    "patternParseNotice",
    "migrateLocalBtn",
    "projectName",
    "pixelWidth",
    "pixelHeight",
    "presetSelect",
    "maxColorTypes",
    "maxColorTypesHint",
    "openPalettePlanBtn",
    "palettePlanSummary",
    "palettePlanHint",
    "palettePlanSwatches",
    "palettePlanModal",
    "closePalettePlanBtn",
    "analyzePalettePlanBtn",
    "selectAllPalettePlanBtn",
    "clearPalettePlanBtn",
    "palettePlanNotice",
    "palettePlanCount",
    "palettePlanIndexBar",
    "palettePlanList",
    "cropMode",
    "cropZoom",
    "cropZoomValue",
    "cropX",
    "cropXValue",
    "cropY",
    "cropYValue",
    "zoomRange",
    "zoomValue",
    "gridToggle",
    "labelToggle",
    "generateBtn",
    "mobileGenerateBtn",
    "regenerateBtn",
    "workspaceConfigFab",
    "workspaceActionsFab",
    "workspaceStatsFab",
    "workspaceActionsSheet",
    "closeWorkspaceActionsBtn",
    "closeWorkspaceStatsBtn",
    "mobileRegenerateResultBtn",
    "mobileSaveResultBtn",
    "mobileExportResultBtn",
    "pipelineNotice",
    "canvasScroll",
    "pixelCanvas",
    "matrixStatus",
    "riskStatus",
    "usedPalette",
    "candidateHistory",
    "riskList",
    "paintBlockSelect",
    "cursorStatus",
    "replacementSelect",
    "replacementOptions",
    "replaceBtn",
    "undoBtn",
    "saveProjectBtn",
    "mobileSaveProjectBtn",
    "exportBtn",
    "mobileExportBtn",
    "addColorBtn",
    "mobileAddColorBtn",
    "paletteLimit",
    "paletteLimitNotice",
    "paletteEditorTitle",
    "paletteIndexBar",
    "importPaletteBtn",
    "downloadPaletteTemplateBtn",
    "exportPaletteBtn",
    "mobileExportPaletteBtn",
    "openStockBatchBtn",
    "mobileStockBatchBtn",
    "paletteImportInput",
    "importProjectBtn",
    "mobileImportProjectBtn",
    "exportAllProjectsBtn",
    "mobileExportAllProjectsBtn",
    "projectImportInput",
    "blockCode",
    "blockName",
    "blockColor",
    "colorMap",
    "blockColorPreview",
    "blockColorValue",
    "blockR",
    "blockG",
    "blockB",
    "blockStock",
    "stockAddAmount",
    "addStockBtn",
    "deductStockBtn",
    "stockNotice",
    "stockAdjustModal",
    "closeStockAdjustBtn",
    "cancelStockAdjustBtn",
    "confirmStockAdjustBtn",
    "stockAdjustTitle",
    "stockAdjustTarget",
    "stockAdjustAmount",
    "stockAdjustNotice",
    "stockBatchModal",
    "closeStockBatchBtn",
    "stockBatchMode",
    "stockBatchScope",
    "stockBatchAmount",
    "stockBatchNotice",
    "applyStockBatchBtn",
    "disableColorBtn",
    "deleteColorBtn",
    "saveColorBtn",
    "closePaletteEditorBtn",
    "paletteTable",
    "galleryGrid",
    "assemblyOpenGalleryBtn",
    "mobileAssemblyGalleryBtn",
    "assemblySaveProgressBtn",
    "assemblyStatsToggleBtn",
    "mobileAssemblySaveBtn",
    "assemblyStatsFab",
    "closeAssemblyStatsBtn",
    "assemblyActionsFab",
    "assemblyActionsSheet",
    "closeAssemblyActionsBtn",
    "mobileAssemblyChooseProjectBtn",
    "mobileAssemblySaveProgressBtn",
    "assemblyProjectStatus",
    "assemblyProgressStatus",
    "assemblyMajorGridSelect",
    "assemblyCanvasScroll",
    "assemblyCanvas",
    "assemblyNotice",
    "assemblySummary",
    "assemblyUsedPalette",
    "aiConfigSelect",
    "aiProvider",
    "aiModel",
    "aiEndpoint",
    "aiKey",
    "aiPrompt",
    "aiEnabled",
    "addAiConfigBtn",
    "deleteAiConfigBtn",
    "testAiBtn",
    "diagnosticsBtn",
    "openDataDirBtn",
    "backupAllBtn",
    "restoreAllInput",
    "restoreAllBtn",
    "saveAiBtn",
    "mobileSaveAiBtn",
    "aiNotice",
    "mobileTestAiBtn",
    "diagnosticsPanel"
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchPanel(button.dataset.panel));
  });

  els.dashboardOpenGalleryBtn.addEventListener("click", () => switchPanel("gallery"));
  els.dashboardOpenPaletteBtn.addEventListener("click", () => switchPanel("palette"));
  els.authForm.addEventListener("submit", handleAuthSubmit);
  els.mobileDashboardGalleryBtn.addEventListener("click", () => switchPanel("gallery"));
  els.mobileDashboardPaletteBtn.addEventListener("click", () => switchPanel("palette"));
  document.querySelectorAll("[data-dashboard-target]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest(".low-stock-row")) return;
      switchPanel(card.dataset.dashboardTarget);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      switchPanel(card.dataset.dashboardTarget);
    });
  });

  els.railCollapseBtn.addEventListener("click", () => {
    state.ui.railCollapsed = !state.ui.railCollapsed;
    saveUiState();
    updateUiLayout();
  });

  els.controlPanelToggle.addEventListener("click", () => {
    if (isMobileLayout()) {
      toggleWorkspaceConfig(false);
      return;
    }
    state.ui.controlPanelCollapsed = !state.ui.controlPanelCollapsed;
    saveUiState();
    updateUiLayout();
  });

  els.imageInput.addEventListener("change", handleImageInput);
  els.parsePatternSheetBtn.addEventListener("click", () => {
    if (!state.serverMode) {
      setPatternParseNotice("图纸解析需要通过本机服务或私有网页版使用，静态 file 模式暂不支持。");
      showAppFeedback("请通过服务地址使用图纸解析", "warn");
      return;
    }
    els.patternSheetInput.click();
  });
  els.patternSheetInput.addEventListener("change", handlePatternSheetInput);
  els.migrateLocalBtn.addEventListener("click", migrateLocalStorageToServer);
  els.presetSelect.addEventListener("change", () => {
    const [width, height] = els.presetSelect.value.split("x").map(Number);
    els.pixelWidth.value = width;
    els.pixelHeight.value = height;
  });

  els.maxColorTypes.addEventListener("input", () => {
    state.ui.maxColorTypes = normalizeMaxColorTypesInput();
    saveUiState();
    updateMaxColorTypesHint();
  });
  els.openPalettePlanBtn.addEventListener("click", openPalettePlanModal);
  els.closePalettePlanBtn.addEventListener("click", closePalettePlanModal);
  els.palettePlanModal.addEventListener("click", (event) => {
    if (event.target === els.palettePlanModal) closePalettePlanModal();
  });
  els.analyzePalettePlanBtn.addEventListener("click", analyzePalettePlanFromImage);
  els.selectAllPalettePlanBtn.addEventListener("click", selectAllPalettePlan);
  els.clearPalettePlanBtn.addEventListener("click", clearPalettePlan);

  els.cropMode.addEventListener("change", () => {
    state.cropMode = els.cropMode.value;
    updateCropLabels();
    drawSourcePreview();
  });

  els.cropZoom.addEventListener("input", () => {
    state.cropZoom = Number(els.cropZoom.value);
    updateCropLabels();
    drawSourcePreview();
  });

  [els.cropX, els.cropY].forEach((input) => {
    input.addEventListener("input", () => {
      state.cropX = Number(els.cropX.value);
      state.cropY = Number(els.cropY.value);
      updateCropLabels();
      drawSourcePreview();
    });
  });

  els.zoomRange.addEventListener("input", () => {
    setCanvasZoom(Number(els.zoomRange.value));
    renderCanvas();
  });

  els.gridToggle.addEventListener("change", () => {
    state.showGrid = els.gridToggle.checked;
    renderCanvas();
  });

  els.labelToggle.addEventListener("change", () => {
    state.showLabels = els.labelToggle.checked;
    renderCanvas();
  });

  els.generateBtn.addEventListener("click", () => {
    if (isMobileLayout()) toggleWorkspaceConfig(false);
    generatePixelArt();
  });
  els.mobileGenerateBtn.addEventListener("click", generatePixelArt);
  els.regenerateBtn.addEventListener("click", generatePixelArt);
  els.workspaceConfigFab.addEventListener("click", () => toggleWorkspaceConfig(true));
  els.workspaceActionsFab.addEventListener("click", () => toggleWorkspaceActions(true));
  els.workspaceStatsFab.addEventListener("click", () => toggleWorkspaceStats(true));
  els.closeWorkspaceActionsBtn.addEventListener("click", () => toggleWorkspaceActions(false));
  els.closeWorkspaceStatsBtn.addEventListener("click", () => toggleWorkspaceStats(false));
  els.mobileRegenerateResultBtn.addEventListener("click", () => {
    toggleWorkspaceActions(false);
    generatePixelArt();
  });
  els.mobileSaveResultBtn.addEventListener("click", () => {
    toggleWorkspaceActions(false);
    saveProject();
  });
  els.mobileExportResultBtn.addEventListener("click", () => {
    toggleWorkspaceActions(false);
    exportProductionFiles();
  });
  els.pixelCanvas.addEventListener("click", handleCanvasClick);
  els.pixelCanvas.addEventListener("pointerdown", handleCanvasPointerDown);
  els.pixelCanvas.addEventListener("pointermove", handleCanvasPointerMove);
  els.canvasScroll.addEventListener("wheel", handleCanvasWheel, { passive: false });
  els.canvasScroll.addEventListener("touchstart", handleCanvasTouchStart, { passive: false });
  els.canvasScroll.addEventListener("touchmove", handleCanvasTouchMove, { passive: false });
  els.canvasScroll.addEventListener("touchend", handleCanvasTouchEnd);
  els.canvasScroll.addEventListener("touchcancel", handleCanvasTouchEnd);
  els.canvasScroll.addEventListener("pointerdown", handlePanPointerDown);
  els.canvasScroll.addEventListener("pointermove", handlePanPointerMove);
  els.canvasScroll.addEventListener("pointerleave", () => {
    if (!state.isPanning) els.canvasScroll.classList.remove("panning");
  });
  window.addEventListener("pointerup", handleWindowPointerUp);
  window.addEventListener("keydown", handleWindowKeyDown);
  window.addEventListener("keyup", handleWindowKeyUp);
  window.addEventListener("blur", () => {
    state.spaceDown = false;
    state.isPanning = false;
    state.isPainting = false;
    updatePanCursor();
  });
  document.querySelectorAll(".tool-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTool = button.dataset.tool;
      document.querySelectorAll(".tool-button").forEach((item) => item.classList.toggle("active", item === button));
      renderCanvas();
    });
  });
  els.paintBlockSelect.addEventListener("change", () => {
    state.paintBlockId = els.paintBlockSelect.value;
    state.selectedBlockId = state.paintBlockId;
    renderCanvas();
    renderStats();
  });
  els.replaceBtn.addEventListener("click", replaceSelectedColor);
  els.undoBtn.addEventListener("click", undoLastEdit);
  els.saveProjectBtn.addEventListener("click", saveProject);
  els.mobileSaveProjectBtn.addEventListener("click", saveProject);
  els.exportBtn.addEventListener("click", exportProductionFiles);
  els.mobileExportBtn.addEventListener("click", exportProductionFiles);
  els.importPaletteBtn.addEventListener("click", () => els.paletteImportInput.click());
  els.downloadPaletteTemplateBtn.addEventListener("click", downloadPaletteTemplate);
  els.exportPaletteBtn.addEventListener("click", exportPalette);
  els.mobileExportPaletteBtn.addEventListener("click", exportPalette);
  els.openStockBatchBtn.addEventListener("click", openStockBatchModal);
  els.mobileStockBatchBtn.addEventListener("click", openStockBatchModal);
  els.paletteImportInput.addEventListener("change", importPalette);
  els.importProjectBtn.addEventListener("click", () => els.projectImportInput.click());
  els.mobileImportProjectBtn.addEventListener("click", () => els.projectImportInput.click());
  els.exportAllProjectsBtn.addEventListener("click", exportAllProjects);
  els.mobileExportAllProjectsBtn.addEventListener("click", exportAllProjects);
  els.projectImportInput.addEventListener("change", importProject);
  els.assemblyOpenGalleryBtn.addEventListener("click", () => switchPanel("gallery"));
  els.mobileAssemblyGalleryBtn.addEventListener("click", () => switchPanel("gallery"));
  els.assemblySaveProgressBtn.addEventListener("click", saveAssemblyProgressManually);
  els.assemblyStatsToggleBtn.addEventListener("click", () => {
    state.ui.assemblyStatsCollapsed = !state.ui.assemblyStatsCollapsed;
    saveUiState();
    updateUiLayout();
  });
  els.mobileAssemblySaveBtn.addEventListener("click", saveAssemblyProgressManually);
  els.assemblyStatsFab.addEventListener("click", () => toggleAssemblyStats(true));
  els.closeAssemblyStatsBtn.addEventListener("click", () => toggleAssemblyStats(false));
  els.assemblyActionsFab.addEventListener("click", () => toggleAssemblyActions(true));
  els.closeAssemblyActionsBtn.addEventListener("click", () => toggleAssemblyActions(false));
  els.mobileAssemblyChooseProjectBtn.addEventListener("click", () => {
    toggleAssemblyActions(false);
    switchPanel("gallery");
  });
  els.mobileAssemblySaveProgressBtn.addEventListener("click", () => {
    toggleAssemblyActions(false);
    saveAssemblyProgressManually();
  });
  els.assemblyMajorGridSelect.addEventListener("change", () => {
    state.assemblyMajorGridSize = Number(els.assemblyMajorGridSelect.value);
    renderAssemblyCanvas();
  });
  els.assemblyCanvas.addEventListener("click", handleAssemblyCanvasClick);
  els.assemblyCanvas.addEventListener("pointerdown", handleAssemblyCanvasPointerDown);
  els.assemblyCanvas.addEventListener("pointermove", handleAssemblyCanvasPointerMove);
  els.assemblyCanvasScroll.addEventListener("wheel", handleAssemblyCanvasWheel, { passive: false });
  els.assemblyCanvasScroll.addEventListener("touchstart", handleAssemblyTouchStart, { passive: false });
  els.assemblyCanvasScroll.addEventListener("touchmove", handleAssemblyTouchMove, { passive: false });
  els.assemblyCanvasScroll.addEventListener("touchend", handleAssemblyTouchEnd);
  els.assemblyCanvasScroll.addEventListener("touchcancel", handleAssemblyTouchEnd);
  els.assemblyCanvasScroll.addEventListener("pointerdown", handleAssemblyPanPointerDown);
  els.assemblyCanvasScroll.addEventListener("pointermove", handleAssemblyPanPointerMove);
  els.assemblyCanvasScroll.addEventListener("pointerleave", () => {
    if (!state.isAssemblyPanning) els.assemblyCanvasScroll.classList.remove("panning");
  });
  els.saveAiBtn.addEventListener("click", saveAiSettings);
  els.mobileSaveAiBtn.addEventListener("click", saveAiSettings);
  els.testAiBtn.addEventListener("click", testAiSettings);
  els.mobileTestAiBtn.addEventListener("click", testAiSettings);
  els.diagnosticsBtn.addEventListener("click", runDiagnostics);
  els.openDataDirBtn.addEventListener("click", openDataDir);
  els.backupAllBtn.addEventListener("click", backupAllData);
  els.restoreAllBtn.addEventListener("click", () => els.restoreAllInput.click());
  els.restoreAllInput.addEventListener("change", restoreFullBackup);
  els.addAiConfigBtn.addEventListener("click", addAiConfig);
  els.deleteAiConfigBtn.addEventListener("click", deleteAiConfig);
  els.aiConfigSelect.addEventListener("change", () => {
    saveAiFormToActiveConfig(false);
    state.settings.activeConfigId = els.aiConfigSelect.value;
    renderAiSettings();
  });

  els.addColorBtn.addEventListener("click", () => {
    addNewPaletteColor();
  });
  els.mobileAddColorBtn.addEventListener("click", () => {
    addNewPaletteColor();
  });
  els.paletteLimit.addEventListener("input", () => {
    state.paletteLimit = clamp(Number(els.paletteLimit.value), 1, 999);
    savePaletteLimit();
    renderPaletteEditor();
  });

  els.saveColorBtn.addEventListener("click", saveEditingColor);
  els.addStockBtn.addEventListener("click", () => openStockAdjustModal(1));
  els.deductStockBtn.addEventListener("click", () => openStockAdjustModal(-1));
  els.closeStockAdjustBtn.addEventListener("click", closeStockAdjustModal);
  els.cancelStockAdjustBtn.addEventListener("click", closeStockAdjustModal);
  els.confirmStockAdjustBtn.addEventListener("click", confirmStockAdjustModal);
  els.stockAdjustModal.addEventListener("click", (event) => {
    if (event.target === els.stockAdjustModal) closeStockAdjustModal();
  });
  els.closeStockBatchBtn.addEventListener("click", closeStockBatchModal);
  els.stockBatchModal.addEventListener("click", (event) => {
    if (event.target === els.stockBatchModal) closeStockBatchModal();
  });
  els.stockBatchMode.addEventListener("change", updateStockBatchNotice);
  els.stockBatchScope.addEventListener("change", updateStockBatchNotice);
  els.stockBatchAmount.addEventListener("input", updateStockBatchNotice);
  els.applyStockBatchBtn.addEventListener("click", applyStockBatchOperation);
  els.disableColorBtn.addEventListener("click", disableEditingColor);
  els.deleteColorBtn.addEventListener("click", deleteEditingColor);
  els.closePaletteEditorBtn.addEventListener("click", () => togglePaletteEditor(false));

  els.blockColor.addEventListener("input", () => {
    const rgb = hexToRgb(els.blockColor.value);
    setRgbInputs(rgb);
    updateColorPreview(rgb);
    renderColorMap(rgb);
  });

  [els.blockR, els.blockG, els.blockB].forEach((input) => {
    input.addEventListener("input", () => {
      const rgb = getRgbInputs();
      els.blockColor.value = rgbToHex(rgb);
      updateColorPreview(rgb);
      renderColorMap(rgb);
    });
  });
  els.blockStock.addEventListener("input", () => {
    const block = state.palette.find((item) => item.id === state.editingBlockId);
    if (!block) return;
    block.stock = normalizeStock(els.blockStock.value);
    savePalette();
    renderPaletteEditor();
    renderDashboard();
  });
  els.colorMap.addEventListener("click", handleColorMapClick);
}

function addNewPaletteColor() {
  if (activePaletteCount() >= state.paletteLimit) {
    els.paletteLimitNotice.textContent = `已达到可用色块上限 ${state.paletteLimit}，请提高上限或禁用部分色块。`;
    return;
  }
  const id = `c${Date.now()}`;
  state.palette.push({ id, code: nextCode(), name: "新色块", rgb: [120, 160, 180], status: "active" });
  state.editingBlockId = id;
  savePalette();
  renderPaletteEditor();
  revealPaletteEditorOnMobile();
}

function switchPanel(panelName) {
  closeStockAdjustModal();
  toggleWorkspaceConfig(false);
  togglePaletteEditor(false);
  toggleWorkspaceActions(false);
  toggleWorkspaceStats(false);
  toggleAssemblyActions(false);
  toggleAssemblyStats(false);
  setActivePanel(panelName);
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.panel === panelName);
  });
  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${panelName}-panel`);
  });
  if (panelName === "assembly") {
    const currentProject = state.projects.find((project) => project.id === state.currentProjectId);
    if (!state.assemblyProjectId && currentProject) loadAssemblyProject(currentProject);
    renderAssemblyPage();
  }
  if (panelName === "dashboard") renderDashboard();
  updateMobileActions();
  scrollActivePanelToTop();
}

function toggleWorkspaceStats(open) {
  const statsPanel = document.querySelector(".workspace-stats");
  if (!statsPanel) return;
  if (open) {
    toggleWorkspaceActions(false);
    toggleWorkspaceConfig(false);
  }
  statsPanel.classList.toggle("open", open);
}

function toggleWorkspaceActions(open) {
  if (!els.workspaceActionsSheet) return;
  if (open) {
    toggleWorkspaceStats(false);
    toggleWorkspaceConfig(false);
  }
  els.workspaceActionsSheet.hidden = !open;
  els.workspaceActionsSheet.classList.toggle("open", open);
}

function toggleWorkspaceConfig(open) {
  if (!els.controlPanel) return;
  if (open) {
    toggleWorkspaceActions(false);
    toggleWorkspaceStats(false);
  }
  els.controlPanel.classList.toggle("open", open);
  els.appShell?.classList.toggle("workspace-config-open", open);
}

function toggleAssemblyActions(open) {
  if (!els.assemblyActionsSheet) return;
  if (open) toggleAssemblyStats(false);
  els.assemblyActionsSheet.hidden = !open;
  els.assemblyActionsSheet.classList.toggle("open", open);
}

function toggleAssemblyStats(open) {
  const statsPanel = document.querySelector(".assembly-stats");
  if (!statsPanel) return;
  if (open) toggleAssemblyActions(false);
  statsPanel.classList.toggle("open", open);
  els.appShell?.classList.toggle("assembly-stats-open", open);
}

function isMobileLayout() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 840px)").matches;
}

function scrollActivePanelToTop() {
  if (!isMobileLayout()) return;
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function revealPaletteEditorOnMobile() {
  if (!isMobileLayout()) {
    scrollElementIntoMobileView(document.querySelector("#palette-panel .editor-form"));
    return;
  }
  togglePaletteEditor(true);
}

function togglePaletteEditor(open) {
  const editor = document.querySelector("#palette-panel .editor-form");
  if (!editor) return;
  editor.classList.toggle("open", open);
}

function scrollElementIntoMobileView(element) {
  if (!isMobileLayout() || !element) return;
  requestAnimationFrame(() => {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function showAppFeedback(message, type = "success") {
  if (!message) return;
  triggerNativeFeedback(type);
  if (!els.appToast) return;
  window.clearTimeout(appFeedbackTimer);
  els.appToast.textContent = message;
  els.appToast.className = `app-toast show ${type === "warn" ? "warn" : type === "error" ? "error" : "success"}`;
  appFeedbackTimer = window.setTimeout(() => {
    els.appToast.classList.remove("show");
  }, 2200);
}

function triggerNativeFeedback(type = "success") {
  if (window.PixelToyIOS && typeof window.PixelToyIOS.notify === "function") {
    window.PixelToyIOS.notify(type);
    return;
  }
  if (window.PixelToyAndroid && typeof window.PixelToyAndroid.notify === "function") {
    window.PixelToyAndroid.notify(type);
    return;
  }
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(type === "error" ? [20, 40, 20] : 18);
  }
}

function handleImageInput(event) {
  const file = event.target.files[0];
  if (!file) return;

  const image = new Image();
  image.onload = () => {
    setSourceImage(image, file.name);
  };
  image.src = URL.createObjectURL(file);
}

function setSourceImage(image, name) {
  state.image = image;
  state.sourceName = name;
  state.currentProjectId = null;
  els.projectName.value = name.replace(/\.[^.]+$/, "");
  state.matrix = null;
  state.candidateStatus = "empty";
  state.candidates = [];
  state.projectPaletteSnapshot = null;
  state.patternParse = null;
  state.history = [];
  state.selectedBlockId = null;
  state.risks = [];
  setPatternParseNotice("");
  els.matrixStatus.textContent = `已导入 ${name}`;
  renderStats();
  drawSourcePreview();
}

function setPatternParseNotice(message) {
  if (!els.patternParseNotice) return;
  els.patternParseNotice.textContent = message || "";
  els.patternParseNotice.hidden = !message;
}

function useSampleImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f8f8f0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#3e9dbe";
  ctx.beginPath();
  ctx.arc(320, 310, 210, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f5d85c";
  ctx.beginPath();
  ctx.arc(240, 260, 54, 0, Math.PI * 2);
  ctx.arc(400, 260, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222428";
  ctx.beginPath();
  ctx.arc(240, 270, 18, 0, Math.PI * 2);
  ctx.arc(400, 270, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d24c46";
  ctx.beginPath();
  ctx.arc(320, 370, 82, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#52a05a";
  ctx.fillRect(205, 475, 230, 48);
  const image = new Image();
  image.onload = () => {
    setSourceImage(image, "示例笑脸.png");
  };
  image.src = canvas.toDataURL("image/png");
}

async function handlePatternSheetInput(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (!state.serverMode) {
      setPatternParseNotice("图纸解析需要通过本机服务或私有网页版使用，静态 file 模式暂不支持。");
      showAppFeedback("请通过服务地址使用图纸解析", "warn");
      return;
    }
    const palette = state.palette.filter((block) => block.status !== "deleted").map(normalizeBlock).filter(Boolean);
    if (!palette.length) {
      setPatternParseNotice("色块库为空，无法解析图纸。");
      showAppFeedback("色块库为空", "warn");
      return;
    }
    setPatternParseNotice("正在解析图纸上半部分网格...");
    els.matrixStatus.textContent = "正在解析图纸...";
    const imageDataUrl = await readFileAsDataUrl(file);
    const result = await apiRequest("/api/parse-pattern-sheet", {
      method: "POST",
      body: {
        imageDataUrl,
        palette,
        expectedWidth: Number(els.pixelWidth.value) || 50,
        expectedHeight: Number(els.pixelHeight.value) || 50
      }
    });
    if (!result?.ok) {
      const message = result?.message || "图纸解析失败，请换一张更清晰的图纸。";
      setPatternParseNotice(message);
      els.matrixStatus.textContent = message;
      showAppFeedback("图纸解析失败", "error");
      return;
    }
    applyPatternSheetResult(result, file.name);
  } catch (error) {
    const message = error?.message || "图纸解析失败，请换一张更清晰的图纸。";
    setPatternParseNotice(message);
    els.matrixStatus.textContent = message;
    showAppFeedback("图纸解析失败", "error");
  } finally {
    event.target.value = "";
  }
}

function applyPatternSheetResult(result, fileName) {
  const matrix = result.matrix;
  if (!matrix?.width || !matrix?.height || !Array.isArray(matrix.rows)) {
    throw new Error("图纸解析结果格式不正确。");
  }
  const rows = matrix.rows.map((row) => row.map(String));
  if (rows.length !== matrix.height || rows.some((row) => row.length !== matrix.width)) {
    throw new Error("图纸解析结果尺寸不一致。");
  }

  const paletteSnapshot = (Array.isArray(result.paletteSnapshot) && result.paletteSnapshot.length ? result.paletteSnapshot : state.palette)
    .map(normalizeBlock)
    .filter(Boolean);
  const failures = Array.isArray(result.failures) ? result.failures : [];
  const lowConfidenceCells = Array.isArray(result.lowConfidenceCells) ? result.lowConfidenceCells : [];

  state.image = null;
  state.sourceName = fileName;
  state.currentProjectId = null;
  state.matrix = { width: Number(matrix.width), height: Number(matrix.height), rows };
  state.projectPaletteSnapshot = paletteSnapshot;
  state.patternParse = {
    failures,
    lowConfidenceCells,
    method: result.method || "local-grid-color-match",
    stats: result.stats || {}
  };
  state.candidateStatus = "pending";
  state.candidates = [];
  state.history = [];
  state.selectedBlockId = null;
  state.paintBlockId = getFirstUsedBlockId(state.matrix, paletteSnapshot);
  state.risks = summarizeRisks(
    lowConfidenceCells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      source: cell.source || [0, 0, 0],
      blockId: String(cell.blockId),
      distance: Number(cell.distance) || 0
    }))
  );
  state.zoom = Math.max(state.zoom, state.matrix.width <= 50 ? 12 : 8);
  els.projectName.value = fileName.replace(/\.[^.]+$/, "") || "解析图纸";
  els.pixelWidth.value = state.matrix.width;
  els.pixelHeight.value = state.matrix.height;
  const presetValue = `${state.matrix.width}x${state.matrix.height}`;
  if ([...els.presetSelect.options].some((option) => option.value === presetValue)) {
    els.presetSelect.value = presetValue;
  }
  addCandidateSnapshot();
  syncZoomControls();
  renderCanvas();
  renderStats();
  renderCandidateHistory();

  const stats = state.patternParse.stats;
  const detected = stats.detectedWidth && stats.detectedHeight ? `检测原图 ${stats.detectedWidth} x ${stats.detectedHeight}` : "";
  const placement =
    stats.contentOffsetX || stats.contentOffsetY
      ? `，已放入 ${state.matrix.width} x ${state.matrix.height} 画板并留边 ${stats.contentOffsetX || 0} 格`
      : "";
  const riskText = lowConfidenceCells.length ? `，${lowConfidenceCells.length} 格颜色差异较大` : "";
  const failText = failures.length ? `，${failures.length} 格需要修正后才能采纳` : "";
  els.matrixStatus.textContent = failures.length
    ? `图纸解析完成，但有 ${failures.length} 格需要修正`
    : `${state.matrix.width} x ${state.matrix.height}，图纸解析完成，等待采纳`;
  setPatternParseNotice(`${detected || "图纸已解析"}${placement}${riskText}${failText}。`);
  showAppFeedback("图纸解析完成");
}

function getFirstUsedBlockId(matrix, palette) {
  const usedIds = new Set(matrix.rows.flat().map(String));
  return palette.find((block) => usedIds.has(block.id) && block.status === "active")?.id || palette.find((block) => usedIds.has(block.id))?.id || null;
}

function drawSourcePreview() {
  if (!state.image) return;
  const canvas = els.pixelCanvas;
  const ctx = canvas.getContext("2d");
  const ratio = getSourcePreviewRatio();
  canvas.width = Math.max(1, Math.round(state.image.width * ratio));
  canvas.height = Math.max(1, Math.round(state.image.height * ratio));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);

  const crop = getSourceCrop(state.image.width, state.image.height, Number(els.pixelWidth.value), Number(els.pixelHeight.value));
  if (crop.mode !== "contain") {
    const cropX = crop.x * ratio;
    const cropY = crop.y * ratio;
    const cropWidth = crop.width * ratio;
    const cropHeight = crop.height * ratio;
    ctx.fillStyle = "rgba(17, 24, 39, 0.38)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(cropX, cropY, cropWidth, cropHeight);
    ctx.drawImage(state.image, crop.x, crop.y, crop.width, crop.height, cropX, cropY, cropWidth, cropHeight);
    ctx.strokeStyle = state.cropMode === "manual" ? "#f59e0b" : "#1d7a8c";
    ctx.lineWidth = 3;
    ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
    if (state.cropMode === "manual") {
      drawCropOverlay(ctx, cropX, cropY, cropWidth, cropHeight);
    }
  }
}

function getSourcePreviewRatio() {
  if (!state.image) return 1;
  const defaultMax = 680;
  if (!isMobileLayout()) {
    return Math.min(defaultMax / state.image.width, defaultMax / state.image.height, 1);
  }
  const scrollRect = els.canvasScroll?.getBoundingClientRect?.();
  const availableWidth = Math.max(1, (els.canvasScroll?.clientWidth || scrollRect?.width || window.innerWidth || defaultMax) - 2);
  const availableHeight = Math.max(1, (els.canvasScroll?.clientHeight || scrollRect?.height || window.innerHeight || defaultMax) - 2);
  return Math.min(availableWidth / state.image.width, availableHeight / state.image.height, 1);
}

function drawCropOverlay(ctx, x, y, width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 2; i += 1) {
    const gx = x + (width / 3) * i;
    const gy = y + (height / 3) * i;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + width, gy);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(17, 24, 39, 0.72)";
  ctx.font = "700 13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("拖动取景 · 滚轮/触摸板缩放", x + width / 2, Math.max(18, y - 18));
  ctx.restore();
}

async function generatePixelArt() {
  if (!state.image) {
    els.matrixStatus.textContent = "请先导入图片";
    return;
  }

  const width = clamp(Number(els.pixelWidth.value), 16, 192);
  const height = clamp(Number(els.pixelHeight.value), 16, 192);
  const threshold = DEFAULT_DELTA_THRESHOLD;
  const activePalette = state.palette.filter((block) => block.status === "active");
  const selectedPalette = getSelectedGenerationPalette(activePalette);
  const useExplicitPalette = selectedPalette.length > 0;
  const availablePalette = useExplicitPalette ? selectedPalette : activePalette;
  const maxColorTypes = useExplicitPalette ? availablePalette.length : getGenerationColorLimit(activePalette.length);

  if (!activePalette.length) {
    els.matrixStatus.textContent = "色块库没有可用颜色";
    return;
  }

  const sourceImage = await prepareSourceImageForGeneration();
  const imageData = sampleImage(sourceImage, width, height, state.inputType);
  const paletteLab = availablePalette.map((block) => ({ ...block, lab: rgbToLab(block.rgb) }));
  const sampledPixels = collectSampledPixels(imageData, width, height);
  const generationPaletteLab = useExplicitPalette ? paletteLab : selectGenerationPalette(sampledPixels, paletteLab, maxColorTypes);
  const matrix = [];
  const risks = [];

  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      const pixel = sampledPixels[y * width + x];
      const match = findNearestBlock(pixel.lab, generationPaletteLab);
      row.push(match.block.id);
      if (match.distance > threshold) {
        risks.push({ x, y, source: pixel.rgb, blockId: match.block.id, distance: match.distance });
      }
    }
    matrix.push(row);
  }

  state.matrix = { width, height, rows: matrix };
  state.candidateStatus = "pending";
  addCandidateSnapshot();
  state.projectPaletteSnapshot = null;
  state.patternParse = null;
  state.risks = summarizeRisks(risks);
  state.selectedBlockId = null;
  state.paintBlockId = generationPaletteLab[0]?.id || activePalette[0]?.id || null;
  state.history = [];
  const usedCount = countBlocks({ width, height, rows: matrix }).size;
  els.matrixStatus.textContent =
    useExplicitPalette
      ? `${width} x ${height}，已按色号清单 ${availablePalette.length} 种生成，实际使用 ${usedCount} 种，等待采纳`
      : maxColorTypes < activePalette.length
      ? `${width} x ${height}，已限制最多 ${maxColorTypes} 种色块，实际使用 ${usedCount} 种，等待采纳`
      : `${width} x ${height}，已生成候选结果，等待采纳`;
  const activeAiConfig = getActiveAiConfig();
  if (state.inputType === "photo" && activeAiConfig.enabled) {
    els.aiNotice.textContent = state.serverMode
      ? "真实照片已优先尝试云端卡通化；失败时会自动回退到本地预处理。"
      : "静态 file 模式无法安全调用云端模型，已使用本地预处理。";
  }
  renderCanvas();
  renderStats();
}

async function prepareSourceImageForGeneration() {
  const activeAiConfig = getActiveAiConfig();
  if (state.inputType !== "photo" || !activeAiConfig.enabled || !state.serverMode) {
    return state.image;
  }

  els.matrixStatus.textContent = "正在调用云端模型进行照片卡通化...";
  const imageDataUrl = imageToDataUrl(state.image);
  const result = await apiRequest("/api/cartoonize", {
    method: "POST",
    body: { imageDataUrl }
  });

  if (!result?.imageDataUrl) {
    els.aiNotice.textContent = result?.message || "云端卡通化不可用，已回退到本地预处理。";
    return state.image;
  }

  try {
    const image = await loadImageFromDataUrl(result.imageDataUrl);
    els.aiNotice.textContent = result.message || "云端卡通化完成。";
    return image;
  } catch {
    els.aiNotice.textContent = "云端返回图片无法读取，已回退到原图。";
    return state.image;
  }
}

function sampleImage(image, width, height, inputType) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const crop = getSourceCrop(image.width, image.height, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (crop.mode === "contain") {
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height);
  } else {
    ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
  }

  const data = ctx.getImageData(0, 0, width, height);
  if (inputType === "photo") {
    cartoonPreprocess(data);
  }
  return data;
}

function getSourceCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (state.cropMode === "contain") {
    const ratio = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
    const width = sourceWidth * ratio;
    const height = sourceHeight * ratio;
    return { mode: "contain", x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
  }

  const crop = coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight);
  if (state.cropMode !== "manual") return { mode: state.cropMode, ...crop };

  const zoom = state.cropZoom / 100;
  const width = crop.width / zoom;
  const height = crop.height / zoom;
  const maxX = sourceWidth - width;
  const maxY = sourceHeight - height;
  const x = clamp(maxX / 2 + (state.cropX / 100) * (maxX / 2), 0, maxX);
  const y = clamp(maxY / 2 + (state.cropY / 100) * (maxY / 2), 0, maxY);
  return { mode: state.cropMode, x, y, width, height };
}

function coverCrop(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const width = sourceHeight * targetRatio;
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight };
  }
  const height = sourceWidth / targetRatio;
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height };
}

function cartoonPreprocess(imageData) {
  const data = imageData.data;
  for (let index = 0; index < data.length; index += 4) {
    const rgb = [data[index], data[index + 1], data[index + 2]];
    const boosted = rgb.map((value) => {
      const normalized = value / 255;
      const contrasted = (normalized - 0.5) * 1.22 + 0.5;
      return clamp(Math.round(quantize(contrasted * 255, 24)), 0, 255);
    });
    data[index] = boosted[0];
    data[index + 1] = boosted[1];
    data[index + 2] = boosted[2];
  }
}

function quantize(value, step) {
  return Math.round(value / step) * step;
}

function collectSampledPixels(imageData, width, height) {
  const pixels = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const rgb = [imageData.data[index], imageData.data[index + 1], imageData.data[index + 2]];
      pixels.push({ x, y, rgb, lab: rgbToLab(rgb) });
    }
  }
  return pixels;
}

function selectGenerationPalette(pixels, paletteLab, limit) {
  if (!paletteLab.length) return [];
  const colorLimit = clamp(Number(limit) || paletteLab.length, 1, paletteLab.length);
  if (colorLimit >= paletteLab.length) return paletteLab;

  const selectedIds = getPaletteRecommendationRows(pixels, paletteLab)
    .slice(0, colorLimit)
    .map((item) => item.id);

  const selected = paletteLab.filter((block) => selectedIds.includes(block.id));
  return selected.length ? selected : [paletteLab[0]];
}

function getPaletteRecommendationRows(pixels, paletteLab) {
  const usage = new Map();
  pixels.forEach((pixel) => {
    const match = findNearestBlock(pixel.lab, paletteLab);
    const item = usage.get(match.block.id) || { block: match.block, count: 0, distance: 0 };
    item.count += 1;
    item.distance += match.distance;
    usage.set(match.block.id, item);
  });
  return [...usage.values()]
    .sort((a, b) => b.count - a.count || a.distance - b.distance || a.block.code.localeCompare(b.block.code, "zh-CN", { numeric: true }))
    .map((item) => ({
      id: item.block.id,
      block: item.block,
      count: item.count,
      averageDistance: item.count ? item.distance / item.count : 0
    }));
}

function getSelectedGenerationPalette(activePalette = state.palette.filter((block) => block.status === "active")) {
  if (!state.generationPaletteIds.size) return [];
  const activeIds = new Set(activePalette.map((block) => block.id));
  state.generationPaletteIds = new Set([...state.generationPaletteIds].filter((id) => activeIds.has(id)));
  return activePalette.filter((block) => state.generationPaletteIds.has(block.id));
}

function getGenerationColorLimit(activePaletteCount) {
  const value = Number(els.maxColorTypes.value || state.ui.maxColorTypes);
  if (!Number.isFinite(value) || value <= 0) return activePaletteCount;
  return clamp(Math.round(value), 1, Math.max(1, activePaletteCount));
}

function normalizeMaxColorTypesInput() {
  const raw = els.maxColorTypes.value.trim();
  if (!raw) return null;
  return clamp(Math.round(Number(raw)), 1, 999);
}

function updateMaxColorTypesHint() {
  if (!els.maxColorTypesHint) return;
  const activeCount = activePaletteCount();
  const limit = getGenerationColorLimit(activeCount || 1);
  if (!els.maxColorTypes.value.trim()) {
    els.maxColorTypesHint.textContent = `不填则使用全部可用色块；当前可用 ${activeCount} 种。`;
    return;
  }
  els.maxColorTypes.value = limit;
  els.maxColorTypesHint.textContent =
    limit < activeCount ? `生成结果最多使用 ${limit} 种色块。` : `设置值不小于当前可用色块数，将使用全部 ${activeCount} 种。`;
}

async function analyzePalettePlanFromImage() {
  if (!state.image) {
    els.palettePlanNotice.textContent = "请先导入图片，再分析推荐色号。";
    return;
  }
  const activePalette = state.palette.filter((block) => block.status === "active");
  if (!activePalette.length) {
    els.palettePlanNotice.textContent = "色块库没有可用颜色。";
    return;
  }

  const width = clamp(Number(els.pixelWidth.value), 16, 192);
  const height = clamp(Number(els.pixelHeight.value), 16, 192);
  const limit = getGenerationColorLimit(activePalette.length);
  els.palettePlanNotice.textContent = "正在按当前图片、裁剪和尺寸分析推荐色号...";
  const sourceImage = await prepareSourceImageForGeneration();
  const imageData = sampleImage(sourceImage, width, height, state.inputType);
  const sampledPixels = collectSampledPixels(imageData, width, height);
  const paletteLab = activePalette.map((block) => ({ ...block, lab: rgbToLab(block.rgb) }));
  const rows = getPaletteRecommendationRows(sampledPixels, paletteLab);

  state.generationPaletteStats = new Map(rows.map((row) => [row.id, row]));
  state.generationPaletteIds = new Set(rows.slice(0, limit).map((row) => row.id));
  saveGenerationPalettePlan();
  renderPalettePlan();
  els.palettePlanNotice.textContent = `已推荐 ${state.generationPaletteIds.size} 种色号，可继续手动调整。`;
}

function openPalettePlanModal() {
  renderPalettePlan();
  els.palettePlanModal.hidden = false;
}

function closePalettePlanModal() {
  els.palettePlanModal.hidden = true;
}

function selectAllPalettePlan() {
  state.generationPaletteIds = new Set(state.palette.filter((block) => block.status === "active").map((block) => block.id));
  saveGenerationPalettePlan();
  renderPalettePlan();
  els.palettePlanNotice.textContent = `已选择全部 ${state.generationPaletteIds.size} 种可用色号。`;
}

function clearPalettePlan() {
  state.generationPaletteIds = new Set();
  saveGenerationPalettePlan();
  renderPalettePlan();
  els.palettePlanNotice.textContent = "已清空色号清单，生成时会回到自动推荐/限色逻辑。";
}

function saveGenerationPalettePlan() {
  state.ui.generationPaletteIds = [...state.generationPaletteIds];
  saveUiState();
  renderPalettePlanSummary();
}

function replaceGenerationPaletteBlock(fromId, toId) {
  if (!fromId || !toId || fromId === toId) return false;
  const activeIds = new Set(state.palette.filter((block) => block.status === "active").map((block) => block.id));
  if (!state.generationPaletteIds.has(fromId) || !activeIds.has(toId)) return false;
  state.generationPaletteIds.delete(fromId);
  state.generationPaletteIds.add(toId);
  saveGenerationPalettePlan();
  return true;
}

function renderPalettePlan() {
  renderPalettePlanSummary();
  renderPalettePlanList();
}

function renderPalettePlanSummary() {
  if (!els.palettePlanSummary) return;
  const selected = getSelectedGenerationPalette();
  if (!selected.length) {
    els.palettePlanSummary.textContent = "未指定色号清单";
    els.palettePlanHint.textContent = "可分析推荐或手动选择，生成时优先使用清单色号。";
  } else {
    els.palettePlanSummary.textContent = `已选择 ${selected.length} 种色号`;
    els.palettePlanHint.textContent = selected
      .slice(0, 4)
      .map((block) => block.code)
      .join("、");
  }
  els.palettePlanSwatches.innerHTML = selected
    .slice(0, 10)
    .map((block) => `<span class="mini-swatch" style="background:${rgbCss(block.rgb)}"></span>`)
    .join("");
}

function renderPalettePlanList() {
  if (!els.palettePlanList) return;
  const activePalette = state.palette.filter((block) => block.status === "active");
  const selected = getSelectedGenerationPalette(activePalette);
  els.palettePlanCount.textContent = `已选择 ${selected.length} / ${activePalette.length} 种可用色号`;
  els.palettePlanList.innerHTML = "";
  renderPalettePlanIndex(activePalette);

  activePalette
    .slice()
    .sort((a, b) => {
      const selectedDelta = Number(state.generationPaletteIds.has(b.id)) - Number(state.generationPaletteIds.has(a.id));
      if (selectedDelta) return selectedDelta;
      return a.code.localeCompare(b.code, "zh-CN", { numeric: true });
    })
    .forEach((block) => {
      const stat = state.generationPaletteStats.get(block.id);
      const isSelected = state.generationPaletteIds.has(block.id);
      const replaceOptions = activePalette.filter((candidate) => candidate.id !== block.id && !state.generationPaletteIds.has(candidate.id));
      const row = document.createElement("div");
      row.className = `palette-plan-row ${isSelected ? "active" : ""}`;
      row.planInitial = getPalettePlanInitial(block);
      row.setAttribute("data-plan-initial", row.planInitial);
      row.innerHTML = `
        <input type="checkbox" aria-label="${escapeHtml(block.code)} ${escapeHtml(block.name)}" ${isSelected ? "checked" : ""} />
        <span class="swatch" style="background:${rgbCss(block.rgb)}"></span>
        <span class="palette-plan-main">
          <span class="row-title">${escapeHtml(block.code)}</span>
          <span class="row-subtitle">${stat ? `推荐 ${stat.count} 格` : `库存 ${formatStock(block.stock)}`}</span>
        </span>
        ${
          isSelected
            ? `<select class="palette-replace-select palette-replace-button" aria-label="替换 ${escapeHtml(block.code)} ${escapeHtml(block.name)}" ${
                replaceOptions.length ? "" : "disabled"
              }>
                <option value="">换</option>
                ${replaceOptions
                  .map((candidate) => `<option value="${escapeHtml(candidate.id)}">${escapeHtml(candidate.code)} ${escapeHtml(candidate.name)}</option>`)
                  .join("")}
              </select>`
            : `<span class="palette-replace-slot" aria-hidden="true"></span>`
        }
      `;
      row.querySelector("input").addEventListener("change", (event) => {
        if (event.target.checked) state.generationPaletteIds.add(block.id);
        else state.generationPaletteIds.delete(block.id);
        saveGenerationPalettePlan();
        renderPalettePlanList();
      });
      const replaceSelect = row.querySelector(".palette-replace-select");
      if (replaceSelect) {
        replaceSelect.addEventListener("change", (event) => {
          const targetBlock = activePalette.find((candidate) => candidate.id === event.target.value);
          if (!targetBlock) return;
          if (replaceGenerationPaletteBlock(block.id, targetBlock.id)) {
            els.palettePlanNotice.textContent = `已将 ${block.code} ${block.name} 替换为 ${targetBlock.code} ${targetBlock.name}。`;
            renderPalettePlanList();
          }
        });
      }
      els.palettePlanList.appendChild(row);
    });
}

function renderPalettePlanIndex(activePalette) {
  if (!els.palettePlanIndexBar) return;
  const initials = [...new Set(activePalette.map(getPalettePlanInitial).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));
  els.palettePlanIndexBar.innerHTML = "";
  initials.forEach((initial) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = initial;
    button.addEventListener("click", () => {
      const target = [...els.palettePlanList.children].find((row) => row.planInitial === initial || row.getAttribute?.("data-plan-initial") === initial);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    els.palettePlanIndexBar.appendChild(button);
  });
}

function getPalettePlanInitial(block) {
  return String(block?.code || block?.name || "#").trim().charAt(0).toUpperCase();
}

function findNearestBlock(lab, paletteLab) {
  let best = paletteLab[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const block of paletteLab) {
    const distance = deltaE76(lab, block.lab);
    if (distance < bestDistance) {
      best = block;
      bestDistance = distance;
    }
  }
  return { block: best, distance: bestDistance };
}

function summarizeRisks(risks) {
  const grouped = new Map();
  risks.forEach((risk) => {
    const item = grouped.get(risk.blockId) || { blockId: risk.blockId, count: 0, maxDistance: 0, examples: [] };
    item.count += 1;
    item.maxDistance = Math.max(item.maxDistance, risk.distance);
    if (item.examples.length < 3) item.examples.push(risk);
    grouped.set(risk.blockId, item);
  });
  return [...grouped.values()].sort((a, b) => b.count - a.count);
}

function renderAll() {
  els.maxColorTypes.value = state.ui.maxColorTypes || "";
  els.gridToggle.checked = state.showGrid;
  els.labelToggle.checked = state.showLabels;
  syncZoomControls();
  updateCropLabels();
  updateMaxColorTypesHint();
  renderPalettePlanSummary();
  updatePipelineNotice();
  renderAiSettings();
  renderDashboard();
  renderPaletteEditor();
  renderStats();
  renderGallery();
  renderCanvas();
  renderAssemblyPage();
  updateMobileActions();
}

function renderDashboard() {
  if (!els.dashboardGalleryStats) return;
  const gallery = getDashboardGalleryStats();
  const assembly = getDashboardAssemblyStats();
  const lowStock = getLowStockBlocks();

  els.dashboardGalleryStats.innerHTML = `
    ${dashboardMetric("作品数", gallery.projects)}
    ${dashboardMetric("像素总格", gallery.cells)}
    ${dashboardMetric("最近更新", gallery.latestLabel)}
  `;
  els.dashboardAssemblyStats.innerHTML = `
    ${dashboardMetric("已拼", assembly.marked)}
    ${dashboardMetric("剩余", assembly.remaining)}
    ${dashboardMetric("完成率", `${assembly.percent}%`)}
  `;

  els.dashboardInventoryNotice.textContent = lowStock.length
    ? `${lowStock.length} 种色块库存低于 ${LOW_STOCK_THRESHOLD} 个，需要补充。`
    : `库存充足，暂无低于 ${LOW_STOCK_THRESHOLD} 个的色块。`;
  els.dashboardInventoryNotice.classList.toggle("warn", lowStock.length > 0);
  els.dashboardLowStockList.innerHTML = "";
  lowStock.slice(0, 12).forEach((block) => {
    const row = document.createElement("button");
    row.className = "used-row low-stock-row";
    row.innerHTML = `
      <span class="swatch" style="background:${rgbCss(block.rgb)}"></span>
      <span>
        <span class="row-title">${escapeHtml(block.code)}</span>
        <span class="row-subtitle">库存 ${formatStock(block.stock)}</span>
      </span>
      <span class="status-badge warn">补货</span>
    `;
    row.addEventListener("click", () => {
      state.editingBlockId = block.id;
      switchPanel("palette");
      renderPaletteEditor();
    });
    els.dashboardLowStockList.appendChild(row);
  });
}

function dashboardMetric(label, value) {
  return `<span class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></span>`;
}

function getDashboardGalleryStats() {
  const projects = state.projects.length;
  const cells = state.projects.reduce((sum, project) => sum + (Number(project.width) || 0) * (Number(project.height) || 0), 0);
  const latest = state.projects
    .map((project) => project.updatedAt || project.createdAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    projects,
    cells,
    latestLabel: latest ? new Date(latest).toLocaleDateString() : "暂无"
  };
}

function getDashboardAssemblyStats() {
  const totals = state.projects.reduce(
    (summary, project) => {
      const item = getProjectAssemblySummary(project);
      summary.total += item.total;
      summary.marked += item.marked;
      summary.remaining += item.remaining;
      return summary;
    },
    { total: 0, marked: 0, remaining: 0 }
  );
  return {
    ...totals,
    percent: totals.total ? Math.round((totals.marked / totals.total) * 100) : 0
  };
}

function updateRuntimeControls() {
  els.migrateLocalBtn.disabled = !state.serverMode;
  els.migrateLocalBtn.title = state.serverMode ? "把浏览器本地存储迁移到 data 文件夹" : "通过拼豆设计.app打开后可迁移";
  els.openDataDirBtn.hidden = Boolean(state.publicMode);
  els.migrateLocalBtn.hidden = Boolean(state.publicMode);
  els.runtimeBanner.classList.toggle("online", state.serverMode);
  els.runtimeBanner.textContent = state.serverMode
    ? `${runtimeModeLabel(state.runtimeMode)} · data 文件保存`
    : "静态版 · 浏览器本地保存";
  els.runtimeBanner.title = state.serverMode
    ? state.publicMode
      ? "私有网页服务已连接，色块库、图库和拼装进度会保存到服务器数据目录。"
      : "本机服务已连接，色块库、图库和设置会保存到 data 文件夹。"
    : "当前没有连接本机服务，数据会保存在浏览器本地存储。";
  updatePipelineNotice();
  renderAiSettings();
}

function updateUiLayout() {
  state.ui = normalizeUiState(state.ui);
  setActivePanel(state.activePanel || "workspace");
  els.appShell.classList.toggle("rail-collapsed", state.ui.railCollapsed);
  els.appShell.classList.toggle("assembly-stats-collapsed", state.ui.assemblyStatsCollapsed);
  els.workspaceGrid.classList.toggle("controls-collapsed", state.ui.controlPanelCollapsed);
  els.controlPanel.classList.toggle("collapsed", state.ui.controlPanelCollapsed);
  els.railCollapseBtn.textContent = state.ui.railCollapsed ? "›" : "‹";
  els.railCollapseBtn.title = state.ui.railCollapsed ? "展开菜单" : "收起菜单";
  els.railCollapseBtn.setAttribute("aria-label", els.railCollapseBtn.title);
  els.controlPanelToggle.textContent = state.ui.controlPanelCollapsed ? "›" : "‹";
  els.controlPanelToggle.title = state.ui.controlPanelCollapsed ? "展开上传素材" : "收起上传素材";
  els.controlPanelToggle.setAttribute("aria-label", els.controlPanelToggle.title);
  if (els.assemblyStatsToggleBtn) {
    els.assemblyStatsToggleBtn.textContent = state.ui.assemblyStatsCollapsed ? "‹" : "›";
    els.assemblyStatsToggleBtn.title = state.ui.assemblyStatsCollapsed ? "展开拼装统计" : "收起拼装统计";
    els.assemblyStatsToggleBtn.setAttribute("aria-label", els.assemblyStatsToggleBtn.title);
  }
  updateMobileActions();
}

function updateMobileActions() {
  if (!els.mobileSaveProjectBtn || !els.mobileExportBtn) return;
  const hasMatrix = Boolean(state.matrix);
  els.mobileSaveProjectBtn.disabled = !hasMatrix;
  els.mobileExportBtn.disabled = !hasMatrix;
  if (els.mobileSaveResultBtn) els.mobileSaveResultBtn.disabled = !hasMatrix;
  if (els.mobileExportResultBtn) els.mobileExportResultBtn.disabled = !hasMatrix;
  if (els.mobileAddColorBtn) els.mobileAddColorBtn.disabled = activePaletteCount() >= state.paletteLimit;
  if (els.mobileExportAllProjectsBtn) els.mobileExportAllProjectsBtn.disabled = state.projects.length === 0;
  if (els.mobileAssemblySaveBtn) els.mobileAssemblySaveBtn.disabled = !state.assemblyMatrix;
  if (els.mobileAssemblySaveProgressBtn) els.mobileAssemblySaveProgressBtn.disabled = !state.assemblyMatrix;
}

function setActivePanel(panelName) {
  state.activePanel = panelName;
  if (els.appShell && typeof els.appShell.setAttribute === "function") {
    els.appShell.setAttribute("data-active-panel", panelName);
  }
}

function normalizeUiState(ui = {}) {
  return {
    railCollapsed: Boolean(ui.railCollapsed),
    controlPanelCollapsed: Boolean(ui.controlPanelCollapsed),
    assemblyStatsCollapsed: Boolean(ui.assemblyStatsCollapsed),
    maxColorTypes: Number.isInteger(Number(ui.maxColorTypes)) && Number(ui.maxColorTypes) > 0 ? Number(ui.maxColorTypes) : null,
    generationPaletteIds: Array.isArray(ui.generationPaletteIds) ? ui.generationPaletteIds.map(String) : []
  };
}

function saveUiState() {
  state.ui = normalizeUiState(state.ui);
  saveJson(STORAGE_KEYS.ui, state.ui);
}

function syncZoomControls() {
  state.zoom = clamp(Math.round(Number(state.zoom) || 10), 4, 64);
  els.zoomRange.value = state.zoom;
  els.zoomValue.textContent = `${state.zoom}px/格`;
}

function setCanvasZoom(value) {
  state.zoom = clamp(Math.round(Number(value) || state.zoom), 4, 64);
  syncZoomControls();
}

function updatePipelineNotice() {
  els.pipelineNotice.textContent = "素材图会进行本地像素化，并匹配到当前色块库。";
}

function renderCanvas() {
  const canvas = els.pixelCanvas;
  const ctx = canvas.getContext("2d");

  if (!state.matrix) {
    if (!state.image) {
      canvas.width = 680;
      canvas.height = 520;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#667085";
      ctx.font = "16px sans-serif";
      ctx.fillText("导入图片后生成像素画", 250, 260);
    }
    return;
  }

  const cell = state.zoom;
  const { width, height, rows } = state.matrix;
  canvas.width = width * cell;
  canvas.height = height * cell;
  const paletteMap = new Map(getRenderPalette().map((block) => [block.id, block]));
  const selected = state.selectedBlockId;
  const selectedBlock = paletteMap.get(selected);
  const shouldShowLabels = state.showLabels && cell >= 20;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const block = paletteMap.get(rows[y][x]);
      if (!block) continue;
      const isSelected = !selected || blocksMatch(selectedBlock, block);
      const [r, g, b] = block.rgb;
      ctx.globalAlpha = selected && !isSelected ? 0.2 : 1;
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x * cell, y * cell, cell, cell);
      ctx.globalAlpha = 1;

      if (selected && isSelected) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = Math.max(1, cell * 0.08);
        ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
      }

      if (shouldShowLabels) {
        ctx.fillStyle = luminance(block.rgb) > 0.55 ? "#111827" : "#ffffff";
        ctx.font = `700 ${Math.max(9, Math.floor(cell * 0.42))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(block.code, x * cell + cell / 2, y * cell + cell / 2);
      }
    }
  }

  if (state.showGrid && cell >= 7) {
    ctx.strokeStyle = "rgba(17, 24, 39, 0.16)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, height * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(width * cell, y * cell + 0.5);
      ctx.stroke();
    }
  }
}

function renderAssemblyPage() {
  if (!els.assemblyCanvas) return;
  syncAssemblyMajorGridControl();
  renderAssemblyCanvas();
  renderAssemblyStats();
}

function renderAssemblyCanvas() {
  const canvas = els.assemblyCanvas;
  const ctx = canvas.getContext("2d");

  if (!state.assemblyMatrix) {
    canvas.width = 680;
    canvas.height = 520;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#667085";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("从图库选择作品后开始拼装标记", canvas.width / 2, canvas.height / 2);
    updateAssemblyStatus();
    els.assemblySaveProgressBtn.disabled = true;
    if (els.mobileAssemblySaveBtn) els.mobileAssemblySaveBtn.disabled = true;
    if (els.mobileAssemblySaveProgressBtn) els.mobileAssemblySaveProgressBtn.disabled = true;
    return;
  }
  els.assemblySaveProgressBtn.disabled = false;
  if (els.mobileAssemblySaveBtn) els.mobileAssemblySaveBtn.disabled = false;
  if (els.mobileAssemblySaveProgressBtn) els.mobileAssemblySaveProgressBtn.disabled = false;

  const cell = state.assemblyZoom;
  const { width, height, rows } = state.assemblyMatrix;
  canvas.width = width * cell;
  canvas.height = height * cell;
  const paletteMap = new Map(getAssemblyPalette().map((block) => [block.id, block]));
  const selectedBlock = paletteMap.get(state.assemblySelectedBlockId);
  const shouldShowLabels = state.assemblyShowLabels && cell >= 20;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const block = paletteMap.get(rows[y][x]);
      if (!block) continue;
      const isSelected = !state.assemblySelectedBlockId || blocksMatch(selectedBlock, block);
      const left = x * cell;
      const top = y * cell;
      ctx.globalAlpha = state.assemblySelectedBlockId && !isSelected ? 0.18 : 1;
      ctx.fillStyle = rgbCss(block.rgb);
      ctx.fillRect(left, top, cell, cell);
      ctx.globalAlpha = 1;

      if (state.assemblySelectedBlockId && isSelected) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = Math.max(1, cell * 0.08);
        ctx.strokeRect(left + 1, top + 1, cell - 2, cell - 2);
      }

      if (state.assemblyMarked.has(assemblyKey(x, y))) {
        drawAssemblyMarker(ctx, left, top, cell, block);
      }

      if (state.assemblyLocatedCell?.x === x && state.assemblyLocatedCell?.y === y) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = Math.max(3, cell * 0.14);
        ctx.strokeRect(left + 2, top + 2, cell - 4, cell - 4);
      }

      if (shouldShowLabels) {
        ctx.fillStyle = luminance(block.rgb) > 0.55 ? "#111827" : "#ffffff";
        ctx.font = `700 ${Math.max(9, Math.floor(cell * 0.42))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(block.code, left + cell / 2, top + cell / 2);
      }
    }
  }

  if (state.assemblyShowGrid && cell >= 7) {
    ctx.strokeStyle = "rgba(17, 24, 39, 0.16)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 1) {
      ctx.beginPath();
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, height * cell);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 1) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(width * cell, y * cell + 0.5);
      ctx.stroke();
    }
  }

  drawAssemblyMajorGrid(ctx, cell);
  drawAssemblySelection(ctx, cell);
}

function drawAssemblyMarker(ctx, left, top, cell, block) {
  const darkText = luminance(block.rgb) > 0.55;
  ctx.fillStyle = darkText ? "rgba(17, 24, 39, 0.68)" : "rgba(255, 255, 255, 0.72)";
  const size = Math.max(8, cell * 0.34);
  const pad = Math.max(2, cell * 0.08);
  ctx.fillRect(left + cell - size - pad, top + pad, size, size);
  ctx.strokeStyle = darkText ? "#ffffff" : "#111827";
  ctx.lineWidth = Math.max(1.5, cell * 0.06);
  ctx.beginPath();
  ctx.moveTo(left + cell - size - pad + size * 0.22, top + pad + size * 0.52);
  ctx.lineTo(left + cell - size - pad + size * 0.42, top + pad + size * 0.72);
  ctx.lineTo(left + cell - size - pad + size * 0.78, top + pad + size * 0.28);
  ctx.stroke();
}

function drawAssemblySelection(ctx, cell) {
  const rect = getAssemblySelectionRect();
  if (!rect) return;
  const left = rect.minX * cell;
  const top = rect.minY * cell;
  const width = (rect.maxX - rect.minX + 1) * cell;
  const height = (rect.maxY - rect.minY + 1) * cell;
  ctx.fillStyle = "rgba(29, 122, 140, 0.16)";
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = "#1d7a8c";
  ctx.lineWidth = Math.max(2, cell * 0.08);
  ctx.strokeRect(left + 1, top + 1, width - 2, height - 2);
}

function drawAssemblyMajorGrid(ctx, cell) {
  const interval = Number(state.assemblyMajorGridSize);
  if (!state.assemblyMatrix || ![5, 10].includes(interval)) return;
  const { width, height } = state.assemblyMatrix;
  ctx.save();
  ctx.strokeStyle = "rgba(17, 24, 39, 0.5)";
  ctx.lineWidth = Math.max(2, Math.min(4, cell * 0.16));
  for (let x = interval; x < width; x += interval) {
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, height * cell);
    ctx.stroke();
  }
  for (let y = interval; y < height; y += interval) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(width * cell, y * cell + 0.5);
    ctx.stroke();
  }
  drawAssemblyMajorGridLabels(ctx, cell, interval);
  ctx.restore();
}

function drawAssemblyMajorGridLabels(ctx, cell, interval) {
  if (!state.assemblyMatrix || interval * cell < 44) return;
  const { width, height } = state.assemblyMatrix;
  const fontSize = clamp(Math.floor(cell * 0.26), 11, 18);
  const padX = clamp(Math.floor(cell * 0.12), 4, 8);
  const padY = clamp(Math.floor(cell * 0.07), 3, 6);
  ctx.font = `900 ${fontSize}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (let y = 0; y < height; y += interval) {
    for (let x = 0; x < width; x += interval) {
      const label = `${Math.floor(x / interval) + 1},${Math.floor(y / interval) + 1}`;
      const textWidth = ctx.measureText ? ctx.measureText(label).width : label.length * fontSize * 0.58;
      const badgeWidth = Math.ceil(textWidth + padX * 2);
      const badgeHeight = Math.ceil(fontSize + padY * 2);
      const left = x * cell + Math.max(2, cell * 0.06);
      const top = y * cell + Math.max(2, cell * 0.06);
      ctx.fillStyle = "rgba(255, 255, 255, 0.56)";
      ctx.fillRect(left, top, badgeWidth, badgeHeight);
      ctx.strokeStyle = "rgba(17, 24, 39, 0.14)";
      ctx.lineWidth = 1;
      ctx.strokeRect(left + 0.5, top + 0.5, badgeWidth - 1, badgeHeight - 1);
      ctx.lineWidth = Math.max(3, Math.floor(fontSize * 0.26));
      ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
      ctx.fillStyle = "rgba(17, 24, 39, 0.78)";
      ctx.strokeText?.(label, left + padX, top + padY);
      ctx.fillText(label, left + padX, top + padY);
    }
  }
}

function syncAssemblyMajorGridControl() {
  if (!els.assemblyMajorGridSelect) return;
  if (![0, 5, 10].includes(Number(state.assemblyMajorGridSize))) {
    state.assemblyMajorGridSize = 10;
  }
  els.assemblyMajorGridSelect.value = String(state.assemblyMajorGridSize);
}

function formatAssemblyCoord(point) {
  if (!point) return "-,-";
  const interval = Number(state.assemblyMajorGridSize);
  const section =
    state.assemblyMatrix && [5, 10].includes(interval)
      ? ` · 区 ${Math.floor(point.x / interval) + 1},${Math.floor(point.y / interval) + 1}`
      : "";
  return `${point.x + 1},${point.y + 1}${section}`;
}

function updateAssemblyStatus(counts = countAssemblyBlocks()) {
  if (!state.assemblyMatrix) {
    els.assemblyProjectStatus.textContent = "-,-";
    els.assemblyProgressStatus.textContent = "0/0";
    return;
  }
  const total = [...counts.values()].reduce((sum, item) => sum + item.total, 0);
  const marked = [...counts.values()].reduce((sum, item) => sum + item.marked, 0);
  els.assemblyProjectStatus.textContent = formatAssemblyCoord(state.assemblyLocatedCell);
  els.assemblyProgressStatus.textContent = `${marked}/${total}`;
}

function renderAssemblyStats() {
  if (!els.assemblyUsedPalette) return;
  els.assemblyUsedPalette.innerHTML = "";
  if (!state.assemblyMatrix) {
    els.assemblyNotice.textContent = "请先从图库选择一个已采纳作品。";
    els.assemblySummary.textContent = "";
    updateAssemblyStatus();
    return;
  }

  const counts = countAssemblyBlocks();
  const palette = getAssemblyPalette();
  const total = [...counts.values()].reduce((sum, item) => sum + item.total, 0);
  const marked = [...counts.values()].reduce((sum, item) => sum + item.marked, 0);
  const percent = total ? Math.round((marked / total) * 100) : 0;
  updateAssemblyStatus(counts);
  els.assemblyNotice.textContent = "先在右侧选中色块，再点击、框选或触屏长按滑动标记同色格；画布点击不会切换选中色块。";
  els.assemblySummary.innerHTML = `
    <span class="summary-item"><span>已拼</span><strong>${marked}</strong></span>
    <span class="summary-item"><span>剩余</span><strong>${Math.max(0, total - marked)}</strong></span>
    <span class="summary-item"><span>完成率</span><strong>${percent}%</strong></span>
  `;

  palette
    .filter((block) => counts.has(block.id))
    .sort((a, b) => {
      const countA = counts.get(a.id);
      const countB = counts.get(b.id);
      return countB.remaining - countA.remaining || countB.total - countA.total || a.code.localeCompare(b.code, "zh-CN", { numeric: true });
    })
    .forEach((block) => {
      const item = counts.get(block.id);
      const selectedBlock = palette.find((candidate) => candidate.id === state.assemblySelectedBlockId);
      const row = document.createElement("div");
      row.className = `used-row assembly-row ${blocksMatch(selectedBlock, block) ? "active" : ""}`;
      row.innerHTML = `
        <button class="assembly-row-main" type="button">
          <span class="assembly-stat-swatch" style="${assemblySwatchStyle(block.rgb)}">${escapeHtml(block.code)}</span>
        </button>
        <span class="assembly-progress-chip">${item.marked}/${item.total}</span>
        <button class="mini-action locate-action" type="button" data-action="locate" aria-label="定位 ${escapeHtml(block.code)}">⌖</button>
      `;
      row.querySelector(".assembly-row-main").addEventListener("click", () => {
        state.assemblySelectedBlockId = state.assemblySelectedBlockId === block.id ? null : block.id;
        renderAssemblyPage();
      });
      row.querySelector("[data-action='locate']").addEventListener("click", () => locateAssemblyBlock(block.id));
      els.assemblyUsedPalette.appendChild(row);
    });
}

function assemblySwatchStyle(rgb) {
  const useDarkText = luminance(rgb) > 0.52;
  return [
    `background:${rgbCss(rgb)}`,
    `color:${useDarkText ? "#111827" : "#ffffff"}`,
    `text-shadow:${useDarkText ? "0 1px 2px rgba(255,255,255,0.72)" : "0 1px 2px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.7)"}`
  ].join(";");
}

function countAssemblyBlocks() {
  const counts = new Map();
  if (!state.assemblyMatrix) return counts;
  state.assemblyMatrix.rows.forEach((row, y) => {
    row.forEach((id, x) => {
      const item = counts.get(id) || { total: 0, marked: 0, remaining: 0 };
      item.total += 1;
      if (state.assemblyMarked.has(assemblyKey(x, y))) item.marked += 1;
      item.remaining = item.total - item.marked;
      counts.set(id, item);
    });
  });
  return counts;
}

function adjustInventoryForAssemblyBlock(blockId, delta) {
  const block = findInventoryBlockForAssemblyId(blockId);
  if (!block || !delta) return false;
  block.stock = Math.max(0, normalizeStock(block.stock) + delta);
  savePalette();
  return true;
}

function adjustInventoryForAssemblyChanges(changes) {
  if (!changes?.size) return false;
  let changed = false;
  changes.forEach((delta, blockId) => {
    const block = findInventoryBlockForAssemblyId(blockId);
    if (!block || !delta) return;
    block.stock = Math.max(0, normalizeStock(block.stock) + delta);
    changed = true;
  });
  if (changed) savePalette();
  return changed;
}

function adjustInventoryForProjectChanges(changes, paletteSnapshot = []) {
  if (!changes?.size) return false;
  const snapshot = Array.isArray(paletteSnapshot) ? paletteSnapshot : [];
  let changed = false;
  changes.forEach((delta, blockId) => {
    const block = findInventoryBlockForProjectBlock(blockId, snapshot);
    if (!block || !delta) return;
    block.stock = Math.max(0, normalizeStock(block.stock) + delta);
    changed = true;
  });
  if (changed) savePalette();
  return changed;
}

function findInventoryBlockForProjectBlock(blockId, paletteSnapshot = []) {
  const direct = state.palette.find((block) => block.id === blockId);
  if (direct) return direct;
  const snapshotBlock = paletteSnapshot.find((block) => block.id === blockId);
  if (!snapshotBlock) return null;
  return state.palette.find((block) => blocksMatch(block, snapshotBlock)) || null;
}

function findInventoryBlockForAssemblyId(blockId) {
  const direct = state.palette.find((block) => block.id === blockId);
  if (direct) return direct;
  const snapshotBlock = getAssemblyPalette().find((block) => block.id === blockId);
  if (!snapshotBlock) return null;
  return state.palette.find((block) => blocksMatch(block, snapshotBlock)) || null;
}

function getInventoryStockForAssemblyBlock(block) {
  const inventoryBlock = findInventoryBlockForAssemblyId(block?.id);
  return inventoryBlock ? normalizeStock(inventoryBlock.stock) : null;
}

function handleAssemblyCanvasClick(event) {
  clearAssemblyLongPress();
  if (state.suppressNextAssemblyClick) {
    state.suppressNextAssemblyClick = false;
    return;
  }
  if (!state.assemblyMatrix) return;
  const point = getAssemblyCell(event);
  if (!point) return;
  toggleAssemblyCell(point);
}

function toggleAssemblyCell(point) {
  if (!state.assemblyMatrix || !point) return;
  const key = assemblyKey(point.x, point.y);
  const blockId = state.assemblyMatrix.rows[point.y][point.x];
  const targetBlock = getSelectedAssemblyBlock();
  const cellBlock = getAssemblyPalette().find((block) => block.id === blockId);
  state.assemblyLocatedCell = { x: point.x, y: point.y };
  if (!targetBlock) {
    updateAssemblyStatus();
    els.assemblyNotice.textContent = "请先在右侧色块统计中选中一个色块，再在画布中标记完成。";
    return;
  }
  if (!blocksMatch(targetBlock, cellBlock)) {
    updateAssemblyStatus();
    els.assemblyNotice.textContent = `当前选中 ${targetBlock.code} ${targetBlock.name}，只能标记同色块。`;
    return;
  }
  if (state.assemblyMarked.has(key)) {
    state.assemblyMarked.delete(key);
    adjustInventoryForAssemblyBlock(blockId, 1);
  } else {
    state.assemblyMarked.add(key);
    adjustInventoryForAssemblyBlock(blockId, -1);
  }
  saveAssemblyProgress();
  renderAssemblyPage();
}

function beginAssemblySelection(point, pointerId) {
  if (!point || !state.assemblyMatrix || !getSelectedAssemblyBlock()) return;
  state.assemblyLocatedCell = { x: point.x, y: point.y };
  state.isAssemblySelecting = true;
  state.suppressNextAssemblyClick = false;
  state.assemblySelection = {
    start: point,
    current: point,
    moved: false
  };
  if (pointerId !== undefined && els.assemblyCanvas.setPointerCapture) {
    els.assemblyCanvas.setPointerCapture(pointerId);
  }
  updateAssemblyStatus();
  renderAssemblyCanvas();
}

function getSelectedAssemblyBlock() {
  return getAssemblyPalette().find((block) => block.id === state.assemblySelectedBlockId) || null;
}

function clearAssemblyLongPress() {
  if (state.assemblyLongPressTimer) {
    clearTimeout(state.assemblyLongPressTimer);
    state.assemblyLongPressTimer = null;
  }
  state.assemblyLongPress = null;
}

function beginAssemblyTouchTrail(point, pointerId) {
  const targetBlock = getSelectedAssemblyBlock();
  if (!point || !state.assemblyMatrix || !targetBlock) {
    els.assemblyNotice.textContent = "请先在右侧色块统计中选中一个色块，再长按滑动标记完成。";
    return;
  }
  state.assemblyTouchTrail = {
    pointerId,
    targetBlock,
    lastPoint: point,
    count: 0,
    inventoryChanges: new Map()
  };
  state.suppressNextAssemblyClick = true;
  markAssemblyTrailPoint(point);
  els.assemblyNotice.textContent = `正在连续标记 ${targetBlock.code} ${targetBlock.name}。`;
}

function markAssemblyTrailPoint(point) {
  if (!state.assemblyTouchTrail || !point || !state.assemblyMatrix) return false;
  const targetBlock = state.assemblyTouchTrail.targetBlock;
  const blockId = state.assemblyMatrix.rows[point.y]?.[point.x];
  const block = getAssemblyPalette().find((item) => item.id === blockId);
  state.assemblyLocatedCell = { x: point.x, y: point.y };
  if (!blocksMatch(targetBlock, block)) return false;
  const key = assemblyKey(point.x, point.y);
  if (state.assemblyMarked.has(key)) return false;
  state.assemblyMarked.add(key);
  state.assemblyTouchTrail.count += 1;
  const changes = state.assemblyTouchTrail.inventoryChanges;
  changes.set(blockId, (changes.get(blockId) || 0) - 1);
  return true;
}

function markAssemblyTrailTo(point) {
  if (!state.assemblyTouchTrail || !point) return;
  const previous = state.assemblyTouchTrail.lastPoint || point;
  let changed = false;
  getCellsBetween(previous, point).forEach((cell) => {
    if (markAssemblyTrailPoint(cell)) changed = true;
  });
  state.assemblyTouchTrail.lastPoint = point;
  if (changed) {
    renderAssemblyCanvas();
    updateAssemblyStatus();
  } else {
    state.assemblyLocatedCell = point;
    updateAssemblyStatus();
  }
}

function finishAssemblyTouchTrail() {
  const trail = state.assemblyTouchTrail;
  if (!trail) return;
  state.assemblyTouchTrail = null;
  if (trail.count > 0) {
    adjustInventoryForAssemblyChanges(trail.inventoryChanges);
    saveAssemblyProgress();
    renderAssemblyPage();
    els.assemblyNotice.textContent = `已连续标记 ${trail.count} 个 ${trail.targetBlock.code} ${trail.targetBlock.name}。`;
  } else {
    renderAssemblyCanvas();
    els.assemblyNotice.textContent = `滑动轨迹中没有新的 ${trail.targetBlock.code} ${trail.targetBlock.name} 可标记。`;
  }
}

function getCellsBetween(start, end) {
  const cells = [];
  if (!start || !end) return cells;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const seen = new Set();
  for (let index = 0; index <= steps; index += 1) {
    const x = Math.round(start.x + (dx * index) / steps);
    const y = Math.round(start.y + (dy * index) / steps);
    const key = assemblyKey(x, y);
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push({ x, y });
  }
  return cells;
}

function beginAssemblyTouchPan(event, start = state.assemblyLongPress) {
  if (!start) return;
  clearAssemblyLongPress();
  state.isAssemblyPanning = true;
  state.suppressNextAssemblyClick = true;
  state.assemblyPanStart = {
    x: start.x,
    y: start.y,
    scrollLeft: start.scrollLeft ?? els.assemblyCanvasScroll.scrollLeft,
    scrollTop: start.scrollTop ?? els.assemblyCanvasScroll.scrollTop
  };
  if (els.assemblyCanvas.setPointerCapture) els.assemblyCanvas.setPointerCapture(event.pointerId);
  updatePanCursor();
  updateAssemblyTouchPan(event);
}

function updateAssemblyTouchPan(event) {
  if (!state.isAssemblyPanning || !state.assemblyPanStart) return;
  event.preventDefault?.();
  const dx = event.clientX - state.assemblyPanStart.x;
  const dy = event.clientY - state.assemblyPanStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) state.suppressNextAssemblyClick = true;
  els.assemblyCanvasScroll.scrollLeft = state.assemblyPanStart.scrollLeft - dx;
  els.assemblyCanvasScroll.scrollTop = state.assemblyPanStart.scrollTop - dy;
}

function handleAssemblyCanvasPointerDown(event) {
  if (!state.assemblyMatrix || event.button !== 0 || shouldPanEvent(event)) return;
  const point = getAssemblyCell(event);
  if (!point) return;
  if (event.pointerType === "touch") {
    event.preventDefault?.();
    clearAssemblyLongPress();
    state.assemblyLongPress = {
      point,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: els.assemblyCanvasScroll.scrollLeft,
      scrollTop: els.assemblyCanvasScroll.scrollTop
    };
    if (els.assemblyCanvas.setPointerCapture) els.assemblyCanvas.setPointerCapture(event.pointerId);
    state.assemblyLongPressTimer = window.setTimeout(() => {
      const longPress = state.assemblyLongPress;
      if (!longPress || longPress.pointerId !== event.pointerId) return;
      clearAssemblyLongPress();
      beginAssemblyTouchTrail(point, event.pointerId);
      state.suppressNextAssemblyClick = true;
    }, 360);
    return;
  }
  event.preventDefault();
  if (!state.assemblySelectedBlockId) {
    beginAssemblyDirectPan(event);
    return;
  }
  beginAssemblySelection(point, event.pointerId);
}

function handleAssemblyCanvasPointerMove(event) {
  if (state.assemblyTouchTrail && state.assemblyTouchTrail.pointerId === event.pointerId) {
    event.preventDefault?.();
    const point = getAssemblyCell(event);
    if (point) markAssemblyTrailTo(point);
    return;
  }
  if (state.assemblyLongPress && state.assemblyLongPress.pointerId === event.pointerId) {
    const dx = event.clientX - state.assemblyLongPress.x;
    const dy = event.clientY - state.assemblyLongPress.y;
    if (Math.hypot(dx, dy) > 10) {
      beginAssemblyTouchPan(event);
      return;
    }
  }
  if (event.pointerType === "touch" && state.isAssemblyPanning) {
    updateAssemblyTouchPan(event);
    return;
  }
  if (event.pointerType !== "touch" && state.isAssemblyPanning) {
    updateAssemblyTouchPan(event);
    return;
  }
  if (state.isAssemblySelecting) {
    event.preventDefault?.();
    const point = getAssemblyCell(event);
    if (!point || !state.assemblySelection) return;
    state.assemblySelection.current = point;
    if (point.x !== state.assemblySelection.start.x || point.y !== state.assemblySelection.start.y) {
      state.assemblySelection.moved = true;
      state.suppressNextAssemblyClick = true;
    }
    renderAssemblyCanvas();
    const rect = getAssemblySelectionRect();
    if (rect) {
      els.assemblyProjectStatus.textContent = formatAssemblyCoord(point);
    }
    return;
  }
  if (state.isAssemblyPanning) return;
  const point = getAssemblyCell(event);
  if (!point || !state.assemblyMatrix) return;
  state.assemblyLocatedCell = { x: point.x, y: point.y };
  updateAssemblyStatus();
}

function beginAssemblyDirectPan(event) {
  state.isAssemblyPanning = true;
  state.suppressNextAssemblyClick = false;
  state.assemblyPanStart = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: els.assemblyCanvasScroll.scrollLeft,
    scrollTop: els.assemblyCanvasScroll.scrollTop
  };
  if (els.assemblyCanvas.setPointerCapture) els.assemblyCanvas.setPointerCapture(event.pointerId);
  updatePanCursor();
}

function handleAssemblyCanvasWheel(event) {
  if (!state.assemblyMatrix || !event.ctrlKey) return;
  event.preventDefault();
  const oldZoom = state.assemblyZoom;
  const direction = event.deltaY < 0 ? 1 : -1;
  const step = Math.max(1, Math.round(Math.abs(event.deltaY) / 80));
  const nextZoom = clamp(oldZoom + direction * step, 4, 64);
  if (nextZoom === oldZoom) return;

  const scrollRect = els.assemblyCanvasScroll.getBoundingClientRect();
  const canvasRect = els.assemblyCanvas.getBoundingClientRect();
  const contentX = event.clientX - canvasRect.left;
  const contentY = event.clientY - canvasRect.top;
  const anchorX = event.clientX - scrollRect.left;
  const anchorY = event.clientY - scrollRect.top;

  state.assemblyZoom = nextZoom;
  state.assemblyShowLabels = state.assemblyZoom >= 20;
  renderAssemblyCanvas();

  els.assemblyCanvasScroll.scrollLeft = (contentX / oldZoom) * nextZoom - anchorX;
  els.assemblyCanvasScroll.scrollTop = (contentY / oldZoom) * nextZoom - anchorY;
}

function handleAssemblyTouchStart(event) {
  if (!state.assemblyMatrix) return;
  if (event.touches.length === 1) {
    event.preventDefault();
    const touch = event.touches[0];
    state.assemblyTouchPan = {
      x: touch.clientX,
      y: touch.clientY,
      scrollLeft: els.assemblyCanvasScroll.scrollLeft,
      scrollTop: els.assemblyCanvasScroll.scrollTop,
      moved: false
    };
    return;
  }
  if (event.touches.length !== 2) return;
  event.preventDefault();
  clearAssemblyLongPress();
  state.assemblyTouchPan = null;
  state.isAssemblySelecting = false;
  state.isAssemblyPanning = false;
  state.assemblySelection = null;
  state.assemblyPinch = createAssemblyPinchState(event.touches);
}

function handleAssemblyTouchMove(event) {
  if (!state.assemblyMatrix) return;
  if (state.assemblyTouchTrail && event.touches.length === 1) {
    event.preventDefault();
    const point = getAssemblyCell(event.touches[0]);
    if (point) markAssemblyTrailTo(point);
    return;
  }
  if (event.touches.length === 1 && state.assemblyTouchPan && !state.assemblyPinch) {
    event.preventDefault();
    const touch = event.touches[0];
    const dx = touch.clientX - state.assemblyTouchPan.x;
    const dy = touch.clientY - state.assemblyTouchPan.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      clearAssemblyLongPress();
      state.assemblyTouchPan.moved = true;
      state.suppressNextAssemblyClick = true;
      els.assemblyCanvasScroll.scrollLeft = state.assemblyTouchPan.scrollLeft - dx;
      els.assemblyCanvasScroll.scrollTop = state.assemblyTouchPan.scrollTop - dy;
    }
    return;
  }
  if (event.touches.length !== 2 || !state.assemblyPinch) return;
  event.preventDefault();
  const distance = getTouchDistance(event.touches);
  if (!distance || !state.assemblyPinch.distance) return;
  const nextZoom = clamp(Math.round(state.assemblyPinch.zoom * (distance / state.assemblyPinch.distance)), 4, 64);
  if (nextZoom === state.assemblyZoom) return;

  state.assemblyZoom = nextZoom;
  state.assemblyShowLabels = state.assemblyZoom >= 20;
  renderAssemblyCanvas();
  els.assemblyCanvasScroll.scrollLeft = state.assemblyPinch.cellX * nextZoom - state.assemblyPinch.anchorX;
  els.assemblyCanvasScroll.scrollTop = state.assemblyPinch.cellY * nextZoom - state.assemblyPinch.anchorY;
}

function handleAssemblyTouchEnd(event) {
  if (event.touches.length === 0) {
    if (state.assemblyTouchTrail) {
      finishAssemblyTouchTrail();
      state.assemblyTouchPan = null;
      return;
    }
    const pan = state.assemblyTouchPan;
    const touch = event.changedTouches?.[0];
    if (pan && !pan.moved && touch && !state.isAssemblySelecting && !state.assemblyPinch) {
      const point = getAssemblyCell(touch);
      if (point) {
        state.suppressNextAssemblyClick = true;
        toggleAssemblyCell(point);
      }
    }
    state.assemblyTouchPan = null;
  }
  if (event.touches.length < 2) state.assemblyPinch = null;
}

function createAssemblyPinchState(touches) {
  const center = getTouchCenter(touches);
  const canvasRect = els.assemblyCanvas.getBoundingClientRect();
  const scrollRect = els.assemblyCanvasScroll.getBoundingClientRect();
  return {
    distance: getTouchDistance(touches),
    zoom: state.assemblyZoom,
    cellX: (center.x - canvasRect.left) / state.assemblyZoom,
    cellY: (center.y - canvasRect.top) / state.assemblyZoom,
    anchorX: center.x - scrollRect.left,
    anchorY: center.y - scrollRect.top
  };
}

function handleAssemblyPanPointerDown(event) {
  if (!shouldPanEvent(event)) return;
  event.preventDefault();
  state.isAssemblyPanning = true;
  state.suppressNextAssemblyClick = false;
  state.assemblyPanStart = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: els.assemblyCanvasScroll.scrollLeft,
    scrollTop: els.assemblyCanvasScroll.scrollTop
  };
  if (els.assemblyCanvasScroll.setPointerCapture) els.assemblyCanvasScroll.setPointerCapture(event.pointerId);
  updatePanCursor();
}

function handleAssemblyPanPointerMove(event) {
  if (!state.isAssemblyPanning || !state.assemblyPanStart) return;
  event.preventDefault();
  const dx = event.clientX - state.assemblyPanStart.x;
  const dy = event.clientY - state.assemblyPanStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) state.suppressNextAssemblyClick = true;
  els.assemblyCanvasScroll.scrollLeft = state.assemblyPanStart.scrollLeft - dx;
  els.assemblyCanvasScroll.scrollTop = state.assemblyPanStart.scrollTop - dy;
}

function finishAssemblySelection(event) {
  if (!state.isAssemblySelecting || !state.assemblySelection) return;
  if (event?.clientX !== undefined && event?.clientY !== undefined) {
    const point = getAssemblyCell(event);
    if (point) {
      state.assemblySelection.current = point;
      if (point.x !== state.assemblySelection.start.x || point.y !== state.assemblySelection.start.y) {
        state.assemblySelection.moved = true;
      }
    }
  }

  const selection = state.assemblySelection;
  state.isAssemblySelecting = false;
  state.assemblySelection = null;

  if (!selection.moved) {
    renderAssemblyCanvas();
    return;
  }

  const targetBlock = getAssemblyPalette().find((block) => block.id === state.assemblySelectedBlockId);
  const rect = normalizeCellRect(selection.start, selection.current);
  const result = markAssemblySelection(rect, targetBlock);
  const markedCount = result.count;
  state.suppressNextAssemblyClick = true;
  state.assemblyLocatedCell = null;
  if (markedCount > 0) {
    adjustInventoryForAssemblyChanges(result.inventoryChanges);
    saveAssemblyProgress();
  }
  renderAssemblyPage();
  const blockName = targetBlock ? `${targetBlock.code} ${targetBlock.name}` : "选中色块";
  els.assemblyNotice.textContent =
    markedCount > 0
      ? `已框选标记 ${markedCount} 个 ${blockName}。`
      : `框选范围内没有新的 ${blockName} 可标记。`;
}

function markAssemblySelection(rect, targetBlock) {
  if (!rect || !targetBlock || !state.assemblyMatrix) return { count: 0, inventoryChanges: new Map() };
  const paletteMap = new Map(getAssemblyPalette().map((block) => [block.id, block]));
  let markedCount = 0;
  const inventoryChanges = new Map();
  for (let y = rect.minY; y <= rect.maxY; y += 1) {
    for (let x = rect.minX; x <= rect.maxX; x += 1) {
      const blockId = state.assemblyMatrix.rows[y][x];
      const block = paletteMap.get(blockId);
      if (!blocksMatch(targetBlock, block)) continue;
      const key = assemblyKey(x, y);
      if (state.assemblyMarked.has(key)) continue;
      state.assemblyMarked.add(key);
      markedCount += 1;
      inventoryChanges.set(blockId, (inventoryChanges.get(blockId) || 0) - 1);
    }
  }
  return { count: markedCount, inventoryChanges };
}

function getAssemblySelectionRect() {
  if (!state.isAssemblySelecting || !state.assemblySelection) return null;
  return normalizeCellRect(state.assemblySelection.start, state.assemblySelection.current);
}

function normalizeCellRect(start, current) {
  if (!start || !current) return null;
  return {
    minX: Math.min(start.x, current.x),
    minY: Math.min(start.y, current.y),
    maxX: Math.max(start.x, current.x),
    maxY: Math.max(start.y, current.y)
  };
}

function locateAssemblyBlock(blockId) {
  if (!state.assemblyMatrix) return;
  const target = getAssemblyPalette().find((block) => block.id === blockId);
  const point = findNextUnmarkedAssemblyCell(target);
  state.assemblySelectedBlockId = blockId;
  if (!point) {
    renderAssemblyPage();
    els.assemblyNotice.textContent = target ? `${target.code} ${target.name} 已全部完成。` : "该色块已全部完成。";
    return;
  }
  state.assemblyLocatedCell = point;
  renderAssemblyPage();
  if (isMobileLayout()) toggleAssemblyStats(false);
  deferAssemblyCenter(point.x, point.y);
  els.assemblyNotice.textContent = `已定位到 ${target.code} ${target.name}：第 ${point.y + 1} 行，第 ${point.x + 1} 列。`;
}

function deferAssemblyCenter(x, y) {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => centerAssemblyCell(x, y));
    return;
  }
  centerAssemblyCell(x, y);
}

function findNextUnmarkedAssemblyCell(targetBlock) {
  if (!targetBlock || !state.assemblyMatrix) return null;
  const paletteMap = new Map(getAssemblyPalette().map((block) => [block.id, block]));
  for (let y = 0; y < state.assemblyMatrix.height; y += 1) {
    for (let x = 0; x < state.assemblyMatrix.width; x += 1) {
      if (state.assemblyMarked.has(assemblyKey(x, y))) continue;
      const block = paletteMap.get(state.assemblyMatrix.rows[y][x]);
      if (blocksMatch(targetBlock, block)) return { x, y };
    }
  }
  return null;
}

function centerAssemblyCell(x, y) {
  const cell = state.assemblyZoom;
  const rect = els.assemblyCanvasScroll.getBoundingClientRect();
  const width = els.assemblyCanvasScroll.clientWidth || rect.width || 1;
  const height = els.assemblyCanvasScroll.clientHeight || rect.height || 1;
  els.assemblyCanvasScroll.scrollLeft = Math.max(0, x * cell + cell / 2 - width / 2);
  els.assemblyCanvasScroll.scrollTop = Math.max(0, y * cell + cell / 2 - height / 2);
}

function getAssemblyCell(event) {
  if (!state.assemblyMatrix) return null;
  const rect = els.assemblyCanvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / state.assemblyZoom);
  const y = Math.floor((event.clientY - rect.top) / state.assemblyZoom);
  if (x < 0 || y < 0 || x >= state.assemblyMatrix.width || y >= state.assemblyMatrix.height) return null;
  return { x, y };
}

function handleCanvasWheel(event) {
  if (isSourceCropInteraction()) {
    handleCropWheel(event);
    return;
  }
  if (!state.matrix || !event.ctrlKey) return;
  event.preventDefault();
  const oldZoom = state.zoom;
  const direction = event.deltaY < 0 ? 1 : -1;
  const step = Math.max(1, Math.round(Math.abs(event.deltaY) / 80));
  const nextZoom = clamp(oldZoom + direction * step, 4, 64);
  if (nextZoom === oldZoom) return;

  const scrollRect = els.canvasScroll.getBoundingClientRect();
  const canvasRect = els.pixelCanvas.getBoundingClientRect();
  const contentX = event.clientX - canvasRect.left;
  const contentY = event.clientY - canvasRect.top;
  const anchorX = event.clientX - scrollRect.left;
  const anchorY = event.clientY - scrollRect.top;

  setCanvasZoom(nextZoom);
  renderCanvas();

  els.canvasScroll.scrollLeft = (contentX / oldZoom) * nextZoom - anchorX;
  els.canvasScroll.scrollTop = (contentY / oldZoom) * nextZoom - anchorY;
}

function handleCanvasTouchStart(event) {
  if (isSourceCropInteraction()) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      handleCropPointerDown({ button: 0, pointerId: touch.identifier, clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => event.preventDefault() });
      return;
    }
    if (event.touches.length === 2) {
      event.preventDefault();
      if (state.cropMode !== "manual") {
        state.cropMode = "manual";
        els.cropMode.value = "manual";
      }
      state.cropPinch = {
        distance: getTouchDistance(event.touches),
        zoom: state.cropZoom
      };
      return;
    }
  }
  if (!state.matrix) return;
  if (event.touches.length === 1) {
    const touch = event.touches[0];
    state.canvasTouchPan = {
      x: touch.clientX,
      y: touch.clientY,
      scrollLeft: els.canvasScroll.scrollLeft,
      scrollTop: els.canvasScroll.scrollTop,
      moved: false
    };
    return;
  }
  if (event.touches.length !== 2) return;
  event.preventDefault();
  state.isPainting = false;
  state.isPanning = false;
  state.canvasTouchPan = null;
  state.canvasPinch = createCanvasPinchState(event.touches);
}

function handleCanvasTouchMove(event) {
  if (isSourceCropInteraction()) {
    if (state.isCropDragging && event.touches.length === 1) {
      const touch = event.touches[0];
      handleCropPointerMove({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => event.preventDefault() });
      return;
    }
    if (state.cropPinch && event.touches.length === 2) {
      event.preventDefault();
      const distance = getTouchDistance(event.touches);
      if (!distance || !state.cropPinch.distance) return;
      state.cropZoom = clamp(Math.round(state.cropPinch.zoom * (state.cropPinch.distance / distance)), 100, 260);
      syncCropInputs();
      drawSourcePreview();
      return;
    }
  }
  if (!state.matrix) return;
  if (event.touches.length === 1 && state.canvasTouchPan && !state.canvasPinch) {
    const touch = event.touches[0];
    const dx = touch.clientX - state.canvasTouchPan.x;
    const dy = touch.clientY - state.canvasTouchPan.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      event.preventDefault();
      state.canvasTouchPan.moved = true;
      state.suppressNextCanvasClick = true;
      els.canvasScroll.scrollLeft = state.canvasTouchPan.scrollLeft - dx;
      els.canvasScroll.scrollTop = state.canvasTouchPan.scrollTop - dy;
    }
    return;
  }
  if (event.touches.length !== 2 || !state.canvasPinch) return;
  event.preventDefault();
  const distance = getTouchDistance(event.touches);
  if (!distance || !state.canvasPinch.distance) return;
  const nextZoom = clamp(Math.round(state.canvasPinch.zoom * (distance / state.canvasPinch.distance)), 4, 64);
  if (nextZoom === state.zoom) return;

  setCanvasZoom(nextZoom);
  renderCanvas();
  els.canvasScroll.scrollLeft = state.canvasPinch.cellX * nextZoom - state.canvasPinch.anchorX;
  els.canvasScroll.scrollTop = state.canvasPinch.cellY * nextZoom - state.canvasPinch.anchorY;
}

function handleCanvasTouchEnd(event) {
  if (event.touches.length === 0) {
    state.canvasTouchPan = null;
    state.cropPinch = null;
    if (state.isCropDragging) {
      state.isCropDragging = false;
      state.cropDragStart = null;
      els.pixelCanvas.classList.remove("crop-dragging");
    }
  }
  if (event.touches.length < 2) state.canvasPinch = null;
}

function createCanvasPinchState(touches) {
  const center = getTouchCenter(touches);
  const canvasRect = els.pixelCanvas.getBoundingClientRect();
  const scrollRect = els.canvasScroll.getBoundingClientRect();
  return {
    distance: getTouchDistance(touches),
    zoom: state.zoom,
    cellX: (center.x - canvasRect.left) / state.zoom,
    cellY: (center.y - canvasRect.top) / state.zoom,
    anchorX: center.x - scrollRect.left,
    anchorY: center.y - scrollRect.top
  };
}

function getTouchCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

function getTouchDistance(touches) {
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function handleCanvasClick(event) {
  if (state.suppressNextCanvasClick) {
    state.suppressNextCanvasClick = false;
    return;
  }
  if (isSourceCropInteraction()) return;
  if (!state.matrix) return;
  const point = getCanvasCell(event);
  if (!point) return;
  const id = state.matrix.rows[point.y][point.x];
  if (state.activeTool === "inspect") {
    state.selectedBlockId = state.selectedBlockId === id ? null : id;
    state.paintBlockId = id;
    renderCanvas();
    renderStats();
    return;
  }
  if (state.activeTool === "picker") {
    state.paintBlockId = id;
    state.selectedBlockId = id;
    renderCanvas();
    renderStats();
    return;
  }
  if (state.activeTool === "fill") {
    fillRegion(point.x, point.y, getPaintBlockId());
  }
}

function handleCanvasPointerDown(event) {
  if (isSourceCropInteraction() && event.button === 0) {
    handleCropPointerDown(event);
    return;
  }
  if (shouldPanEvent(event)) return;
  if (!state.matrix || state.activeTool !== "brush") return;
  state.isPainting = true;
  pushHistory("画笔绘制");
  paintCellAtEvent(event);
}

function handleCanvasPointerMove(event) {
  if (state.isCropDragging) {
    handleCropPointerMove(event);
    return;
  }
  if (isSourceCropInteraction()) {
    updateCropCursorStatus(event);
    return;
  }
  if (state.isPanning) return;
  const point = getCanvasCell(event);
  if (point) {
    const block = getRenderPalette().find((item) => item.id === state.matrix?.rows?.[point.y]?.[point.x]);
    els.cursorStatus.textContent = `坐标：${point.x + 1}, ${point.y + 1}${block ? ` · ${block.code} ${block.name}` : ""}`;
  } else {
    els.cursorStatus.textContent = "坐标：-";
  }
  if (state.isPainting && state.activeTool === "brush") {
    paintCellAtEvent(event);
  }
}

function handlePanPointerDown(event) {
  if (!shouldPanEvent(event)) return;
  event.preventDefault();
  state.isPanning = true;
  state.suppressNextCanvasClick = false;
  state.panStart = {
    x: event.clientX,
    y: event.clientY,
    scrollLeft: els.canvasScroll.scrollLeft,
    scrollTop: els.canvasScroll.scrollTop
  };
  if (els.canvasScroll.setPointerCapture) els.canvasScroll.setPointerCapture(event.pointerId);
  updatePanCursor();
}

function handlePanPointerMove(event) {
  if (!state.isPanning || !state.panStart) return;
  event.preventDefault();
  const dx = event.clientX - state.panStart.x;
  const dy = event.clientY - state.panStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) state.suppressNextCanvasClick = true;
  els.canvasScroll.scrollLeft = state.panStart.scrollLeft - dx;
  els.canvasScroll.scrollTop = state.panStart.scrollTop - dy;
}

function handleWindowPointerUp(event) {
  clearAssemblyLongPress();
  finishAssemblyTouchTrail();
  finishAssemblySelection(event);
  state.isPainting = false;
  state.isPanning = false;
  state.isAssemblyPanning = false;
  state.isCropDragging = false;
  state.panStart = null;
  state.canvasPinch = null;
  state.canvasTouchPan = null;
  state.cropPinch = null;
  state.assemblyPanStart = null;
  state.assemblyPinch = null;
  state.assemblyTouchPan = null;
  state.cropDragStart = null;
  els.pixelCanvas?.classList.remove("crop-dragging");
  updatePanCursor();
}

function handleWindowKeyDown(event) {
  if (event.code !== "Space" || isTypingTarget(event.target)) return;
  event.preventDefault();
  state.spaceDown = true;
  updatePanCursor();
}

function handleWindowKeyUp(event) {
  if (event.code !== "Space") return;
  state.spaceDown = false;
  updatePanCursor();
}

function shouldPanEvent(event) {
  return event.button === 1 || state.spaceDown;
}

function updatePanCursor() {
  els.canvasScroll?.classList.toggle("pan-ready", state.spaceDown);
  els.canvasScroll?.classList.toggle("panning", state.isPanning);
  els.assemblyCanvasScroll?.classList.toggle("pan-ready", state.spaceDown);
  els.assemblyCanvasScroll?.classList.toggle("panning", state.isAssemblyPanning);
}

function isTypingTarget(target) {
  const tag = target?.tagName?.toLowerCase();
  return ["input", "textarea", "select"].includes(tag) || Boolean(target?.isContentEditable);
}

function isSourceCropInteraction() {
  return Boolean(state.image && !state.matrix && state.cropMode !== "contain");
}

function handleCropPointerDown(event) {
  const preview = getCropPreviewGeometry();
  if (!preview) return;
  const point = getCanvasPoint(event);
  if (!point || !pointInRect(point, preview.cropRect)) return;
  event.preventDefault();
  if (state.cropMode !== "manual") {
    state.cropMode = "manual";
    els.cropMode.value = "manual";
  }
  state.isCropDragging = true;
  state.cropDragStart = {
    x: event.clientX,
    y: event.clientY,
    cropX: state.cropX,
    cropY: state.cropY,
    maxX: preview.sourceCropMaxX,
    maxY: preview.sourceCropMaxY,
    ratio: preview.ratio
  };
  if (els.pixelCanvas.setPointerCapture) els.pixelCanvas.setPointerCapture(event.pointerId);
  els.pixelCanvas.classList.add("crop-dragging");
}

function handleCropPointerMove(event) {
  if (!state.cropDragStart) return;
  event.preventDefault();
  const { cropX, cropY, maxX, maxY, ratio, x, y } = state.cropDragStart;
  const dxSource = (event.clientX - x) / ratio;
  const dySource = (event.clientY - y) / ratio;
  state.cropX = sourceDeltaToCropControl(cropX, dxSource, maxX);
  state.cropY = sourceDeltaToCropControl(cropY, dySource, maxY);
  syncCropInputs();
  drawSourcePreview();
  updateCropCursorStatus(event);
}

function handleCropWheel(event) {
  event.preventDefault();
  if (state.cropMode !== "manual") {
    state.cropMode = "manual";
    els.cropMode.value = "manual";
  }
  const direction = event.deltaY < 0 ? 1 : -1;
  const step = Math.max(2, Math.round(Math.abs(event.deltaY) / 12));
  state.cropZoom = clamp(Number(state.cropZoom) + direction * step, 100, 260);
  syncCropInputs();
  drawSourcePreview();
}

function updateCropCursorStatus(event) {
  const preview = getCropPreviewGeometry();
  const point = getCanvasPoint(event);
  const overCrop = preview && point && pointInRect(point, preview.cropRect);
  els.pixelCanvas.classList.toggle("crop-ready", Boolean(overCrop));
  els.cursorStatus.textContent = overCrop ? "裁剪：拖动取景，滚轮/触摸板缩放" : "裁剪：移动到取景框内拖动";
}

function getCropPreviewGeometry() {
  if (!state.image) return null;
  const ratio = getSourcePreviewRatio();
  const targetWidth = Number(els.pixelWidth.value);
  const targetHeight = Number(els.pixelHeight.value);
  const crop = getSourceCrop(state.image.width, state.image.height, targetWidth, targetHeight);
  const cover = coverCrop(state.image.width, state.image.height, targetWidth, targetHeight);
  return {
    ratio,
    crop,
    cropRect: {
      x: crop.x * ratio,
      y: crop.y * ratio,
      width: crop.width * ratio,
      height: crop.height * ratio
    },
    sourceCropMaxX: Math.max(0, state.image.width - crop.width),
    sourceCropMaxY: Math.max(0, state.image.height - crop.height),
    cover
  };
}

function getCanvasPoint(event) {
  const rect = els.pixelCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.y >= rect.y && point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
}

function sourceDeltaToCropControl(startControl, deltaSource, maxSource) {
  if (maxSource <= 0) return 0;
  return clamp(Math.round(Number(startControl) + (deltaSource / (maxSource / 2)) * 100), -100, 100);
}

function syncCropInputs() {
  els.cropZoom.value = state.cropZoom;
  els.cropX.value = state.cropX;
  els.cropY.value = state.cropY;
  updateCropLabels();
}

function paintCellAtEvent(event) {
  const point = getCanvasCell(event);
  const blockId = getPaintBlockId();
  if (!point || !blockId) return;
  if (state.matrix.rows[point.y][point.x] === blockId) return;
  state.matrix.rows[point.y][point.x] = blockId;
  state.selectedBlockId = blockId;
  state.candidateStatus = "pending";
  state.risks = [];
  renderCanvas();
  renderStats();
}

function fillRegion(x, y, blockId) {
  if (!blockId) return;
  const target = state.matrix.rows[y][x];
  if (target === blockId) return;
  pushHistory("填充区域");
  const queue = [[x, y]];
  const { width, height, rows } = state.matrix;
  rows[y][x] = blockId;
  while (queue.length) {
    const [cx, cy] = queue.shift();
    [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ].forEach(([nx, ny]) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      if (rows[ny][nx] !== target) return;
      rows[ny][nx] = blockId;
      queue.push([nx, ny]);
    });
  }
  state.selectedBlockId = blockId;
  state.candidateStatus = "pending";
  state.risks = [];
  renderCanvas();
  renderStats();
}

function getCanvasCell(event) {
  if (!state.matrix) return null;
  const rect = els.pixelCanvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / state.zoom);
  const y = Math.floor((event.clientY - rect.top) / state.zoom);
  if (x < 0 || y < 0 || x >= state.matrix.width || y >= state.matrix.height) return null;
  return { x, y };
}

function getPaintBlockId() {
  return state.paintBlockId || getRenderPalette().find((block) => block.status === "active")?.id || null;
}

function renderStats() {
  const counts = countBlocks();
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const renderPalette = getRenderPalette();
  const used = renderPalette
    .filter((block) => counts.has(block.id))
    .sort((a, b) => a.code.localeCompare(b.code, "zh-CN", { numeric: true }));

  els.usedPalette.innerHTML = "";
  used.forEach((block) => {
    const row = document.createElement("button");
    const selectedBlock = renderPalette.find((item) => item.id === state.selectedBlockId);
    row.className = `used-row ${blocksMatch(selectedBlock, block) ? "active" : ""}`;
    row.innerHTML = `
      <span class="swatch" style="background:${rgbCss(block.rgb)}"></span>
      <span><span class="row-title">${escapeHtml(block.code)}</span><span class="row-subtitle">${counts.get(block.id)} 块</span></span>
      <strong>${counts.get(block.id)}</strong>
    `;
    row.addEventListener("click", () => {
      state.selectedBlockId = state.selectedBlockId === block.id ? null : block.id;
      renderCanvas();
      renderStats();
    });
    els.usedPalette.appendChild(row);
  });

  renderReplacementOptions();

  const activeBlocks = renderPalette.filter((block) => block.status === "active");
  if (!state.paintBlockId || !activeBlocks.some((block) => block.id === state.paintBlockId)) {
    state.paintBlockId = activeBlocks[0]?.id || null;
  }
  els.paintBlockSelect.innerHTML = activeBlocks
    .map((block) => `<option value="${block.id}">${escapeHtml(block.code)} ${escapeHtml(block.name)}</option>`)
    .join("");
  els.paintBlockSelect.value = state.paintBlockId || "";

  els.riskStatus.textContent = state.risks.length
    ? `发现 ${state.risks.reduce((sum, item) => sum + item.count, 0)} 格替代色风险`
    : total
      ? "暂无明显色差风险"
      : "暂无色差风险";

  els.undoBtn.disabled = state.history.length === 0;
  els.undoBtn.title = state.history.length ? `撤销：${state.history[state.history.length - 1].label}` : "暂无可撤销操作";
  renderCandidateHistory();

  els.riskList.innerHTML = "";
  state.risks.slice(0, 5).forEach((risk, index) => {
    const block = renderPalette.find((item) => item.id === risk.blockId);
    const row = document.createElement("div");
    row.className = "risk-row";
    const source = risk.examples[0]?.source || [0, 0, 0];
    row.innerHTML = `
      <span class="swatch" style="background:${rgbCss(source)}"></span>
      <span>${risk.count} 格覆盖不足，已替代为 ${block ? `${escapeHtml(block.code)} ${escapeHtml(block.name)}` : "未知色块"}，最高 Delta E ${risk.maxDistance.toFixed(1)}<br />建议色 ${escapeHtml(rgbCss(source))}</span>
      <button class="mini-action" data-risk-index="${index}">加入色库</button>
    `;
    row.querySelector("button").addEventListener("click", () => addRiskColor(risk));
    els.riskList.appendChild(row);
  });
}

function addCandidateSnapshot() {
  if (!state.matrix) return;
  const snapshot = {
    id: `candidate-${Date.now()}`,
    createdAt: new Date().toISOString(),
    matrix: compressMatrix(state.matrix),
    thumbnail: renderThumbnail(state.matrix, getRenderPalette()),
    width: state.matrix.width,
    height: state.matrix.height
  };
  state.candidates.unshift(snapshot);
  state.candidates = state.candidates.slice(0, 6);
}

function renderCandidateHistory() {
  els.candidateHistory.innerHTML = "";
  if (!state.candidates.length) return;
  const title = document.createElement("h2");
  title.textContent = "候选历史";
  els.candidateHistory.appendChild(title);
  state.candidates.forEach((candidate, index) => {
    const row = document.createElement("button");
    row.className = `candidate-row ${index === 0 && state.candidateStatus === "pending" ? "active" : ""}`;
    row.innerHTML = `
      <img class="candidate-thumb" alt="候选 ${index + 1}" src="${candidate.thumbnail}" />
      <span><span class="row-title">候选 ${index + 1}</span><span class="row-subtitle">${candidate.width} x ${candidate.height} · ${new Date(candidate.createdAt).toLocaleTimeString()}</span></span>
      <span>${index === 0 && state.candidateStatus === "accepted" ? "已采纳" : "查看"}</span>
    `;
    row.addEventListener("click", () => {
      state.matrix = decompressMatrix(candidate.matrix);
      state.candidateStatus = index === 0 && state.candidateStatus === "accepted" ? "accepted" : "pending";
      state.history = [];
      renderCanvas();
      renderStats();
      els.matrixStatus.textContent = `已切换到候选 ${index + 1}`;
    });
    els.candidateHistory.appendChild(row);
  });
}

function renderReplacementOptions() {
  const options = els.replacementOptions;
  if (!options || !els.replacementSelect) return;
  const activeBlocks = state.palette
    .filter((block) => block.status === "active")
    .sort((a, b) => a.code.localeCompare(b.code, "zh-CN", { numeric: true }));
  options.innerHTML = activeBlocks
    .map((block) => `<option value="${escapeHtml(block.code)}">${escapeHtml(block.code)} ${escapeHtml(block.name)}</option>`)
    .join("");
  const current = findPaletteBlockFromSearch(els.replacementSelect.value);
  if (current && !activeBlocks.some((block) => block.id === current.id)) {
    els.replacementSelect.value = "";
  }
}

function findPaletteBlockFromSearch(value) {
  const query = String(value || "").trim().toUpperCase();
  if (!query) return null;
  const code = (query.match(/^[A-Z][0-9]{1,2}/) || [query])[0];
  const activeBlocks = state.palette.filter((block) => block.status === "active");
  return (
    activeBlocks.find((block) => block.id === query) ||
    activeBlocks.find((block) => block.code.toUpperCase() === code) ||
    activeBlocks.find((block) => `${block.code} ${block.name}`.toUpperCase() === query) ||
    activeBlocks.find((block) => `${block.code} ${block.name}`.toUpperCase().includes(query)) ||
    null
  );
}

function addRiskColor(risk) {
  const source = risk.examples[0]?.source;
  if (!source) return;
  if (activePaletteCount() >= state.paletteLimit) {
    els.matrixStatus.textContent = `已达到可用色块上限 ${state.paletteLimit}，请先在色块库提高上限。`;
    return;
  }
  const code = nextCode();
  const block = {
    id: `c${Date.now()}`,
    code,
    name: `建议色 ${code}`,
    rgb: source,
    status: "active"
  };
  state.palette.push(block);
  state.editingBlockId = block.id;
  state.paintBlockId = block.id;
  savePalette();
  renderPaletteEditor();
  renderStats();
  els.matrixStatus.textContent = `已将 ${block.name} 加入色块库，可重新生成以使用新颜色`;
}

function countBlocks(matrix = state.matrix) {
  const counts = new Map();
  if (!matrix) return counts;
  matrix.rows.forEach((row) => {
    row.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  });
  return counts;
}

function replaceSelectedColor() {
  if (!state.matrix || !state.selectedBlockId || !els.replacementSelect.value) return;
  const from = state.selectedBlockId;
  const replacementBlock = findPaletteBlockFromSearch(els.replacementSelect.value);
  if (!replacementBlock) {
    els.matrixStatus.textContent = "未找到目标色号，请输入如 A2、M15 这样的色号。";
    return;
  }
  const to = replacementBlock.id;
  if (from === to) return;
  ensureProjectPaletteBlock(replacementBlock);
  const paletteMap = new Map(getRenderPalette().map((block) => [block.id, block]));
  const selectedBlock = paletteMap.get(from);
  pushHistory("全局替换色块");
  state.matrix.rows = state.matrix.rows.map((row) => row.map((id) => (blocksMatch(selectedBlock, paletteMap.get(id)) ? to : id)));
  state.selectedBlockId = to;
  els.replacementSelect.value = "";
  state.candidateStatus = "pending";
  renderCanvas();
  renderStats();
}

function ensureProjectPaletteBlock(block) {
  if (!state.projectPaletteSnapshot) return;
  if (state.projectPaletteSnapshot.some((item) => item.id === block.id)) return;
  state.projectPaletteSnapshot = [...state.projectPaletteSnapshot, normalizeBlock(block)].filter(Boolean);
}

function pushHistory(label) {
  if (!state.matrix) return;
  state.history.push({
    label,
    matrix: {
      width: state.matrix.width,
      height: state.matrix.height,
      rows: state.matrix.rows.map((row) => [...row])
    },
    selectedBlockId: state.selectedBlockId
  });
  if (state.history.length > 20) state.history.shift();
}

function undoLastEdit() {
  const snapshot = state.history.pop();
  if (!snapshot) return;
  state.matrix = snapshot.matrix;
  state.selectedBlockId = snapshot.selectedBlockId;
  renderCanvas();
  renderStats();
  els.matrixStatus.textContent = `已撤销：${snapshot.label}`;
}

function saveProject() {
  if (!state.matrix) {
    els.matrixStatus.textContent = "请先生成像素画";
    showAppFeedback("请先生成像素画", "warn");
    return;
  }
  if (state.patternParse?.failures?.length) {
    els.matrixStatus.textContent = `图纸还有 ${state.patternParse.failures.length} 格未识别，修正后才能采纳`;
    showAppFeedback("图纸还有未识别格", "warn");
    return;
  }

  const name = els.projectName.value.trim() || (state.sourceName ? state.sourceName.replace(/\.[^.]+$/, "") : "未命名作品");
  const existingProject = state.projects.find((item) => item.id === state.currentProjectId);
  const existingProgress =
    existingProject && Number(existingProject.width) === state.matrix.width && Number(existingProject.height) === state.matrix.height
      ? normalizeAssemblyProgress(existingProject.assemblyProgress, state.matrix)
      : createEmptyAssemblyProgress();
  const project = {
    id: state.currentProjectId || `p${Date.now()}`,
    name,
    inputType: state.inputType,
    width: state.matrix.width,
    height: state.matrix.height,
    pixelMatrix: compressMatrix(state.matrix),
    paletteSnapshot: getRenderPalette().filter((block) => block.status !== "deleted"),
    assemblyProgress: existingProgress,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    thumbnail: renderThumbnail(state.matrix, getRenderPalette())
  };

  const existingIndex = state.projects.findIndex((item) => item.id === project.id);
  if (existingIndex >= 0) {
    project.createdAt = state.projects[existingIndex].createdAt;
    state.projects.splice(existingIndex, 1, project);
  } else {
    state.projects.unshift(project);
  }
  state.currentProjectId = project.id;
  state.candidateStatus = "accepted";
  updateActiveCandidateFromCurrentMatrix(project.thumbnail);
  saveProjects();
  renderGallery();
  renderStats();
  els.matrixStatus.textContent = "当前结果已采纳并保存到个人图库";
  showAppFeedback("已保存到个人图库");
}

function updateActiveCandidateFromCurrentMatrix(thumbnail) {
  if (!state.matrix) return;
  if (!state.candidates.length) {
    addCandidateSnapshot();
  }
  state.candidates[0] = {
    id: state.candidates[0].id,
    createdAt: state.candidates[0].createdAt,
    matrix: compressMatrix(state.matrix),
    thumbnail,
    width: state.matrix.width,
    height: state.matrix.height
  };
}

function exportProductionFiles() {
  if (!state.matrix) {
    els.matrixStatus.textContent = "请先生成像素画";
    showAppFeedback("请先生成像素画", "warn");
    return;
  }
  downloadCanvasPng();
  downloadCsv();
  downloadMatrixCsv();
  downloadPrintHtml();
  els.matrixStatus.textContent = "已导出编号图、用量清单、坐标矩阵和分区打印版";
  showAppFeedback("生产文件已开始导出");
}

function downloadCanvasPng() {
  const exportCanvas = createProductionCanvas();
  triggerDownload(exportCanvas.toDataURL("image/png"), `pixel-production-${Date.now()}.png`);
}

function createProductionCanvas() {
  return createRegionCanvas({ startX: 0, startY: 0, width: state.matrix.width, height: state.matrix.height, title: "TOP ↑" });
}

function createRegionCanvas(region) {
  const exportCanvas = document.createElement("canvas");
  const cell = 28;
  const margin = 54;
  const { rows } = state.matrix;
  const { startX, startY, width, height, title } = region;
  exportCanvas.width = width * cell + margin * 2;
  exportCanvas.height = height * cell + margin * 2;
  const ctx = exportCanvas.getContext("2d");
  const renderPalette = getRenderPalette();
  const paletteMap = new Map(renderPalette.map((block) => [block.id, block]));

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.fillStyle = "#1d2430";
  ctx.font = "700 14px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, margin, 24);
  ctx.fillText(`${startX + 1}-${startX + width}, ${startY + 1}-${startY + height}`, margin + 92, 24);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const block = paletteMap.get(rows[startY + y][startX + x]);
      if (!block) continue;
      const left = margin + x * cell;
      const top = margin + y * cell;
      ctx.fillStyle = rgbCss(block.rgb);
      ctx.fillRect(left, top, cell, cell);
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.strokeRect(left, top, cell, cell);
      ctx.fillStyle = luminance(block.rgb) > 0.55 ? "#111827" : "#ffffff";
      ctx.font = "700 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(block.code, left + cell / 2, top + cell / 2);
    }
  }

  ctx.fillStyle = "#465466";
  ctx.font = "700 10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 0; x < width; x += 5) {
    ctx.fillText(String(startX + x + 1), margin + x * cell + cell / 2, margin - 14);
  }
  for (let y = 0; y < height; y += 5) {
    ctx.fillText(String(startY + y + 1), margin - 16, margin + y * cell + cell / 2);
  }

  return exportCanvas;
}

function downloadCsv() {
  const counts = countBlocks();
  const rows = [["编号", "名称", "RGB", "数量"]];
  getRenderPalette()
    .filter((block) => counts.has(block.id))
    .sort((a, b) => a.code.localeCompare(b.code, "zh-CN", { numeric: true }))
    .forEach((block) => rows.push([block.code, block.name, rgbCss(block.rgb), counts.get(block.id)]));

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), `pixel-counts-${Date.now()}.csv`);
}

function downloadMatrixCsv() {
  const paletteMap = new Map(getRenderPalette().map((block) => [block.id, block]));
  const rows = [["Y/X", ...Array.from({ length: state.matrix.width }, (_, index) => index + 1)]];
  state.matrix.rows.forEach((row, y) => {
    rows.push([y + 1, ...row.map((id) => paletteMap.get(id)?.code || "")]);
  });

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), `pixel-matrix-${Date.now()}.csv`);
}

function downloadPrintHtml() {
  const counts = countBlocks();
  const usageRows = getRenderPalette()
    .filter((block) => counts.has(block.id))
    .sort((a, b) => a.code.localeCompare(b.code, "zh-CN", { numeric: true }))
    .map(
      (block) =>
        `<tr><td>${escapeHtml(block.code)}</td><td>${escapeHtml(block.name)}</td><td>${escapeHtml(rgbCss(block.rgb))}</td><td>${counts.get(block.id)}</td></tr>`
    )
    .join("");
  const image = createProductionCanvas().toDataURL("image/png");
  const regions = createPrintRegions(32);
  const regionPages = regions
    .map((region, index) => {
      const regionImage = createRegionCanvas(region).toDataURL("image/png");
      const regionRows = buildUsageRows(countBlocksForRegion(region));
      return `<section class="page">
  <h2>分区 ${index + 1} / ${regions.length}</h2>
  <div class="meta">${escapeHtml(region.title)} · X ${region.startX + 1}-${region.startX + region.width} · Y ${region.startY + 1}-${region.startY + region.height}</div>
  <img src="${regionImage}" alt="分区 ${index + 1}" />
  <table>
    <thead><tr><th>编号</th><th>名称</th><th>数量</th></tr></thead>
    <tbody>${regionRows}</tbody>
  </table>
</section>`;
    })
    .join("");
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(els.projectName.value || "像素画生产单")}</title>
  <style>
    body { font-family: Arial, "PingFang SC", sans-serif; color: #1d2430; margin: 24px; }
    h1 { font-size: 22px; margin: 0 0 8px; }
    h2 { font-size: 18px; margin: 0 0 8px; }
    .meta { color: #667085; margin-bottom: 18px; }
    img { max-width: 100%; image-rendering: pixelated; border: 1px solid #d7dde5; }
    table { border-collapse: collapse; width: 100%; margin-top: 18px; page-break-inside: avoid; }
    th, td { border: 1px solid #d7dde5; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #eef2f6; }
    .page { page-break-before: always; margin-top: 28px; }
    @media print { body { margin: 12mm; } .page { break-before: page; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(els.projectName.value || "像素画生产单")}</h1>
  <div class="meta">${state.matrix.width} x ${state.matrix.height} · TOP ↑ · ${new Date().toLocaleString()}</div>
  <img src="${image}" alt="编号像素图" />
  <table>
    <thead><tr><th>编号</th><th>名称</th><th>RGB</th><th>数量</th></tr></thead>
    <tbody>${usageRows}</tbody>
  </table>
  ${regionPages}
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), `pixel-print-${Date.now()}.html`);
}

function createPrintRegions(size) {
  const regions = [];
  for (let startY = 0; startY < state.matrix.height; startY += size) {
    for (let startX = 0; startX < state.matrix.width; startX += size) {
      const col = Math.floor(startX / size) + 1;
      const row = Math.floor(startY / size) + 1;
      regions.push({
        startX,
        startY,
        width: Math.min(size, state.matrix.width - startX),
        height: Math.min(size, state.matrix.height - startY),
        title: `TOP ↑ · 区块 ${row}-${col}`
      });
    }
  }
  return regions;
}

function countBlocksForRegion(region) {
  const counts = new Map();
  for (let y = region.startY; y < region.startY + region.height; y += 1) {
    for (let x = region.startX; x < region.startX + region.width; x += 1) {
      const id = state.matrix.rows[y][x];
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

function buildUsageRows(counts) {
  return getRenderPalette()
    .filter((block) => counts.has(block.id))
    .sort((a, b) => a.code.localeCompare(b.code, "zh-CN", { numeric: true }))
    .map((block) => `<tr><td>${escapeHtml(block.code)}</td><td>${escapeHtml(block.name)}</td><td>${counts.get(block.id)}</td></tr>`)
    .join("");
}

function exportPalette() {
  const payload = {
    type: "pixel-toy-palette",
    version: 1,
    exportedAt: new Date().toISOString(),
    palette: state.palette
  };
  downloadJson(payload, `palette-${Date.now()}.json`);
  showAppFeedback("色块库已开始导出");
}

function downloadPaletteTemplate() {
  downloadJson(createPaletteTemplatePayload(), `palette-import-template-${Date.now()}.json`);
  els.matrixStatus.textContent = "已下载色块库导入模板";
  showAppFeedback("导入模板已开始下载");
}

function createPaletteTemplatePayload() {
  return {
    type: "pixel-toy-palette",
    version: 1,
    notes: "按需修改 palette 数组。字段说明：code 是色块编号，name 是色块名称，rgb 是 0-255 的 RGB 数组，stock 是当前库存数量，status 可填 active、disabled 或 deleted。",
    palette: [
      { id: "tpl-01", code: "A1", name: "示例白", rgb: [248, 248, 240], stock: 500, status: "active" },
      { id: "tpl-02", code: "A2", name: "示例黄", rgb: [245, 216, 92], stock: 300, status: "active" },
      { id: "tpl-03", code: "A3", name: "示例蓝", rgb: [62, 157, 190], stock: 80, status: "active" }
    ]
  };
}

async function importPalette(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const payload = await readJsonFile(file);
    const palette = Array.isArray(payload) ? payload : payload.palette;
    if (!Array.isArray(palette) || !palette.length) throw new Error("invalid palette");
    state.palette = palette.map(normalizeBlock).filter(Boolean);
    state.editingBlockId = state.palette[0]?.id || null;
    state.projectPaletteSnapshot = null;
    savePalette();
    renderAll();
    els.matrixStatus.textContent = `已导入 ${state.palette.length} 个色块`;
    showAppFeedback(`已导入 ${state.palette.length} 个色块`);
  } catch {
    els.matrixStatus.textContent = "色块库文件无法识别";
    showAppFeedback("色块库文件无法识别", "error");
  } finally {
    event.target.value = "";
  }
}

function exportAllProjects() {
  const payload = {
    type: "pixel-toy-gallery",
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: state.projects
  };
  downloadJson(payload, `pixel-gallery-${Date.now()}.json`);
  showAppFeedback("图库备份已开始导出");
}

async function importProject(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const payload = await readJsonFile(file);
    const incoming = payload.projects || [payload.project || payload];
    const normalized = incoming.map(normalizeProject).filter(Boolean);
    if (!normalized.length) throw new Error("invalid project");
    normalized.forEach((project) => upsertProject(project));
    saveProjects();
    renderGallery();
    els.matrixStatus.textContent = `已导入 ${normalized.length} 个作品`;
    showAppFeedback(`已导入 ${normalized.length} 个作品`);
  } catch {
    els.matrixStatus.textContent = "作品文件无法识别";
    showAppFeedback("作品文件无法识别", "error");
  } finally {
    event.target.value = "";
  }
}

function exportProject(project) {
  downloadJson(
    {
      type: "pixel-toy-project",
      version: 1,
      exportedAt: new Date().toISOString(),
      project
    },
    `${safeFilename(project.name)}-${Date.now()}.json`
  );
  showAppFeedback("作品已开始导出");
}

function deleteProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const confirmed = window.confirm(`删除作品“${project.name}”？`);
  if (!confirmed) return;
  state.projects = state.projects.filter((item) => item.id !== projectId);
  if (state.currentProjectId === projectId) state.currentProjectId = null;
  if (state.assemblyProjectId === projectId) {
    state.assemblyProjectId = null;
    state.assemblyMatrix = null;
    state.assemblyPaletteSnapshot = null;
    state.assemblyMarked = new Set();
    state.assemblySelectedBlockId = null;
    state.assemblyLocatedCell = null;
    renderAssemblyPage();
  }
  saveProjects();
  renderGallery();
}

function upsertProject(project) {
  const existingIndex = state.projects.findIndex((item) => item.id === project.id);
  if (existingIndex >= 0) {
    state.projects.splice(existingIndex, 1, project);
  } else {
    state.projects.unshift(project);
  }
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  triggerDownload(URL.createObjectURL(blob), filename);
}

function triggerDownload(href, filename) {
  if (window.PixelToyIOS && typeof window.PixelToyIOS.downloadFile === "function") {
    sendDownloadToIOS(href, filename);
    return;
  }
  if (window.PixelToyAndroid && typeof window.PixelToyAndroid.downloadFile === "function") {
    sendDownloadToAndroid(href, filename);
    return;
  }
  triggerBrowserDownload(href, filename);
}

async function sendDownloadToIOS(href, filename) {
  try {
    const dataUrl = href.startsWith("blob:") ? await blobUrlToDataUrl(href) : href;
    window.PixelToyIOS.downloadFile(dataUrl, filename);
  } catch {
    triggerBrowserDownload(href, filename);
  }
}

async function sendDownloadToAndroid(href, filename) {
  try {
    const dataUrl = href.startsWith("blob:") ? await blobUrlToDataUrl(href) : href;
    window.PixelToyAndroid.downloadFile(dataUrl, filename);
  } catch {
    triggerBrowserDownload(href, filename);
  }
}

function blobUrlToDataUrl(href) {
  return fetch(href)
    .then((response) => response.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

function triggerBrowserDownload(href, filename) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function renderPaletteEditor() {
  if (!state.editingBlockId && state.palette.length) state.editingBlockId = state.palette[0].id;
  const editing = state.palette.find((block) => block.id === state.editingBlockId);
  const activeCount = activePaletteCount();
  const lowStock = getLowStockBlocks();
  els.paletteLimit.value = state.paletteLimit;
  els.paletteLimitNotice.textContent = `当前可用色块：${activeCount} / ${state.paletteLimit}；低库存提醒：${lowStock.length} 种`;
  els.addColorBtn.disabled = activeCount >= state.paletteLimit;

  if (editing) {
    if (els.paletteEditorTitle) els.paletteEditorTitle.textContent = `${editing.code} ${editing.name}`;
    els.blockCode.value = editing.code;
    els.blockName.value = editing.name;
    els.blockColor.value = rgbToHex(editing.rgb);
    setRgbInputs(editing.rgb);
    updateColorPreview(editing.rgb);
    renderColorMap(editing.rgb);
    els.blockStock.value = normalizeStock(editing.stock);
    els.stockAddAmount.value = "";
    els.stockNotice.textContent =
      normalizeStock(editing.stock) < LOW_STOCK_THRESHOLD
        ? `${editing.code} ${editing.name} 当前库存 ${formatStock(editing.stock)} 个，低于 ${LOW_STOCK_THRESHOLD} 个。`
        : `${editing.code} ${editing.name} 当前库存 ${formatStock(editing.stock)} 个。`;
    els.stockNotice.classList.toggle("warn", normalizeStock(editing.stock) < LOW_STOCK_THRESHOLD);
    els.disableColorBtn.textContent = editing.status === "active" ? "禁用" : "启用";
    els.deleteColorBtn.textContent = editing.status === "deleted" ? "恢复" : "删除";
  }

  renderPaletteIndexBar();
  els.paletteTable.innerHTML = "";
  state.palette.forEach((block) => {
    const row = document.createElement("button");
    row.dataset.paletteLetter = getPaletteInitial(block);
    row.className = `palette-row ${state.editingBlockId === block.id ? "active" : ""}`;
    row.innerHTML = `
      <span class="swatch" style="background:${rgbCss(block.rgb)}"></span>
      <span class="row-title">${escapeHtml(block.code)}</span>
      <span class="stock-chip">库存 ${formatStock(block.stock)}</span>
      <span class="status-badge ${block.status !== "active" ? "disabled" : normalizeStock(block.stock) < LOW_STOCK_THRESHOLD ? "warn" : ""}">${
        block.status !== "active" ? statusLabel(block.status) : normalizeStock(block.stock) < LOW_STOCK_THRESHOLD ? "低库存" : "可用"
      }</span>
    `;
    row.addEventListener("click", () => {
      state.editingBlockId = block.id;
      renderPaletteEditor();
      revealPaletteEditorOnMobile();
    });
    els.paletteTable.appendChild(row);
  });
}

function renderPaletteIndexBar() {
  if (!els.paletteIndexBar) return;
  const letters = [...new Set(state.palette.map(getPaletteInitial).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "zh-CN", { numeric: true })
  );
  els.paletteIndexBar.innerHTML = letters
    .map((letter) => `<button type="button" data-letter="${escapeHtml(letter)}">${escapeHtml(letter)}</button>`)
    .join("");
  els.paletteIndexBar.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => scrollToPaletteInitial(button.dataset.letter));
  });
}

function getPaletteInitial(block) {
  const first = String(block?.code || block?.name || "").trim().charAt(0);
  return /^[a-z]$/i.test(first) ? first.toUpperCase() : "";
}

function scrollToPaletteInitial(letter) {
  if (!letter) return;
  const target = els.paletteTable?.querySelector(`[data-palette-letter="${letter}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveEditingColor() {
  const block = state.palette.find((item) => item.id === state.editingBlockId);
  if (!block) return;
  block.code = els.blockCode.value.trim() || block.code;
  block.name = els.blockName.value.trim() || block.name;
  block.rgb = getRgbInputs();
  block.stock = normalizeStock(els.blockStock.value);
  savePalette();
  renderPaletteEditor();
  renderStats();
  renderCanvas();
  renderDashboard();
}

function addStockToEditingColor() {
  openStockAdjustModal(1);
}

function deductStockFromEditingColor() {
  openStockAdjustModal(-1);
}

function openStockAdjustModal(direction) {
  const block = state.palette.find((item) => item.id === state.editingBlockId);
  if (!block) return;
  state.stockAdjustDirection = direction < 0 ? -1 : 1;
  els.stockAdjustTitle.textContent = state.stockAdjustDirection > 0 ? "入库" : "扣减";
  els.stockAdjustTarget.textContent = `${block.code} ${block.name} · 当前库存 ${formatStock(block.stock)}`;
  els.stockAdjustAmount.value = "";
  els.stockAdjustNotice.textContent = state.stockAdjustDirection > 0 ? "输入要增加的数量。" : "输入要扣减的数量，库存不会低于 0。";
  els.stockAdjustNotice.classList.remove("warn");
  els.stockAdjustModal.hidden = false;
  requestAnimationFrame(() => els.stockAdjustAmount.focus());
}

function closeStockAdjustModal() {
  els.stockAdjustModal.hidden = true;
}

function confirmStockAdjustModal() {
  const amount = normalizeStock(els.stockAdjustAmount.value);
  if (!amount) {
    els.stockAdjustNotice.textContent = "请输入大于 0 的数量。";
    els.stockAdjustNotice.classList.add("warn");
    return;
  }
  adjustEditingColorStock(state.stockAdjustDirection, amount);
  closeStockAdjustModal();
}

function adjustEditingColorStock(direction, amount) {
  const block = state.palette.find((item) => item.id === state.editingBlockId);
  if (!block) return;
  block.stock = Math.max(0, normalizeStock(block.stock) + normalizeStock(amount) * direction);
  savePalette();
  renderPaletteEditor();
  renderStats();
  renderAssemblyPage();
  renderDashboard();
}

function openStockBatchModal() {
  updateStockBatchNotice();
  els.stockBatchModal.hidden = false;
}

function closeStockBatchModal() {
  els.stockBatchModal.hidden = true;
}

function getStockBatchTargets() {
  const scope = els.stockBatchScope.value;
  if (scope === "low") return getLowStockBlocks();
  if (scope === "all") return state.palette.filter((block) => block.status !== "deleted");
  return state.palette.filter((block) => block.status === "active");
}

function updateStockBatchNotice() {
  if (!els.stockBatchNotice) return;
  const targets = getStockBatchTargets();
  const amount = normalizeStock(els.stockBatchAmount.value);
  const mode = els.stockBatchMode.value;
  const actionLabel = mode === "set" ? `设为 ${amount}` : mode === "add" ? `补充 ${amount}` : `扣减 ${amount}`;
  els.stockBatchNotice.textContent = `将对 ${targets.length} 个色块执行：库存${actionLabel}。`;
  els.stockBatchNotice.classList.toggle("warn", mode === "subtract" && amount > 0);
}

function applyStockBatchOperation() {
  const targets = getStockBatchTargets();
  const amount = normalizeStock(els.stockBatchAmount.value);
  const mode = els.stockBatchMode.value;
  if (!targets.length) {
    els.stockBatchNotice.textContent = "当前范围内没有可修改的色块。";
    els.stockBatchNotice.classList.add("warn");
    return;
  }
  if (mode !== "set" && !amount) {
    els.stockBatchNotice.textContent = "批量补充或扣减时，请输入大于 0 的数量。";
    els.stockBatchNotice.classList.add("warn");
    return;
  }
  targets.forEach((block) => {
    const current = normalizeStock(block.stock);
    if (mode === "set") block.stock = amount;
    if (mode === "add") block.stock = current + amount;
    if (mode === "subtract") block.stock = Math.max(0, current - amount);
  });
  savePalette();
  renderPaletteEditor();
  renderStats();
  renderAssemblyPage();
  renderDashboard();
  updateStockBatchNotice();
  els.stockBatchNotice.textContent = `已更新 ${targets.length} 个色块库存。`;
  els.stockBatchNotice.classList.remove("warn");
}

function disableEditingColor() {
  const block = state.palette.find((item) => item.id === state.editingBlockId);
  if (!block) return;
  if (block.status !== "active" && activePaletteCount() >= state.paletteLimit) {
    els.paletteLimitNotice.textContent = `已达到可用色块上限 ${state.paletteLimit}，无法启用更多色块。`;
    return;
  }
  block.status = block.status === "active" ? "disabled" : "active";
  savePalette();
  renderPaletteEditor();
}

function deleteEditingColor() {
  const block = state.palette.find((item) => item.id === state.editingBlockId);
  if (!block) return;
  const used = state.matrix && countBlocks().has(block.id);
  if (block.status !== "deleted" && used && !window.confirm("当前画布正在使用这个色块，删除后新生成不再可用，历史画布仍会保留快照。继续？")) return;
  block.status = block.status === "deleted" ? "disabled" : "deleted";
  savePalette();
  renderPaletteEditor();
  renderStats();
}

function savePalette() {
  state.palette = state.palette.map(normalizeBlock).filter(Boolean);
  markUserDataTouched();
  saveJson(STORAGE_KEYS.palette, state.palette);
  apiRequest("/api/palette", { method: "PUT", body: { palette: state.palette } });
  renderDashboard();
}

function savePaletteLimit() {
  markUserDataTouched();
  saveJson("pixelToy.paletteLimit.v1", state.paletteLimit);
  apiRequest("/api/palette-limit", { method: "PUT", body: { paletteLimit: state.paletteLimit } });
}

function activePaletteCount() {
  return state.palette.filter((block) => block.status === "active").length;
}

function blocksMatch(a, b) {
  if (!a || !b) return false;
  return a.name === b.name && rgbKey(a.rgb) === rgbKey(b.rgb);
}

function saveProjects() {
  markUserDataTouched();
  saveJson(STORAGE_KEYS.projects, state.projects);
  apiRequest("/api/projects", { method: "PUT", body: { projects: state.projects } });
  renderDashboard();
}

function renderGallery() {
  els.galleryGrid.innerHTML = "";
  state.projects.forEach((project) => {
    const progress = getProjectAssemblySummary(project);
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.innerHTML = `
      <img class="thumb" alt="${escapeHtml(project.name)}" src="${project.thumbnail}" />
      <span>
        <span class="row-title">${escapeHtml(project.name)}</span>
        <span class="card-meta">${project.width} x ${project.height} · 拼装 ${progress.percent}% · ${new Date(project.updatedAt || project.createdAt).toLocaleString()}</span>
        <span class="card-actions">
          <button class="mini-action" data-action="open">打开</button>
          <button class="mini-action" data-action="assembly">${progress.marked ? "继续拼装" : "开始拼装"}</button>
          <button class="mini-action danger-action" data-action="complete" ${progress.remaining ? "" : "disabled"}>${
      progress.remaining ? "一键完成" : "已完成"
    }</button>
          <button class="mini-action" data-action="export">导出</button>
          <button class="mini-action" data-action="delete">删除</button>
        </span>
      </span>
    `;
    card.addEventListener("click", (event) => {
      const actionButton = event.target?.closest?.("[data-action]");
      if (actionButton?.disabled) return;
      const action = actionButton?.dataset?.action;
      if (action === "export") {
        exportProject(project);
        return;
      }
      if (action === "delete") {
        deleteProject(project.id);
        return;
      }
      if (action === "assembly") {
        openAssemblyProject(project);
        return;
      }
      if (action === "complete") {
        completeProjectAssembly(project);
        return;
      }
      if (action === "open" || event.target === card || card.contains(event.target)) {
        openProject(project);
      }
    });
    els.galleryGrid.appendChild(card);
  });
}

function completeProjectAssembly(project) {
  if (!project?.pixelMatrix) return;
  const matrix = decompressMatrix(project.pixelMatrix);
  const progress = normalizeAssemblyProgress(project.assemblyProgress, matrix);
  const marked = new Set(progress.marked);
  const allKeys = [];
  const inventoryChanges = new Map();
  let newlyMarked = 0;

  matrix.rows.forEach((row, y) => {
    row.forEach((blockId, x) => {
      const key = assemblyKey(x, y);
      allKeys.push(key);
      if (marked.has(key)) return;
      newlyMarked += 1;
      inventoryChanges.set(blockId, (inventoryChanges.get(blockId) || 0) - 1);
    });
  });

  if (!newlyMarked) {
    showAppFeedback("该作品已经拼装完成");
    return;
  }

  const usedColorCount = inventoryChanges.size;
  const ok = window.confirm(
    `确定将“${project.name}”标记为拼装完成？\n\n将新增完成 ${newlyMarked} 格，涉及 ${usedColorCount} 种色块，并自动扣减色块库库存。库存不会低于 0。`
  );
  if (!ok) return;

  project.assemblyProgress = {
    version: 1,
    marked: sortAssemblyKeys(allKeys, matrix),
    updatedAt: new Date().toISOString()
  };
  project.updatedAt = project.assemblyProgress.updatedAt;
  adjustInventoryForProjectChanges(inventoryChanges, project.paletteSnapshot || []);
  saveProjects();

  if (state.assemblyProjectId === project.id) {
    state.assemblyMatrix = matrix;
    state.assemblyPaletteSnapshot = project.paletteSnapshot || [];
    state.assemblyMarked = new Set(project.assemblyProgress.marked);
    state.assemblyLocatedCell = null;
    renderAssemblyPage();
  }

  renderGallery();
  renderPaletteEditor();
  renderStats();
  renderDashboard();
  showAppFeedback(`已完成 ${newlyMarked} 格并扣减库存`);
}

function openProject(project) {
  state.matrix = decompressMatrix(project.pixelMatrix);
  state.projectPaletteSnapshot = project.paletteSnapshot;
  state.currentProjectId = project.id;
  state.selectedBlockId = null;
  state.history = [];
  state.risks = [];
  state.candidateStatus = "accepted";
  state.candidates = [
    {
      id: `candidate-${project.id}`,
      createdAt: project.updatedAt || project.createdAt,
      matrix: project.pixelMatrix,
      thumbnail: project.thumbnail,
      width: project.width,
      height: project.height
    }
  ];
  els.projectName.value = project.name;
  renderAll();
  switchPanel("workspace");
  els.matrixStatus.textContent = `已打开图库作品：${project.name}`;
  scrollElementIntoMobileView(els.canvasScroll);
}

function openAssemblyProject(project) {
  loadAssemblyProject(project);
  switchPanel("assembly");
  scrollElementIntoMobileView(els.assemblyCanvasScroll);
}

function loadAssemblyProject(project) {
  if (!project?.pixelMatrix) return;
  state.assemblyMatrix = decompressMatrix(project.pixelMatrix);
  state.assemblyPaletteSnapshot = project.paletteSnapshot || [];
  state.assemblyProjectId = project.id;
  state.assemblyMarked = new Set(normalizeAssemblyProgress(project.assemblyProgress, state.assemblyMatrix).marked);
  state.assemblySelectedBlockId = null;
  state.assemblyLocatedCell = null;
  state.assemblyZoom = clamp(Number(state.assemblyZoom) || 16, 4, 64);
  state.assemblyShowLabels = state.assemblyZoom >= 20;
}

function normalizeProject(project) {
  if (!project?.pixelMatrix || !Array.isArray(project?.paletteSnapshot)) return null;
  const matrix = decompressMatrix(project.pixelMatrix);
  return {
    id: project.id || `p${Date.now()}`,
    name: project.name || "导入作品",
    inputType: project.inputType || "cartoon",
    width: Number(project.width) || project.pixelMatrix.width,
    height: Number(project.height) || project.pixelMatrix.height,
    pixelMatrix: project.pixelMatrix,
    paletteSnapshot: project.paletteSnapshot.map(normalizeBlock).filter(Boolean),
    assemblyProgress: normalizeAssemblyProgress(project.assemblyProgress, matrix),
    createdAt: project.createdAt || new Date().toISOString(),
    updatedAt: project.updatedAt || new Date().toISOString(),
    thumbnail: project.thumbnail || renderThumbnail(matrix, project.paletteSnapshot)
  };
}

function getAssemblyPalette() {
  return state.assemblyPaletteSnapshot || [];
}

function getAssemblyProject() {
  return state.projects.find((project) => project.id === state.assemblyProjectId) || null;
}

function saveAssemblyProgress() {
  const project = getAssemblyProject();
  if (!project || !state.assemblyMatrix) return;
  project.assemblyProgress = {
    version: 1,
    marked: sortAssemblyKeys([...state.assemblyMarked], state.assemblyMatrix),
    updatedAt: new Date().toISOString()
  };
  project.updatedAt = project.assemblyProgress.updatedAt;
  saveProjects();
}

function saveAssemblyProgressManually() {
  const project = getAssemblyProject();
  if (!project || !state.assemblyMatrix) {
    els.assemblyNotice.textContent = "请先从图库选择一个作品，再保存拼装进度。";
    showAppFeedback("请先从图库选择作品", "warn");
    return;
  }
  saveAssemblyProgress();
  const progress = getProjectAssemblySummary(project);
  els.assemblyProgressStatus.textContent = `${progress.marked}/${progress.total}`;
  els.assemblyNotice.textContent = "拼装进度已保存，下次从图库点击“继续拼装”即可接着做。";
  renderGallery();
  showAppFeedback("拼装进度已保存");
}

function getProjectAssemblySummary(project) {
  const width = Number(project?.width) || Number(project?.pixelMatrix?.width) || 0;
  const height = Number(project?.height) || Number(project?.pixelMatrix?.height) || 0;
  const total = width * height;
  const progress = normalizeAssemblyProgress(project?.assemblyProgress, { width, height, rows: [] });
  const marked = progress.marked.length;
  return {
    total,
    marked,
    remaining: Math.max(0, total - marked),
    percent: total ? Math.round((marked / total) * 100) : 0
  };
}

function createEmptyAssemblyProgress() {
  return {
    version: 1,
    marked: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizeAssemblyProgress(progress = {}, matrix = null) {
  const width = Number(matrix?.width) || Number.POSITIVE_INFINITY;
  const height = Number(matrix?.height) || Number.POSITIVE_INFINITY;
  const source = Array.isArray(progress?.marked) ? progress.marked : [];
  const seen = new Set();
  source.forEach((item) => {
    const point = parseAssemblyKey(item);
    if (!point) return;
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return;
    seen.add(assemblyKey(point.x, point.y));
  });
  return {
    version: 1,
    marked: sortAssemblyKeys([...seen], matrix),
    updatedAt: progress?.updatedAt || new Date().toISOString()
  };
}

function assemblyKey(x, y) {
  return `${x},${y}`;
}

function parseAssemblyKey(key) {
  if (typeof key !== "string") return null;
  const [x, y] = key.split(",").map(Number);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

function sortAssemblyKeys(keys, matrix = null) {
  return keys
    .map(parseAssemblyKey)
    .filter(Boolean)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((point) => assemblyKey(point.x, point.y));
}

function normalizeBlock(block) {
  if (!block) return null;
  const rgb = Array.isArray(block.rgb) ? block.rgb.map((value) => clamp(Number(value), 0, 255)) : hexToRgb(block.hex || "#000000");
  return {
    id: block.id || `c${Date.now()}${Math.round(Math.random() * 1000)}`,
    code: String(block.code || block.id || nextCode()).slice(0, 8),
    name: String(block.name || "未命名色块").slice(0, 24),
    rgb,
    status: ["active", "disabled", "deleted"].includes(block.status) ? block.status : "active",
    stock: normalizeStock(block.stock ?? block.inventory ?? block.quantity ?? 0)
  };
}

function normalizeStock(value) {
  return Math.max(0, Math.floor(clamp(Number(value) || 0, 0, 999999)));
}

function formatStock(value) {
  return String(normalizeStock(value));
}

function getLowStockBlocks() {
  return state.palette
    .filter((block) => block.status === "active" && normalizeStock(block.stock) < LOW_STOCK_THRESHOLD)
    .sort((a, b) => normalizeStock(a.stock) - normalizeStock(b.stock) || a.code.localeCompare(b.code, "zh-CN", { numeric: true }));
}

function statusLabel(status) {
  if (status === "active") return "可用";
  if (status === "deleted") return "已删除";
  return "禁用";
}

function compressMatrix(matrix) {
  return {
    width: matrix.width,
    height: matrix.height,
    rows: matrix.rows.map((row) => {
      const runs = [];
      let current = row[0];
      let count = 0;
      row.forEach((id) => {
        if (id === current) {
          count += 1;
        } else {
          runs.push([current, count]);
          current = id;
          count = 1;
        }
      });
      runs.push([current, count]);
      return runs;
    })
  };
}

function decompressMatrix(compressed) {
  return {
    width: compressed.width,
    height: compressed.height,
    rows: compressed.rows.map((runs) => runs.flatMap(([id, count]) => Array.from({ length: count }, () => id)))
  };
}

function renderThumbnail(matrix, palette) {
  const canvas = document.createElement("canvas");
  const size = 168;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cell = Math.max(1, Math.floor(size / Math.max(matrix.width, matrix.height)));
  const left = Math.floor((size - matrix.width * cell) / 2);
  const top = Math.floor((size - matrix.height * cell) / 2);
  const paletteMap = new Map(palette.map((block) => [block.id, block]));
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  matrix.rows.forEach((row, y) => {
    row.forEach((id, x) => {
      const block = paletteMap.get(id);
      if (!block) return;
      ctx.fillStyle = rgbCss(block.rgb);
      ctx.fillRect(left + x * cell, top + y * cell, cell, cell);
    });
  });
  return canvas.toDataURL("image/png");
}

function getRenderPalette() {
  return state.projectPaletteSnapshot || state.palette;
}

function renderAiSettings() {
  state.settings = normalizeSettings(state.settings);
  const config = getActiveAiConfig();
  els.aiConfigSelect.innerHTML = state.settings.configs
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)} · ${escapeHtml(item.provider)}</option>`)
    .join("");
  els.aiConfigSelect.value = config.id;
  els.aiProvider.value = config.provider || "local";
  els.aiModel.value = config.model || "gpt-image-1.5";
  els.aiEndpoint.value = config.endpoint || "";
  els.aiKey.value = "";
  els.aiKey.placeholder = state.serverMode
    ? config.apiKeyPresent
      ? "已由本机服务保存，留空表示不修改"
      : "保存后写入本机 data/settings.json"
    : "静态版只保存到当前浏览器";
  els.aiPrompt.value = config.prompt || DEFAULT_SETTINGS.configs[0].prompt;
  els.aiEnabled.checked = Boolean(config.enabled);
  els.deleteAiConfigBtn.disabled = state.settings.configs.length <= 1;
  if (config.enabled && state.serverMode) {
    els.aiNotice.textContent = `已启用 ${config.name}。真实照片生成时会优先尝试云端卡通化。`;
  } else if (config.enabled) {
    els.aiNotice.textContent = `已启用 ${config.name}，但静态版会使用本地预处理替代云端调用。`;
  } else if (state.serverMode) {
    els.aiNotice.textContent = "当前未启用云端卡通化；真实照片会使用本地预处理。";
  } else {
    els.aiNotice.textContent = "静态版默认使用本地卡通化预处理；需要云端模型时请通过本机服务入口打开。";
  }
}

function saveAiSettings() {
  saveAiFormToActiveConfig(true);
  saveJson(STORAGE_KEYS.settings, state.settings);
  apiRequest("/api/settings", {
    method: "PUT",
    body: withSubmittedApiKey(state.settings, els.aiKey.value)
  }).then((result) => {
    if (result?.settings) state.settings = normalizeSettings(result.settings);
    renderAiSettings();
    els.aiNotice.textContent = state.serverMode ? "AI 设置已保存到本机服务。" : "AI 设置已保存到本机浏览器。";
    showAppFeedback("AI 设置已保存");
  });
}

function testAiSettings() {
  saveAiFormToActiveConfig(false);
  if (state.serverMode) {
    apiRequest("/api/test-ai", { method: "POST", body: {} }).then((result) => {
      els.aiNotice.textContent = result?.message || "AI 设置检查完成。";
      showAppFeedback("AI 设置检查完成");
    });
    return;
  }
  const hasKey = els.aiProvider.value === "local" || els.aiKey.value.trim().length > 0;
  els.aiNotice.textContent = hasKey ? "设置格式可用。" : "请填写 API Key，或将供应商切换为本地模拟。";
  showAppFeedback(hasKey ? "设置格式可用" : "请填写 API Key", hasKey ? "success" : "warn");
}

async function runDiagnostics() {
  const panel = els.diagnosticsPanel;
  panel.classList.add("active");
  panel.innerHTML = "正在检查运行状态...";

  if (!state.serverMode) {
    panel.innerHTML = `
      <strong>运行模式</strong>：静态版<br />
      <strong>数据保存</strong>：浏览器本地存储<br />
      <strong>云端 AI</strong>：不可直接调用，会回退到本地预处理<br />
      <strong>色块数</strong>：${activePaletteCount()} / ${state.paletteLimit}<br />
      <strong>图库作品</strong>：${state.projects.length}
    `;
    return;
  }

  const diagnostics = await apiRequest("/api/diagnostics", { method: "GET" });
  if (!diagnostics) {
    panel.innerHTML = "无法读取本机服务诊断信息。";
    return;
  }

  const files = diagnostics.dataFiles || {};
  const ai = diagnostics.activeAiConfig;
  panel.innerHTML = `
    <strong>运行模式</strong>：${escapeHtml(diagnostics.mode)}<br />
    <strong>运行时</strong>：${escapeHtml(diagnostics.runtime || "未知")}<br />
    <strong>数据目录</strong>：${escapeHtml(diagnostics.dataDir || "未知")}<br />
    <strong>数据文件</strong>：色块 ${files.palette ? "已保存" : "未创建"}，图库 ${files.projects ? "已保存" : "未创建"}，设置 ${files.settings ? "已保存" : "未创建"}<br />
    <strong>启用模型</strong>：${ai ? `${escapeHtml(ai.name)}（${escapeHtml(ai.provider)} / ${escapeHtml(ai.model)}）` : "未配置"}<br />
    <strong>API Key</strong>：${ai?.apiKeyPresent ? "已保存" : "未保存"}
  `;
}

async function openDataDir() {
  if (!state.serverMode) {
    els.aiNotice.textContent = "静态版没有数据目录；数据保存在浏览器本地存储。";
    showAppFeedback("静态版没有数据目录", "warn");
    return;
  }
  const result = await apiRequest("/api/open-data-dir", { method: "POST", body: {} });
  els.aiNotice.textContent = result?.ok ? "已请求打开数据目录。" : "无法打开数据目录，请运行诊断查看路径。";
  showAppFeedback(result?.ok ? "已请求打开数据目录" : "无法打开数据目录", result?.ok ? "success" : "error");
}

async function backupAllData() {
  let payload;
  if (state.serverMode) {
    payload = await apiRequest("/api/backup", { method: "GET" });
  }
  if (!payload) {
    payload = {
      type: "pixel-toy-full-backup",
      version: 1,
      mode: "static-local-storage",
      exportedAt: new Date().toISOString(),
      palette: state.palette,
      projects: state.projects,
      paletteLimit: state.paletteLimit,
      settings: normalizeSettings(state.settings)
    };
  }
  downloadJson(payload, `pixel-toy-backup-${Date.now()}.json`);
  els.aiNotice.textContent = "已导出完整数据备份。";
  showAppFeedback("完整备份已开始导出");
}

async function restoreFullBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const payload = await readJsonFile(file);
    const backup = normalizeFullBackup(payload);
    if (!backup) throw new Error("invalid backup");
    const confirmed = window.confirm("恢复完整备份会替换当前色块库、图库和 AI 设置。继续？");
    if (!confirmed) return;

    state.palette = backup.palette;
    state.projects = backup.projects;
    state.paletteLimit = backup.paletteLimit;
    state.settings = backup.settings;
    state.editingBlockId = state.palette[0]?.id || null;
    state.currentProjectId = null;
    state.matrix = null;
    state.projectPaletteSnapshot = null;
    state.candidateStatus = "empty";
    state.candidates = [];
    state.risks = [];
    state.history = [];
    state.selectedBlockId = null;
    state.assemblyProjectId = null;
    state.assemblyMatrix = null;
    state.assemblyPaletteSnapshot = null;
    state.assemblyMarked = new Set();
    state.assemblySelectedBlockId = null;
    state.assemblyLocatedCell = null;

    markUserDataTouched();
    saveJson(STORAGE_KEYS.palette, state.palette);
    saveJson(STORAGE_KEYS.projects, state.projects);
    saveJson("pixelToy.paletteLimit.v1", state.paletteLimit);
    saveJson(STORAGE_KEYS.settings, state.settings);

    if (state.serverMode) {
      const result = await apiRequest("/api/restore", { method: "POST", body: backup });
      if (!result?.ok) throw new Error("restore failed");
    }

    renderAll();
    els.aiNotice.textContent = `已恢复完整备份：${state.palette.length} 个色块，${state.projects.length} 个作品。`;
    els.matrixStatus.textContent = "完整备份已恢复";
    showAppFeedback("完整备份已恢复");
  } catch {
    els.aiNotice.textContent = "完整备份文件无法识别或恢复失败。";
    showAppFeedback("完整备份恢复失败", "error");
  } finally {
    event.target.value = "";
  }
}

function normalizeFullBackup(payload) {
  if (!payload || payload.type !== "pixel-toy-full-backup") return null;
  const palette = Array.isArray(payload.palette) ? payload.palette.map(normalizeBlock).filter(Boolean) : [];
  const projects = Array.isArray(payload.projects) ? payload.projects.map(normalizeProject).filter(Boolean) : [];
  const settings = normalizeSettings(payload.settings || DEFAULT_SETTINGS);
  const paletteLimit = clamp(Number(payload.paletteLimit) || Math.max(DEFAULT_PALETTE.length, palette.length, 1), 1, 999);
  return {
    type: "pixel-toy-full-backup",
    version: 1,
    palette,
    projects,
    paletteLimit,
    settings
  };
}

function addAiConfig() {
  saveAiFormToActiveConfig(false);
  const id = `model-${Date.now()}`;
  state.settings.configs.push({
    id,
    name: `模型配置 ${state.settings.configs.length + 1}`,
    provider: "openai",
    model: "gpt-image-1.5",
    endpoint: "",
    apiKey: "",
    apiKeyPresent: false,
    prompt: DEFAULT_SETTINGS.configs[0].prompt,
    enabled: true
  });
  state.settings.activeConfigId = id;
  renderAiSettings();
}

function deleteAiConfig() {
  if (state.settings.configs.length <= 1) return;
  const config = getActiveAiConfig();
  if (!window.confirm(`删除模型配置“${config.name}”？`)) return;
  state.settings.configs = state.settings.configs.filter((item) => item.id !== config.id);
  state.settings.activeConfigId = state.settings.configs[0].id;
  saveJson(STORAGE_KEYS.settings, state.settings);
  apiRequest("/api/settings", { method: "PUT", body: state.settings });
  renderAiSettings();
}

function saveAiFormToActiveConfig(includeKey) {
  state.settings = normalizeSettings(state.settings);
  const config = getActiveAiConfig();
  config.provider = els.aiProvider.value;
  config.model = els.aiModel.value.trim() || "gpt-image-1.5";
  config.endpoint = els.aiEndpoint.value.trim();
  config.prompt = els.aiPrompt.value.trim() || DEFAULT_SETTINGS.configs[0].prompt;
  config.enabled = els.aiEnabled.checked;
  config.name = `${providerLabel(config.provider)} · ${config.model}`;
  if (includeKey && !state.serverMode) {
    config.apiKey = els.aiKey.value;
    config.apiKeyPresent = Boolean(els.aiKey.value);
  }
  if (includeKey && state.serverMode && els.aiKey.value) {
    config.apiKeyPresent = true;
  }
}

function getActiveAiConfig(settings = state.settings) {
  const normalized = normalizeSettings(settings);
  return normalized.configs.find((item) => item.id === normalized.activeConfigId) || normalized.configs[0];
}

function normalizeSettings(settings) {
  if (settings?.configs?.length) {
    return {
      activeConfigId: settings.activeConfigId || settings.configs[0].id,
      configs: settings.configs.map((config) => ({
        id: config.id || `model-${Date.now()}`,
        name: config.name || `${providerLabel(config.provider || "local")} · ${config.model || "local-cartoon-preprocess"}`,
        provider: config.provider || "local",
        model: config.model || "local-cartoon-preprocess",
        endpoint: config.endpoint || "",
        apiKey: config.apiKey || "",
        apiKeyPresent: Boolean(config.apiKeyPresent || config.apiKey),
        prompt: config.prompt || DEFAULT_SETTINGS.configs[0].prompt,
        enabled: Boolean(config.enabled)
      }))
    };
  }
  const legacy = settings || {};
  const config = {
    id: "legacy-config",
    name: `${providerLabel(legacy.provider || "local")} · ${legacy.model || "local-cartoon-preprocess"}`,
    provider: legacy.provider || "local",
    model: legacy.model || "local-cartoon-preprocess",
    endpoint: legacy.endpoint || "",
    apiKey: legacy.apiKey || "",
    apiKeyPresent: Boolean(legacy.apiKeyPresent || legacy.apiKey),
    prompt: legacy.prompt || DEFAULT_SETTINGS.configs[0].prompt,
    enabled: Boolean(legacy.enabled)
  };
  return { activeConfigId: config.id, configs: [config] };
}

function withSubmittedApiKey(settings, apiKey) {
  const copy = structuredClone(normalizeSettings(settings));
  const active = copy.configs.find((item) => item.id === copy.activeConfigId);
  if (active && apiKey) active.apiKey = apiKey;
  return copy;
}

function providerLabel(provider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "custom") return "自定义";
  return "本地";
}

function rgbToLab(rgb) {
  let [r, g, b] = rgb.map((value) => value / 255);
  [r, g, b] = [r, g, b].map((value) => (value > 0.04045 ? ((value + 0.055) / 1.055) ** 2.4 : value / 12.92));
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  [x, y, z] = [x, y, z].map((value) => (value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116));
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaE76(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function setRgbInputs(rgb) {
  [els.blockR.value, els.blockG.value, els.blockB.value] = rgb;
}

function updateColorPreview(rgb) {
  const value = rgbCss(rgb);
  els.blockColorPreview.style.background = value;
  els.blockColorValue.textContent = value;
}

function renderColorMap(selectedRgb = getRgbInputs()) {
  const canvas = els.colorMap;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const hue = (x / (width - 1)) * 360;
      const lightness = 92 - (y / (height - 1)) * 74;
      const saturation = 92;
      const [r, g, b] = hslToRgb(hue, saturation, lightness);
      const index = (y * width + x) * 4;
      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const marker = approximateColorMapPosition(selectedRgb, width, height);
  ctx.strokeStyle = luminance(selectedRgb) > 0.45 ? "#111827" : "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 9, 0, Math.PI * 2);
  ctx.stroke();
}

function handleColorMapClick(event) {
  const rect = els.colorMap.getBoundingClientRect();
  const x = clamp(Math.round(((event.clientX - rect.left) / rect.width) * (els.colorMap.width - 1)), 0, els.colorMap.width - 1);
  const y = clamp(Math.round(((event.clientY - rect.top) / rect.height) * (els.colorMap.height - 1)), 0, els.colorMap.height - 1);
  const hue = (x / (els.colorMap.width - 1)) * 360;
  const lightness = 92 - (y / (els.colorMap.height - 1)) * 74;
  const rgb = hslToRgb(hue, 92, lightness);
  setRgbInputs(rgb);
  els.blockColor.value = rgbToHex(rgb);
  updateColorPreview(rgb);
  renderColorMap(rgb);
}

function hslToRgb(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const h = hue / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (h >= 0 && h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)].map((value) => clamp(value, 0, 255));
}

function rgbToHsl(rgb) {
  const [r, g, b] = rgb.map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness * 100];
  const delta = max - min;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  return [(hue + 360) % 360, saturation * 100, lightness * 100];
}

function approximateColorMapPosition(rgb, width, height) {
  const [hue, , lightness] = rgbToHsl(rgb);
  return {
    x: clamp(Math.round((hue / 360) * (width - 1)), 0, width - 1),
    y: clamp(Math.round(((92 - lightness) / 74) * (height - 1)), 0, height - 1)
  };
}

function updateCropLabels() {
  els.cropZoomValue.textContent = `${state.cropZoom}%`;
  els.cropXValue.textContent = String(state.cropX);
  els.cropYValue.textContent = String(state.cropY);
  const isManual = state.cropMode === "manual";
  [els.cropZoom, els.cropX, els.cropY].forEach((input) => {
    input.disabled = !isManual;
  });
}

function getRgbInputs() {
  return [els.blockR, els.blockG, els.blockB].map((input) => clamp(Number(input.value), 0, 255));
}

function rgbCss(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function rgbKey(rgb) {
  return rgb.map((value) => clamp(Number(value), 0, 255)).join(",");
}

function rgbToHex(rgb) {
  return `#${rgb.map((value) => clamp(value, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
}

function nextCode() {
  const max = state.palette.reduce((highest, block) => Math.max(highest, Number(block.code) || 0), 0);
  return String(max + 1).padStart(2, "0");
}

function safeFilename(value) {
  return String(value || "pixel-project")
    .replace(/[\\/:*?"<>|]/g, "-")
    .slice(0, 80);
}

function imageToDataUrl(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function markUserDataTouched() {
  saveJson(STORAGE_KEYS.userDataTouched, true);
}

async function loadBundledDefaults() {
  if (state.serverMode) return;
  const manifest = await fetchBundledJson("defaults/manifest.json");
  const hasUserDataTouched = loadJson(STORAGE_KEYS.userDataTouched, false) === true;
  const bundledDefaultsVersion = loadJson(STORAGE_KEYS.bundledDefaults, "");
  const repairPlan = getMobileDefaultRepairPlan(manifest);
  const shouldRefreshMobileDefaults =
    isBundledMobileRuntime() && !hasUserDataTouched && manifest?.version && bundledDefaultsVersion !== manifest.version;
  const defaultSpecs = [
    {
      key: STORAGE_KEYS.palette,
      stateKey: "palette",
      file: "defaults/palette.json",
      normalize: (value) => value.map(normalizeBlock).filter(Boolean),
      refreshOnMobileDefaultChange: true
    },
    {
      key: STORAGE_KEYS.projects,
      stateKey: "projects",
      file: "defaults/projects.json",
      normalize: (value) => value.map(normalizeProject).filter(Boolean),
      refreshOnMobileDefaultChange: true
    },
    { key: STORAGE_KEYS.settings, stateKey: "settings", file: "defaults/settings.json", normalize: normalizeSettings, refreshOnMobileDefaultChange: false },
    {
      key: "pixelToy.paletteLimit.v1",
      stateKey: "paletteLimit",
      file: "defaults/palette-limit.json",
      normalize: (value) => clamp(Number(value), 1, 999),
      refreshOnMobileDefaultChange: true
    }
  ];

  await Promise.all(
    defaultSpecs.map(async (spec) => {
      const shouldLoad =
        !localStorage.getItem(spec.key) ||
        (shouldRefreshMobileDefaults && spec.refreshOnMobileDefaultChange) ||
        Boolean(repairPlan[spec.stateKey]);
      if (!shouldLoad) return;
      const value = await fetchBundledJson(spec.file);
      if (value == null) return;
      const normalized = spec.normalize(value);
      state[spec.stateKey] = normalized;
      saveJson(spec.key, normalized);
    })
  );
  if (shouldRefreshMobileDefaults || Object.values(repairPlan).some(Boolean)) {
    saveJson(STORAGE_KEYS.bundledDefaults, manifest.version);
  }
}

function isBundledMobileRuntime() {
  return Boolean(window.PixelToyIOS || window.PixelToyAndroid || document.documentElement.classList.contains("ios-webview"));
}

function getMobileDefaultRepairPlan(manifest) {
  const plan = { palette: false, projects: false, settings: false, paletteLimit: false };
  if (!isBundledMobileRuntime() || !manifest?.version) return plan;

  const targetPaletteCount = Number(manifest.paletteCount) || 0;
  const targetProjectCount = Number(manifest.projectCount) || 0;
  const paletteCount = Array.isArray(state.palette) ? state.palette.length : 0;
  const projectCount = Array.isArray(state.projects) ? state.projects.length : 0;
  const paletteLooksLikeStarterData = targetPaletteCount > paletteCount && paletteCount <= DEFAULT_PALETTE.length;

  plan.palette = paletteLooksLikeStarterData;
  plan.projects = targetProjectCount > projectCount && projectCount === 0;
  plan.paletteLimit = targetPaletteCount > Number(state.paletteLimit || 0);
  return plan;
}

async function fetchBundledJson(path) {
  const injectedDefaults = window.PixelToyBundledDefaults;
  if (injectedDefaults && Object.prototype.hasOwnProperty.call(injectedDefaults, path)) {
    return structuredClone(injectedDefaults[path]);
  }

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function migrateLocalStorageToServer() {
  if (!state.serverMode) {
    els.matrixStatus.textContent = "请通过拼豆设计.app或本机服务打开后再迁移";
    return;
  }
  const palette = loadJson(STORAGE_KEYS.palette, null);
  const projects = loadJson(STORAGE_KEYS.projects, null);
  const settings = loadJson(STORAGE_KEYS.settings, null);
  if (!palette && !projects && !settings) {
    els.matrixStatus.textContent = "没有发现可迁移的静态版数据";
    return;
  }

  if (Array.isArray(palette)) {
    state.palette = palette.map(normalizeBlock).filter(Boolean);
    await apiRequest("/api/palette", { method: "PUT", body: { palette: state.palette } });
  }
  if (Array.isArray(projects)) {
    state.projects = projects.map(normalizeProject).filter(Boolean);
    await apiRequest("/api/projects", { method: "PUT", body: { projects: state.projects } });
  }
  if (settings) {
    state.settings = normalizeSettings(settings);
    const result = await apiRequest("/api/settings", {
      method: "PUT",
      body: state.settings
    });
    if (result?.settings) state.settings = normalizeSettings(result.settings);
  }
  const paletteLimit = loadJson("pixelToy.paletteLimit.v1", null);
  if (paletteLimit) {
    state.paletteLimit = clamp(Number(paletteLimit), 1, 999);
    await apiRequest("/api/palette-limit", { method: "PUT", body: { paletteLimit: state.paletteLimit } });
  }

  state.projectPaletteSnapshot = null;
  state.editingBlockId = state.palette[0]?.id || null;
  renderAll();
  els.matrixStatus.textContent = "静态版数据已迁移到本机服务";
}

async function loadServerState() {
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return;
  const result = await apiRequest("/api/state", { method: "GET" });
  if (!result?.mode) return;
  state.serverMode = true;
  state.runtimeMode = result.mode;
  state.publicMode = Boolean(result.publicMode);
  if (Array.isArray(result.palette)) state.palette = result.palette.map(normalizeBlock).filter(Boolean);
  if (Array.isArray(result.projects)) state.projects = result.projects.map(normalizeProject).filter(Boolean);
  if (result.paletteLimit) state.paletteLimit = clamp(Number(result.paletteLimit), 1, 999);
  if (result.settings) state.settings = normalizeSettings(result.settings);
}

function runtimeModeLabel(mode) {
  if (mode === "private-web-server") return "私有网页版";
  if (mode === "python-local-server") return "Python 后备服务";
  if (mode === "local-server" || mode === "node-local-server") return "Node 本机服务";
  return "本机服务";
}

async function loadAuthStatus() {
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") {
    state.auth = { checked: true, required: false, authenticated: true };
    state.publicMode = false;
    return;
  }
  const result = await apiRequest("/api/auth/status", { method: "GET", quiet: true });
  state.auth = {
    checked: true,
    required: Boolean(result?.required),
    authenticated: result ? Boolean(result.authenticated) : true
  };
  state.publicMode = Boolean(result?.publicMode);
}

function renderAuthGate() {
  els.authGate.hidden = false;
  els.appShell.setAttribute("aria-hidden", "true");
  els.authPassword.focus();
}

function hideAuthGate() {
  els.authGate.hidden = true;
  els.appShell.removeAttribute("aria-hidden");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const password = els.authPassword.value.trim();
  if (!password) {
    els.authNotice.textContent = "请输入访问密码。";
    return;
  }
  els.authNotice.textContent = "正在验证访问密码。";
  const result = await apiRequest("/api/auth/login", { method: "POST", body: { password }, quiet: true });
  if (!result?.ok) {
    els.authNotice.textContent = result?.error || "访问密码不正确。";
    els.authPassword.select();
    return;
  }
  state.auth.authenticated = true;
  hideAuthGate();
  await loadServerState();
  renderAll();
  updateRuntimeControls();
  updateUiLayout();
}

async function apiRequest(path, options = {}) {
  if (window.location.protocol !== "http:" && window.location.protocol !== "https:") return null;
  try {
    const response = await fetch(path, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      credentials: "same-origin",
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401 && !options.quiet && state.auth.required) {
      state.auth.authenticated = false;
      renderAuthGate();
    }
    if (!response.ok) return payload || null;
    return payload;
  } catch {
    return null;
  }
}
