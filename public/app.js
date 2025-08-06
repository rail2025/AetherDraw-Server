// =================================================================
// Global State & Page Management
// =================================================================

const state = {
  pages: [],
  currentPageIndex: 0,
  pageClipboard: null,
  currentDrawMode: 'pen',
  brushColor: '#FFFFFF',
  brushWidth: 4,
  isShapeFilled: true,
};
const MAX_UNDO_LEVELS = 30;

function getCurrentPage() {
  return state.pages[state.currentPageIndex];
}

function recordUndoState(actionDescription) {
  const page = getCurrentPage();
  if (page.undoStack.length >= MAX_UNDO_LEVELS) page.undoStack.shift();
  page.undoStack.push(JSON.parse(JSON.stringify(page.drawables)));
}

function performUndo() {
  const page = getCurrentPage();
  if (page.undoStack.length > 0) {
    page.drawables = page.undoStack.pop();
    renderAll();
  }
}

function clearCanvas() {
  recordUndoState("Clear All");
  getCurrentPage().drawables = [];
  renderAll();
}

function switchPage(index) {
  if (index >= 0 && index < state.pages.length) {
    state.currentPageIndex = index;
    renderAll();
    renderPageTabs();
  }
}

function addPage(isDefault = false) {
  const newPageName = (state.pages.length + 1).toString();
  const newPage = { name: newPageName, drawables: [], undoStack: [] };
  if (isDefault) {
    const { width, height } = canvasContainer.getBoundingClientRect();
    const canvasCenter = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) * 0.40;
    const waymarkSize = 30;
    const waymarksToPreload = [
      { id: 'WaymarkAImage', angle: 3 * Math.PI / 2 },
      { id: 'WaymarkBImage', angle: 0 },
      { id: 'WaymarkCImage', angle: Math.PI / 2 },
      { id: 'WaymarkDImage', angle: Math.PI },
      { id: 'Waymark1Image', angle: 5 * Math.PI / 4 },
      { id: 'Waymark2Image', angle: 7 * Math.PI / 4 },
      { id: 'Waymark3Image', angle: Math.PI / 4 },
      { id: 'Waymark4Image', angle: 3 * Math.PI / 4 },
    ];
    waymarksToPreload.forEach(wm => {
      const x = canvasCenter.x + radius * Math.cos(wm.angle);
      const y = canvasCenter.y + radius * Math.sin(wm.angle);
      newPage.drawables.push({
        uniqueId: crypto.randomUUID(),
        objectDrawMode: 'icon',
        iconId: wm.id,
        left: x - waymarkSize / 2,
        top: y - waymarkSize / 2,
        width: waymarkSize,
        height: waymarkSize,
        angle: 0,
        strokeWidth: 0,
        fill: 'transparent',
        stroke: 'transparent'
      });
    });
  }
  state.pages.push(newPage);
  switchPage(state.pages.length - 1);
}

function deletePage(index) {
  if (state.pages.length > 1) {
    state.pages.splice(index, 1);
    if (state.currentPageIndex >= state.pages.length) {
      state.currentPageIndex = state.pages.length - 1;
    }
    switchPage(state.currentPageIndex);
  }
}

function copyPage() {
  state.pageClipboard = JSON.parse(JSON.stringify(getCurrentPage()));
  renderPageTabs();
}

function pastePage() {
  if (state.pageClipboard) {
    recordUndoState("Paste Page");
    getCurrentPage().drawables = JSON.parse(JSON.stringify(state.pageClipboard.drawables));
    renderAll();
  }
}

// =================================================================
// Canvas Setup & Rendering
// =================================================================

const canvasContainer = document.getElementById('canvas-container');
const canvas = new fabric.Canvas('canvas', { selection: false });

