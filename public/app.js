// ======= Global State & Page Management =======
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

function recordUndoState(desc = 'Change') {
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
  const newPage = { name: `${state.pages.length + 1}`, drawables: [], undoStack: [] };
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
}

function pastePage() {
  if (state.pageClipboard) {
    recordUndoState("Paste Page");
    getCurrentPage().drawables = JSON.parse(JSON.stringify(state.pageClipboard.drawables));
    renderAll();
  }
}

// ======= Canvas Setup =======
const canvasContainer = document.getElementById('canvas-container');
const canvas = new fabric.Canvas('canvas', { selection: false });

function drawGrid() {
  const gridSize = 40;
  const { width, height } = canvas.getCanvasElement();
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
new ResizeObserver(resizeCanvas).observe(canvasContainer);

const iconMap = {};

// ======= Rendering =======
function renderAll() {
  const page = getCurrentPage();
  if (!page) return;
  canvas.clear();
  canvas.backgroundColor = '#262629';
  drawGrid();

  page.drawables.forEach(drawable => {
    let obj;
    const common = {
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
        obj = new fabric.Rect({ ...common, left: drawable.left, top: drawable.top, width: drawable.width, height: drawable.height });
        break;
      case 'circle':
        obj = new fabric.Circle({ ...common, left: drawable.left, top: drawable.top, radius: drawable.radius });
        break;
      case 'triangle':
        obj = new fabric.Triangle({ ...common, left: drawable.left, top: drawable.top, width: drawable.width, height: drawable.height });
        break;
      case 'pen':
      case 'dash':
      case 'line':
        obj = new fabric.Polyline(drawable.points, {
          ...common,
          strokeDashArray: drawable.objectDrawMode === 'dash' ? [drawable.thickness * 2.5, drawable.thickness * 1.25] : null
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
        obj = new fabric.Group([line, arrowHead], {
          angle,
          left: (drawable.x1 + drawable.x2) / 2,
          top: (drawable.y1 + drawable.y2) / 2,
          selectable: state.currentDrawMode === 'select',
          originX: 'center',
          originY: 'center'
        });
        break;
      case 'icon':
        const iconPath = iconMap[drawable.iconId];
        if (!iconPath) {
          console.warn("Missing icon for:", drawable.iconId);
          return;
        }
        const loader = iconPath.endsWith('.svg') ? fabric.loadSVGFromURL : fabric.Image.fromURL;
        loader(iconPath, (obj, options) => {
          const icon = iconPath.endsWith('.svg') ? fabric.util.groupSVGElements(obj, options) : obj;
          icon.set({ ...common, left: drawable.left, top: drawable.top });
          icon.scaleToWidth(drawable.width);
          icon.drawableId = drawable.uniqueId;
          canvas.add(icon);
          canvas.requestRenderAll();
        });
        return;
      case 'text':
        obj = new fabric.Textbox(drawable.text, {
          ...common,
          left: drawable.left, top: drawable.top,
          width: 200, fontSize: 20,
          fill: drawable.stroke
        });
        break;
    }

    if (obj) {
      obj.drawableId = drawable.uniqueId;
      canvas.add(obj);
    }
  });
  canvas.requestRenderAll();
}

// ======= Toolbar Logic =======
const iconUrlBase = '/icons/';
const toolDefinitions = {
  Drawing: [{ id: 'pen', name: 'Pen' }, { id: 'line', name: 'Line' }, { id: 'dash', name: 'Dash' }],
  Shapes: [{ id: 'rectangle', name: 'Rect' }, { id: 'circle', name: 'Circle' }, { id: 'arrow', name: 'Arrow' }, { id: 'triangle', name: 'Triangle' }],
  Roles: [{ id: 'RoleTankImage', name: 'Tank', icon: 'Tank.JPG' }, { id: 'RoleHealerImage', name: 'Healer', icon: 'Healer.JPG' }],
  Party: [{ id: 'Party1Image', name: '1', icon: 'Party1.png' }],
  Waymarks: [{ id: 'WaymarkAImage', name: 'A', icon: 'A.png' }],
};

function createToolbar() {
  const grid = document.getElementById('tool-groups-grid');
  grid.innerHTML = '';

  for (const group in toolDefinitions) {
    const tools = toolDefinitions[group];
    const groupDiv = document.createElement('div');
    groupDiv.className = 'tool-group';

    const mainBtn = document.createElement('button');
    mainBtn.id = `${group}-group`.toLowerCase();
    mainBtn.className = 'tool-group-btn';
    mainBtn.innerHTML = tools[0].icon ? `<img src="${iconUrlBase}${tools[0].icon}" alt="${group}">` : tools[0].name;

    const popup = document.createElement('div');
    popup.className = 'tool-popup';

    tools.forEach(tool => {
      if (tool.icon) iconMap[tool.id] = `${iconUrlBase}${tool.icon}`;
      const btn = document.createElement('button');
      btn.id = tool.id;
      btn.className = 'tool-btn';
      const img = tool.icon ? `<img src="${iconUrlBase}${tool.icon}" alt="${tool.name}" onerror="this.style.display='none'">` : '';
      btn.innerHTML = `${img}<span>${tool.name}</span>`;

      btn.onclick = e => {
        e.stopPropagation();
        if (tool.icon) {
          if (!iconMap[tool.id]) {
            alert(`Icon missing: ${tool.icon}`);
            return;
          }
          recordUndoState(`Add icon: ${tool.name}`);
          getCurrentPage().drawables.push({
            uniqueId: crypto.randomUUID(),
            objectDrawMode: 'icon',
            iconId: tool.id,
            left: canvas.width / 2 - 25,
            top: canvas.height / 2 - 25,
            width: 50, height: 50, angle: 0,
            strokeWidth: 0, fill: 'transparent', stroke: 'transparent'
          });
          renderAll();
          setActiveTool('select');
        } else {
          setActiveTool(tool.id);
        }
        document.querySelectorAll('.tool-popup').forEach(p => p.classList.remove('active'));
      };
      popup.appendChild(btn);
    });

    groupDiv.appendChild(mainBtn);
    groupDiv.appendChild(popup);
    grid.appendChild(groupDiv);
  }

  addEventListeners();
}

function setActiveTool(toolId) {
  state.currentDrawMode = toolId;
  document.querySelectorAll('.tool-btn, .tool-group-btn').forEach(btn => btn.classList.remove('active'));
  const clicked = document.getElementById(toolId);
  if (clicked) clicked.classList.add('active');

  const groupBtn = clicked?.closest('.tool-group')?.querySelector('.tool-group-btn');
  if (groupBtn) {
    groupBtn.classList.add('active');
    const img = clicked.querySelector('img');
    groupBtn.innerHTML = img ? img.outerHTML : `<span>${clicked.textContent}</span>`;
  }

  canvas.isDrawingMode = toolId === 'pen';
  canvas.selection = toolId === 'select';
  canvas.defaultCursor = canvas.isDrawingMode ? 'crosshair' : 'default';
  canvas.forEachObject(obj => obj.selectable = (toolId === 'select'));
  canvas.discardActiveObject().renderAll();
}

// ======= Event Setup =======
function addEventListeners() {
  document.querySelectorAll('.tool-group-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const popup = e.currentTarget.nextElementSibling;
      const isActive = popup.classList.contains('active');
      document.querySelectorAll('.tool-popup').forEach(p => p.classList.remove('active'));
      if (!isActive) popup.classList.add('active');
    });
  });
}

// ======= Initialize =======
createToolbar();
addPage(true);
setActiveTool('pen');
canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
canvas.freeDrawingBrush.width = state.brushWidth;
canvas.freeDrawingBrush.color = state.brushColor;

window.addEventListener('load', () => {
  resizeCanvas();
  renderAll();
});
