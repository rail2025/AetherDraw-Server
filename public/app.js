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

// ... (mouse event handlers unchanged, same as your original)

canvas.on('object:modified', e => {
  recordUndoState("Modify object");
  // unchanged from your original...
});

// =================================================================
// Toolbar & Icon Logic
// =================================================================
const iconUrlBase = '/icons/';
const toolDefinitions = {
  Drawing: [
    { id: 'pen', name: 'Pen' },
    { id: 'line', name: 'Line' },
    { id: 'dash', name: 'Dash' }
  ],
  Shapes: [
    { id: 'rectangle', name: 'Rect' },
    { id: 'circle', name: 'Circle' },
    { id: 'arrow', name: 'Arrow' },
    { id: 'triangle', name: 'Triangle' }
  ],
  Roles: [
    { id: 'RoleTankImage', name: 'Tank', icon: 'Tank.JPG' },
    { id: 'RoleHealerImage', name: 'Healer', icon: 'Healer.JPG' },
    { id: 'RoleMeleeImage', name: 'Melee', icon: 'Melee.JPG' },
    { id: 'RoleRangedImage', name: 'Ranged', icon: 'Ranged.JPG' }
  ],
  Party: [
    { id: 'Party1Image', name: '1', icon: 'Party1.png' },
    // etc...
  ],
  Waymarks: [
    { id: 'WaymarkAImage', name: 'A', icon: 'A.png' },
    // etc...
  ],
  // Dots / Mechanics same...
};

function createToolbar() {
  const toolGroupsGrid = document.getElementById('tool-groups-grid');
  toolGroupsGrid.innerHTML = '';

  for (const groupName in toolDefinitions) {
    const groupData = toolDefinitions[groupName];
    const groupDiv = document.createElement('div');
    groupDiv.className = 'tool-group';

    const mainButton = document.createElement('button');
    mainButton.id = `${groupName.toLowerCase()}-group`;
    mainButton.className = 'tool-group-btn';
    mainButton.innerHTML = groupData[0].icon
      ? `<img src="${iconUrlBase}${groupData[0].icon}" alt="${groupName}">`
      : groupData[0].name;

    const popup = document.createElement('div');
    popup.className = 'tool-popup';

    groupData.forEach(tool => {
      if (tool.icon) {
        iconMap[tool.id] = `${iconUrlBase}${tool.icon}`;
      }
      const button = document.createElement('button');
      button.id = tool.id;
      button.className = 'tool-btn';
      const imgHtml = tool.icon
        ? `<img src="${iconUrlBase}${tool.icon}" alt="${tool.name}">`
        : '';
      button.innerHTML = `${imgHtml}<span>${tool.name}</span>`;
      button.onclick = e => {
        e.stopPropagation();
        console.log("Clicked tool:", tool.id, "iconMap:", iconMap[tool.id]);
        if (tool.icon) {
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
      popup.appendChild(button);
    });

    groupDiv.appendChild(mainButton);
    groupDiv.appendChild(popup);
    toolGroupsGrid.appendChild(groupDiv);
  }
  addEventListeners();
}

function setActiveTool(toolId) {
  console.log("Switching to tool:", toolId);
  state.currentDrawMode = toolId;

  document.querySelectorAll('.tool-btn, .tool-group-btn').forEach(btn => btn.classList.remove('active'));
  const clickedButton = document.getElementById(toolId);
  if (clickedButton) clickedButton.classList.add('active');

  const groupButton = clickedButton?.closest('.tool-group')?.querySelector('.tool-group-btn');
  if (groupButton) {
    groupButton.classList.add('active');
    const clickedContent = clickedButton.querySelector('img');
    groupButton.innerHTML = clickedContent
      ? clickedContent.outerHTML
      : `<span>${clickedButton.textContent}</span>`;
  }

  canvas.isDrawingMode = (state.currentDrawMode === 'pen');
  canvas.selection = (state.currentDrawMode === 'select');
  canvas.defaultCursor = canvas.isDrawingMode ? 'crosshair' : 'default';
  canvas.forEachObject(obj => (obj.selectable = (state.currentDrawMode === 'select')));
  canvas.discardActiveObject().renderAll();
}

// =================================================================
// Toolbar & Other Event Wiring
// =================================================================
function addEventListeners() {
  document.querySelectorAll('.tool-group-btn').forEach(button => {
    button.addEventListener('click', e => {
      const popup = e.currentTarget.nextElementSibling;
      const isActive = popup.classList.contains('active');
      document.querySelectorAll('.tool-popup').forEach(p => p.classList.remove('active'));
      if (!isActive) popup.classList.add('active');
    });
  });
  // ... wire undo, clear, text button, presets, palette, etc. unchanged
}

// === Initial Setup ===
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