function drawGrid() {
  const gridSize = 40;
  // FIXED: Use getElement() not getCanvasElement()
  const { width, height } = canvas.getElement().getBoundingClientRect();

  const lines = [];
  for (let i = 1; i < width / gridSize; i++) {
    lines.push(new fabric.Line([i * gridSize, 0, i * gridSize, height], {
      stroke: '#404040', selectable: false, evented: false
    }));
  }
  for (let i = 1; i < height / gridSize; i++) {
    lines.push(new fabric.Line([0, i * gridSize, width, i * gridSize], {
      stroke: '#404040', selectable: false, evented: false
    }));
  }
  const gridGroup = new fabric.Group(lines, { selectable: false, evented: false });
  canvas.add(gridGroup);
  canvas.sendToBack(gridGroup);
}

function resizeCanvas() {
  const { width, height } = canvasContainer.getBoundingClientRect();
  canvas.setWidth(width);
  canvas.setHeight(height);
  renderAll();
}
const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvasContainer);

const iconMap = {};

// rendering
function renderAll() {
  const page = getCurrentPage();
  canvas.clear();
  canvas.backgroundColor = '#262629';
  drawGrid();
  if (!page) return;
  page.drawables.forEach(drawable => {
    let fabricObject;
    const commonProps = {
      stroke: drawable.stroke,
      strokeWidth: drawable.strokeWidth,
      fill: drawable.fill,
      angle: drawable.angle,
      selectable: state.currentDrawMode === 'select',
      originX: 'left',
      originY: 'top',
    };

    switch (drawable.objectDrawMode) {
      case 'rectangle':
        fabricObject = new fabric.Rect({ ...commonProps,
          left: drawable.left, top: drawable.top,
          width: drawable.width, height: drawable.height });
        break;
      case 'circle':
        fabricObject = new fabric.Circle({ ...commonProps,
          left: drawable.left, top: drawable.top,
          radius: drawable.radius });
        break;
      case 'triangle':
        fabricObject = new fabric.Triangle({ ...commonProps,
          left: drawable.left, top: drawable.top,
          width: drawable.width, height: drawable.height });
        break;
      case 'pen':
      case 'dash':
      case 'line':
        fabricObject = new fabric.Polyline(drawable.points, {
          ...commonProps,
          stroke: drawable.stroke,
          strokeDashArray: (drawable.objectDrawMode === 'dash')
            ? [drawable.thickness * 2.5, drawable.thickness * 1.25]
            : null
        });
        break;
      case 'arrow':
        const line = new fabric.Line([drawable.x1, drawable.y1, drawable.x2, drawable.y2], {
          stroke: drawable.stroke, strokeWidth: drawable.strokeWidth,
          originX: 'center', originY: 'center'
        });
        const angle = Math.atan2(drawable.y2 - drawable.y1, drawable.x2 - drawable.x1) * 180 / Math.PI;
        const arrowHead = new fabric.Triangle({
          height: drawable.strokeWidth * 4,
          width: drawable.strokeWidth * 4,
          fill: drawable.stroke,
          angle: 90,
          originX: 'center',
          originY: 'center'
        });
        fabricObject = new fabric.Group([line, arrowHead], {
          angle: angle,
          left: (drawable.x1 + drawable.x2) / 2,
          top: (drawable.y1 + drawable.y2) / 2,
          selectable: state.currentDrawMode === 'select',
          originX: 'center',
          originY: 'center'
        });
        break;
      case 'icon':
        const iconPath = iconMap[drawable.iconId];
        if (!iconPath) return;
        const loader = iconPath.endsWith('.svg')
          ? fabric.loadSVGFromURL
          : fabric.Image.fromURL;
        loader(iconPath, (obj, options) => {
          const icon = iconPath.endsWith('.svg')
            ? fabric.util.groupSVGElements(obj, options)
            : obj;
          icon.set({ ...commonProps,
            left: drawable.left,
            top: drawable.top
          });
          icon.scaleToWidth(drawable.width);
          icon.drawableId = drawable.uniqueId;
          canvas.add(icon);
          canvas.requestRenderAll();
        });
        return;
      case 'text':
        fabricObject = new fabric.Textbox(drawable.text, {
          ...commonProps,
          left: drawable.left, top: drawable.top,
          width: 200, fontSize: 20,
          fill: drawable.stroke, stroke: null
        });
        break;
    }

    if (fabricObject) {
      fabricObject.drawableId = drawable.uniqueId;
      canvas.add(fabricObject);
    }
  });
  canvas.requestRenderAll();
}

