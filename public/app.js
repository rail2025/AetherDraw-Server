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
            { id: 'WaymarkAImage', angle: 3 * Math.PI / 2 }, { id: 'WaymarkBImage', angle: 0 },
            { id: 'WaymarkCImage', angle: Math.PI / 2 }, { id: 'WaymarkDImage', angle: Math.PI },
            { id: 'Waymark1Image', angle: 5 * Math.PI / 4 }, { id: 'Waymark2Image', angle: 7 * Math.PI / 4 },
            { id: 'Waymark3Image', angle: Math.PI / 4 }, { id: 'Waymark4Image', angle: 3 * Math.PI / 4 }
        ];

        waymarksToPreload.forEach(wm => {
            const x = canvasCenter.x + radius * Math.cos(wm.angle);
            const y = canvasCenter.y + radius * Math.sin(wm.angle);
            newPage.drawables.push({
                uniqueId: crypto.randomUUID(), objectDrawMode: 'icon', iconId: wm.id,
                left: x - waymarkSize / 2, top: y - waymarkSize / 2,
                width: waymarkSize, height: waymarkSize, angle: 0,
                strokeWidth: 0, fill: 'transparent', stroke: 'transparent'
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
    for (let i = 1; i < (width / gridSize); i++) {
        lines.push(new fabric.Line([i * gridSize, 0, i * gridSize, height], { stroke: '#404040', selectable: false, evented: false }));
    }
    for (let i = 1; i < (height / gridSize); i++) {
        lines.push(new fabric.Line([0, i * gridSize, width, i * gridSize], { stroke: '#404040', selectable: false, evented: false }));
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

function renderAll() {
    const page = getCurrentPage();
    canvas.clear();
    canvas.backgroundColor = '#262629';
    drawGrid();
    if (!page) return;

    page.drawables.forEach(drawable => {
        let fabricObject;
        const commonProps = {
            stroke: drawable.stroke, strokeWidth: drawable.strokeWidth, fill: drawable.fill,
            angle: drawable.angle, selectable: state.currentDrawMode === 'select',
            originX: 'left', originY: 'top',
        };

        switch (drawable.objectDrawMode) {
            case 'rectangle': fabricObject = new fabric.Rect({ ...commonProps, left: drawable.left, top: drawable.top, width: drawable.width, height: drawable.height }); break;
            case 'circle': fabricObject = new fabric.Circle({ ...commonProps, left: drawable.left, top: drawable.top, radius: drawable.radius }); break;
            case 'triangle': fabricObject = new fabric.Triangle({ ...commonProps, left: drawable.left, top: drawable.top, width: drawable.width, height: drawable.height }); break;
            case 'pen': case 'dash':
                fabricObject = new fabric.Polyline(drawable.points, { ...commonProps, stroke: drawable.stroke, fill: null, strokeDashArray: drawable.objectDrawMode === 'dash' ? [drawable.thickness * 2.5, drawable.thickness * 1.25] : null });
                break;
            case 'line':
                fabricObject = new fabric.Line([drawable.points[0].x, drawable.points[0].y, drawable.points[1].x, drawable.points[1].y], { ...commonProps, stroke: drawable.stroke });
                break;
            case 'arrow':
                const line = new fabric.Line([drawable.x1, drawable.y1, drawable.x2, drawable.y2], { stroke: drawable.stroke, strokeWidth: drawable.strokeWidth, originX: 'center', originY: 'center' });
                const angle = Math.atan2(drawable.y2 - drawable.y1, drawable.x2 - drawable.x1) * 180 / Math.PI;
                const arrowHead = new fabric.Triangle({ height: drawable.strokeWidth * 4, width: drawable.strokeWidth * 4, fill: drawable.stroke, angle: 90, originX: 'center', originY: 'center' });
                fabricObject = new fabric.Group([line, arrowHead], { angle: angle, left: (drawable.x1 + drawable.x2) / 2, top: (drawable.y1 + drawable.y2) / 2, selectable: state.currentDrawMode === 'select', originX: 'center', originY: 'center' });
                break;
            case 'icon':
                const iconPath = iconMap[drawable.iconId];
                if (!iconPath) return;
                const isSvg = iconPath.endsWith('.svg');
                const loader = isSvg ? fabric.loadSVGFromURL : fabric.Image.fromURL;
                loader(iconPath, (obj) => {
                    const icon = isSvg ? fabric.util.groupSVGElements(obj) : obj;
                    icon.set({ ...commonProps, left: drawable.left, top: drawable.top });
                    icon.scaleToWidth(drawable.width);
                    icon.drawableId = drawable.uniqueId;
                    canvas.add(icon);
                    canvas.requestRenderAll();
                });
                return;
             case 'text':
                fabricObject = new fabric.Textbox(drawable.text, { ...commonProps, left: drawable.left, top: drawable.top, width: 200, fontSize: 20, fill: drawable.stroke, stroke: null });
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
let startPoint = null;

canvas.on('mouse:down', (o) => {
    if (state.currentDrawMode === 'select' || o.target) return;
    recordUndoState(`Start drawing ${state.currentDrawMode}`);
    isDrawing = true;
    startPoint = canvas.getPointer(o.e);
    const commonDrawableProps = {
        uniqueId: crypto.randomUUID(), objectDrawMode: state.currentDrawMode,
        thickness: state.brushWidth, isFilled: state.isShapeFilled,
        fill: state.isShapeFilled ? state.brushColor + '66' : 'transparent',
        stroke: state.brushColor, strokeWidth: state.brushWidth, angle: 0,
    };
    let newDrawable;
    switch (state.currentDrawMode) {
        case 'rectangle': case 'triangle':
            newDrawable = { ...commonDrawableProps, left: startPoint.x, top: startPoint.y, width: 0, height: 0 }; break;
        case 'circle':
            newDrawable = { ...commonDrawableProps, left: startPoint.x, top: startPoint.y, radius: 0 }; break;
        case 'arrow':
            newDrawable = { ...commonDrawableProps, x1: startPoint.x, y1: startPoint.y, x2: startPoint.x, y2: startPoint.y }; break;
        case 'pen': case 'dash': case 'line':
            newDrawable = { ...commonDrawableProps, points: [{ x: startPoint.x, y: startPoint.y }, { x: startPoint.x, y: startPoint.y }] }; break;
    }
    if (newDrawable) {
        getCurrentPage().drawables.push(newDrawable);
    }
});

canvas.on('mouse:move', (o) => {
    if (!isDrawing) return;
    const pointer = canvas.getPointer(o.e);
    let currentDrawable = getCurrentPage().drawables.slice(-1)[0];
    if (['pen', 'dash'].includes(state.currentDrawMode)) {
        currentDrawable.points.push({ x: pointer.x, y: pointer.y });
    } else if (state.currentDrawMode === 'line') {
        currentDrawable.points[1] = { x: pointer.x, y: pointer.y };
    } else {
        currentDrawable.left = Math.min(pointer.x, startPoint.x);
        currentDrawable.top = Math.min(pointer.y, startPoint.y);
        currentDrawable.width = Math.abs(pointer.x - startPoint.x);
        currentDrawable.height = Math.abs(pointer.y - startPoint.y);
        if (currentDrawable.objectDrawMode === 'circle') {
            currentDrawable.radius = Math.sqrt(Math.pow(currentDrawable.width, 2) + Math.pow(currentDrawable.height, 2)) / 2;
        } else if (currentDrawable.objectDrawMode === 'arrow') {
            currentDrawable.x1 = startPoint.x; currentDrawable.y1 = startPoint.y;
            currentDrawable.x2 = pointer.x; currentDrawable.y2 = pointer.y;
        }
    }
    renderAll();
});

canvas.on('mouse:up', () => {
    if (!isDrawing) return;
    isDrawing = false;
    let drawable = getCurrentPage().drawables.slice(-1)[0];
    if (['pen', 'dash'].includes(drawable.objectDrawMode)) {
        const fabricObject = new fabric.Polyline(drawable.points);
        drawable.left = fabricObject.left;
        drawable.top = fabricObject.top;
        drawable.points = fabricObject.points.map(p => ({ x: p.x - fabricObject.left, y: p.y - fabricObject.top }));
    }
    renderAll();
});

canvas.on('object:modified', (e) => {
    recordUndoState("Modify object");
    const fabricObject = e.target;
    const drawable = getCurrentPage().drawables.find(d => d.uniqueId === fabricObject.drawableId);
    if (!drawable) return;

    if (['pen', 'dash'].includes(drawable.objectDrawMode)) {
        drawable.points = fabricObject.points.map(p => ({ x: p.x + fabricObject.left, y: p.y + fabricObject.top }));
    } else {
        drawable.left = fabricObject.left;
        drawable.top = fabricObject.top;
        drawable.angle = fabricObject.angle;
        drawable.width = fabricObject.width * fabricObject.scaleX;
        drawable.height = fabricObject.height * fabricObject.scaleY;
        if (drawable.objectDrawMode === 'circle') {
            drawable.radius = (fabricObject.radius * Math.max(fabricObject.scaleX, fabricObject.scaleY));
        }
    }
    fabricObject.set({ scaleX: 1, scaleY: 1 });
    renderAll();
});

// =================================================================
// Toolbar & Icon Logic
// =================================================================
const toolDefinitions = {
    'Drawing': [ { id: 'pen', name: 'Pen' }, { id: 'line', name: 'Line' }, { id: 'dash', name: 'Dash' }],
    'Shapes': [ { id: 'rectangle', name: 'Rect' }, { id: 'circle', name: 'Circle' }, { id: 'arrow', name: 'Arrow' }, { id: 'triangle', name: 'Triangle' }],
    'Roles': [ { id: 'RoleTankImage', name: 'Tank', icon: 'Tank.JPG' }, { id: 'RoleHealerImage', name: 'Healer', icon: 'Healer.JPG' }, { id: 'RoleMeleeImage', name: 'Melee', icon: 'Melee.JPG' }, { id: 'RoleRangedImage', name: 'Ranged', icon: 'Ranged.JPG' }, ],
    'Party': [ { id: 'Party1Image', name: '1', icon: 'Party1.png' }, { id: 'Party2Image', name: '2', icon: 'Party2.png' }, { id: 'Party3Image', name: '3', icon: 'Party3.png' }, { id: 'Party4Image', name: '4', icon: 'Party4.png' }, { id: 'Party5Image', name: '5', icon: 'Party5.png' }, { id: 'Party6Image', name: '6', icon: 'Party6.png' }, { id: 'Party7Image', name: '7', icon: 'Party7.png' }, { id: 'Party8Image', name: '8', icon: 'Party8.png' }, ],
    'Waymarks': [ { id: 'WaymarkAImage', name: 'A', icon: 'A.png' }, { id: 'WaymarkBImage', name: 'B', icon: 'B.png' }, { id: 'WaymarkCImage', name: 'C', icon: 'C.png' }, { id: 'WaymarkDImage', name: 'D', icon: 'D.png' }, ],
    'Numbers': [ { id: 'Waymark1Image', name: '1', icon: '1_waymark.png' }, { id: 'Waymark2Image', name: '2', icon: '2_waymark.png' }, { id: 'Waymark3Image', name: '3', icon: '3_waymark.png' }, { id: 'Waymark4Image', name: '4', icon: '4_waymark.png' }, ],
    'Mechanics': [ { id: 'StackImage', name: 'Stack', icon: 'stack.svg' }, { id: 'SpreadImage', name: 'Spread', icon: 'spread.svg' }, { id: 'LineStackImage', name: 'Line Stack', icon: 'line_stack.svg' }, { id: 'DonutAoEImage', name: 'Donut', icon: 'donut.svg' }, { id: 'FlareImage', name: 'Flare', icon: 'flare.svg' }, { id: 'CircleAoEImage', name: 'AoE', icon: 'prox_aoe.svg' }, { id: 'BossImage', name: 'Boss', icon: 'boss.svg' }, ],
    'Dots': [ { id: 'Dot1Image', name: 'Dot 1', icon: '1dot.svg' }, { id: 'Dot2Image', name: 'Dot 2', icon: '2dot.svg' }, { id: 'Dot3Image', name: 'Dot 3', icon: '3dot.svg' }, { id: 'Dot4Image', name: 'Dot 4', icon: '4dot.svg' }, { id: 'Dot5Image', name: 'Dot 5', icon: '5dot.svg' }, { id: 'Dot6Image', name: 'Dot 6', icon: '6dot.svg' }, { id: 'Dot7Image', name: 'Dot 7', icon: '7dot.svg' }, { id: 'Dot8Image', name: 'Dot 8', icon: '8dot.svg' }, ]
};

function createToolbar() {
    const toolGroupsGrid = document.getElementById('tool-groups-grid');
    toolGroupsGrid.innerHTML = '';
    for (const groupName in toolDefinitions) {
        const groupData = toolDefinitions[groupName];
        iconMap[groupName] = groupData;
        const groupDiv = document.createElement('div');
        groupDiv.className = 'tool-group';
        
        const mainButton = document.createElement('button');
        mainButton.id = `${groupName.toLowerCase()}-group`;
        mainButton.className = 'tool-group-btn';
        mainButton.innerHTML = groupData[0].icon ? `<img src="${iconUrlBase}${groupData[0].icon}" alt="${groupName}">` : groupData[0].name;
        
        const popup = document.createElement('div');
        popup.className = 'tool-popup';

        groupData.forEach(tool => {
            if (tool.icon) iconMap[tool.id] = `${iconUrlBase}${tool.icon}`;
            const button = document.createElement('button');
            button.id = tool.id;
            button.className = 'tool-btn';
            const imgHtml = tool.icon ? `<img src="${iconUrlBase}${tool.icon}" alt="${tool.name}">` : '';
            button.innerHTML = `${imgHtml}<span>${tool.name}</span>`;
            
            button.onclick = (e) => {
                e.stopPropagation();
                if (tool.icon) {
                    recordUndoState(`Add icon: ${tool.name}`);
                    getCurrentPage().drawables.push({
                        uniqueId: crypto.randomUUID(), objectDrawMode: 'icon', iconId: tool.id,
                        left: canvas.width / 2 - 25, top: canvas.height / 2 - 25,
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
    state.currentDrawMode = toolId;
    document.querySelectorAll('.tool-btn, .tool-group-btn').forEach(btn => btn.classList.remove('active'));
    const clickedButton = document.getElementById(toolId);
    if (!clickedButton) return;
    const groupButton = clickedButton.closest('.tool-group')?.querySelector('.tool-group-btn');

    if (groupButton) {
        groupButton.classList.add('active');
        const clickedContent = clickedButton.querySelector('img');
        groupButton.innerHTML = clickedContent ? clickedContent.outerHTML : clickedButton.textContent;
    } else {
        clickedButton.classList.add('active');
    }

    canvas.isDrawingMode = (state.currentDrawMode === 'pen');
    canvas.selection = (state.currentDrawMode === 'select');
    canvas.forEachObject(obj => obj.selectable = (state.currentDrawMode === 'select'));
    canvas.defaultCursor = (state.currentDrawMode === 'select') ? 'default' : 'crosshair';
    canvas.discardActiveObject().renderAll();
}

function addEventListeners() {
    document.querySelectorAll('.tool-group-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const popup = e.currentTarget.nextElementSibling;
            if (!popup) return;
            const isActive