// =================================================================
// Drawing & Modification Event Logic
// =================================================================

let isDrawing = false;
let currentPath = null;
let startPoint = null;

canvas.on('mouse:down', function (opt) {
  if (state.currentDrawMode === 'select') return;
  isDrawing = true;
  const pointer = canvas.getPointer(opt.e);
  startPoint = pointer;

  switch (state.currentDrawMode) {
    case 'pen':
    case 'dash':
    case 'line':
      currentPath = new fabric.Polyline([pointer], {
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: 'transparent',
        selectable: false,
        evented: false,
        strokeDashArray: (state.currentDrawMode === 'dash') ? [state.brushWidth * 2.5, state.brushWidth * 1.25] : null
      });
      canvas.add(currentPath);
      break;
    case 'rectangle':
      currentPath = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: state.isShapeFilled ? state.brushColor : 'transparent',
        selectable: false,
        evented: false
      });
      canvas.add(currentPath);
      break;
    case 'circle':
      currentPath = new fabric.Circle({
        left: pointer.x,
        top: pointer.y,
        radius: 0,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: state.isShapeFilled ? state.brushColor : 'transparent',
        selectable: false,
        evented: false
      });
      canvas.add(currentPath);
      break;
    case 'triangle':
      currentPath = new fabric.Triangle({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: 0,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: state.isShapeFilled ? state.brushColor : 'transparent',
        selectable: false,
        evented: false
      });
      canvas.add(currentPath);
      break;
    case 'arrow':
      currentPath = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        selectable: false,
        evented: false
      });
      canvas.add(currentPath);
      break;
  }
});

canvas.on('mouse:move', function (opt) {
  if (!isDrawing || !currentPath) return;
  const pointer = canvas.getPointer(opt.e);

  switch (state.currentDrawMode) {
    case 'pen':
    case 'dash':
      currentPath.points.push({ x: pointer.x, y: pointer.y });
      currentPath.set({ points: currentPath.points });
      break;
    case 'line':
      currentPath.points = [startPoint, pointer];
      currentPath.set({ points: currentPath.points });
      break;
    case 'rectangle':
      currentPath.set({
        width: Math.abs(pointer.x - startPoint.x),
        height: Math.abs(pointer.y - startPoint.y),
        left: Math.min(pointer.x, startPoint.x),
        top: Math.min(pointer.y, startPoint.y)
      });
      break;
    case 'circle':
      const radius = Math.sqrt(Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2)) / 2;
      currentPath.set({
        radius: radius,
        left: startPoint.x - radius,
        top: startPoint.y - radius
      });
      break;
    case 'triangle':
      currentPath.set({
        width: Math.abs(pointer.x - startPoint.x),
        height: Math.abs(pointer.y - startPoint.y),
        left: Math.min(pointer.x, startPoint.x),
        top: Math.min(pointer.y, startPoint.y)
      });
      break;
    case 'arrow':
      currentPath.set({ x2: pointer.x, y2: pointer.y });
      break;
  }
  canvas.requestRenderAll();
});

canvas.on('mouse:up', function (opt) {
  if (!isDrawing || !currentPath) return;
  isDrawing = false;

  // Add drawable to page data
  const page = getCurrentPage();

  switch (state.currentDrawMode) {
    case 'pen':
    case 'dash':
    case 'line':
      page.drawables.push({
        uniqueId: crypto.randomUUID(),
        objectDrawMode: state.currentDrawMode,
        points: currentPath.points.map(p => ({ x: p.x, y: p.y })),
        stroke: state.brushColor,
        strokeWidth: state.brushWidth
      });
      break;
    case 'rectangle':
      page.drawables.push({
        uniqueId: crypto.randomUUID(),
        objectDrawMode: 'rectangle',
        left: currentPath.left,
        top: currentPath.top,
        width: currentPath.width,
        height: currentPath.height,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: state.isShapeFilled ? state.brushColor : 'transparent'
      });
      break;
    case 'circle':
      page.drawables.push({
        uniqueId: crypto.randomUUID(),
        objectDrawMode: 'circle',
        left: currentPath.left,
        top: currentPath.top,
        radius: currentPath.radius,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: state.isShapeFilled ? state.brushColor : 'transparent'
      });
      break;
    case 'triangle':
      page.drawables.push({
        uniqueId: crypto.randomUUID(),
        objectDrawMode: 'triangle',
        left: currentPath.left,
        top: currentPath.top,
        width: currentPath.width,
        height: currentPath.height,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: state.isShapeFilled ? state.brushColor : 'transparent'
      });
      break;
    case 'arrow':
      page.drawables.push({
        uniqueId: crypto.randomUUID(),
        objectDrawMode: 'arrow',
        x1: currentPath.x1,
        y1: currentPath.y1,
        x2: currentPath.x2,
        y2: currentPath.y2,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth
      });
      break;
  }

  canvas.remove(currentPath);
  currentPath = null;
  renderAll();
});

// =================================================================
// Tool Definitions & Icon Preload
// =================================================================

const iconUrlBase = './icons/';
const iconMap = {};

const toolDefinitions = {
  Roles: [
    { id: 'HealerImage', name: 'Healer' },
    { id: 'MeleeImage', name: 'Melee' },
    { id: 'RangedImage', name: 'Ranged' },
    { id: 'TankImage', name: 'Tank' }
  ],
  Waymarks: [
    { id: 'WaymarkAImage', name: 'A' },
    { id: 'WaymarkBImage', name: 'B' },
    { id: 'WaymarkCImage', name: 'C' },
    { id: 'WaymarkDImage', name: 'D' },
    { id: 'Waymark1Image', name: '1' },
    { id: 'Waymark2Image', name: '2' },
    { id: 'Waymark3Image', name: '3' },
    { id: 'Waymark4Image', name: '4' }
  ]
};

function preloadIcons() {
  Object.values(toolDefinitions).flat().forEach(tool => {
    let fileName = tool.id.replace('Image', '');
    let pngUrl = `${iconUrlBase}${fileName}.png`;
    let svgUrl = `${iconUrlBase}${fileName}.svg`;
    iconMap[tool.id] = pngUrl; // use PNG for now
  });
}

// =================================================================
// UI Initialization
// =================================================================

function createToolbar() {
  const toolbar = document.getElementById('toolbar');
  toolbar.innerHTML = '';

  Object.entries(toolDefinitions).forEach(([groupName, tools]) => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'tool-group';
    groupDiv.textContent = groupName;
    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.textContent = tool.name;
      btn.onclick = () => setActiveTool(tool.id);
      groupDiv.appendChild(btn);
    });
    toolbar.appendChild(groupDiv);
  });
}

function setActiveTool(toolId) {
  state.currentDrawMode = toolId;
  // Update UI if needed
}

function renderPageTabs() {
  const pageTabs = document.getElementById('page-tabs');
  pageTabs.innerHTML = '';

  state.pages.forEach((page, idx) => {
    const tab = document.createElement('button');
    tab.textContent = page.name;
    tab.className = (idx === state.currentPageIndex) ? 'active' : '';
    tab.onclick = () => switchPage(idx);
    pageTabs.appendChild(tab);
  });
}

// =================================================================
// Application startup
// =================================================================

window.addEventListener('load', () => {
  preloadIcons();
  createToolbar();
  addPage(true);
  setActiveTool('pen');

  canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  canvas.freeDrawingBrush.width = state.brushWidth;
  canvas.freeDrawingBrush.color = state.brushColor;

  resizeCanvas();
  renderAll();
});
