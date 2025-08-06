// =================================================================
// Global State & History
// =================================================================
const state = {
    drawables: [],
    undoStack: [],
    currentDrawMode: 'pen',
    brushColor: '#FFFFFF',
    brushWidth: 4,
    isShapeFilled: true,
};
const MAX_UNDO_LEVELS = 30;

function recordUndoState(actionDescription) {
    if (state.undoStack.length >= MAX_UNDO_LEVELS) state.undoStack.shift();
    state.undoStack.push(JSON.parse(JSON.stringify(state.drawables)));
}
function performUndo() {
    if (state.undoStack.length > 0) {
        state.drawables = state.undoStack.pop();
        renderAll();
    }
}
function clearCanvas() {
    recordUndoState("Clear All");
    state.drawables = [];
    renderAll();
}

// =================================================================
// Canvas Setup & Rendering
// =================================================================
const canvasContainer = document.getElementById('canvas-container');
const canvas = new fabric.Canvas('canvas', { backgroundColor: '#333', selection: false });

function resizeCanvas() {
    const { width, height } = canvasContainer.getBoundingClientRect();
    canvas.setWidth(width);
    canvas.setHeight(height);
}
const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvasContainer);
resizeCanvas();

function renderAll() {
    const selectedIds = canvas.getActiveObjects().map(o => o.drawableId);
    canvas.clear();
    state.drawables.forEach(drawable => {
        let fabricObject;
        const commonProps = {
            stroke: drawable.stroke, strokeWidth: drawable.strokeWidth, fill: drawable.fill,
            angle: drawable.angle, selectable: state.currentDrawMode === 'select',
            originX: 'left', originY: 'top',
        };

        switch (drawable.objectDrawMode) {
            case 'rectangle':
                fabricObject = new fabric.Rect({ ...commonProps, left: drawable.left, top: drawable.top, width: drawable.width, height: drawable.height });
                break;
            case 'circle':
                fabricObject = new fabric.Circle({ ...commonProps, left: drawable.left, top: drawable.top, radius: drawable.radius, originX: 'center', originY: 'center' });
                break;
            case 'triangle':
                fabricObject = new fabric.Triangle({ ...commonProps, left: drawable.left, top: drawable.top, width: drawable.width, height: drawable.height });
                break;
            case 'line':
                fabricObject = new fabric.Line([drawable.x1, drawable.y1, drawable.x2, drawable.y2], { stroke: drawable.stroke, strokeWidth: drawable.strokeWidth, selectable: state.currentDrawMode === 'select' });
                break;
            case 'arrow':
                 const line = new fabric.Line([drawable.x1, drawable.y1, drawable.x2, drawable.y2], { stroke: drawable.stroke, strokeWidth: drawable.strokeWidth });
                 const angle = Math.atan2(drawable.y2 - drawable.y1, drawable.x2 - drawable.x1) * 180 / Math.PI;
                 const arrowHead = new fabric.Triangle({
                    left: drawable.x2, top: drawable.y2, originX: 'center', originY: 'center',
                    height: drawable.strokeWidth * 4, width: drawable.strokeWidth * 4,
                    fill: drawable.stroke, angle: angle + 90,
                 });
                 fabricObject = new fabric.Group([line, arrowHead], { selectable: state.currentDrawMode === 'select', angle: drawable.angle });
                break;
        }
        if (fabricObject) {
            fabricObject.drawableId = drawable.uniqueId;
            canvas.add(fabricObject);
            if (selectedIds.includes(drawable.uniqueId)) {
                canvas.setActiveObject(fabricObject);
            }
        }
    });
    canvas.renderAll();
}

// =================================================================
// Drawing & Modification Event Logic
// =================================================================
let isDrawing = false;
let startPoint = null;

canvas.on('mouse:down', (o) => {
    if (state.currentDrawMode === 'select' || state.currentDrawMode === 'pen' || o.target) return;
    recordUndoState(`Start drawing ${state.currentDrawMode}`);
    isDrawing = true;
    startPoint = canvas.getPointer(o.e);
    const newDrawable = {
        uniqueId: crypto.randomUUID(), objectDrawMode: state.currentDrawMode,
        thickness: state.brushWidth, isFilled: state.isShapeFilled,
        fill: state.isShapeFilled ? state.brushColor + '66' : 'transparent',
        stroke: state.brushColor, strokeWidth: state.brushWidth, angle: 0,
        left: startPoint.x, top: startPoint.y, width: 0, height: 0, radius: 0,
        x1: startPoint.x, y1: startPoint.y, x2: startPoint.x, y2: startPoint.y,
    };
    if (newDrawable) state.drawables.push(newDrawable);
});

canvas.on('mouse:move', (o) => {
    if (!isDrawing) return;
    const pointer = canvas.getPointer(o.e);
    let currentDrawable = state.drawables[state.drawables.length - 1];
    
    currentDrawable.left = Math.min(pointer.x, startPoint.x);
    currentDrawable.top = Math.min(pointer.y, startPoint.y);
    currentDrawable.width = Math.abs(pointer.x - startPoint.x);
    currentDrawable.height = Math.abs(pointer.y - startPoint.y);

    if (currentDrawable.objectDrawMode === 'circle') {
        currentDrawable.radius = Math.sqrt(Math.pow(currentDrawable.width, 2) + Math.pow(currentDrawable.height, 2)) / 2;
    } else if (['line', 'arrow'].includes(currentDrawable.objectDrawMode)) {
        currentDrawable.left = undefined; currentDrawable.top = undefined;
        currentDrawable.x2 = pointer.x;
        currentDrawable.y2 = pointer.y;
    }
    renderAll();
});

canvas.on('mouse:up', (o) => {
    if (!isDrawing) return;
    isDrawing = false;
    renderAll();
});

canvas.on('object:modified', (e) => {
    recordUndoState("Modify object");
    const fabricObject = e.target;
    const drawable = state.drawables.find(d => d.uniqueId === fabricObject.drawableId);
    if (!drawable) return;

    drawable.left = fabricObject.left;
    drawable.top = fabricObject.top;
    drawable.angle = fabricObject.angle;
    drawable.width = fabricObject.width * fabricObject.scaleX;
    drawable.height = fabricObject.height * fabricObject.scaleY;

    if (drawable.objectDrawMode === 'circle') {
        drawable.radius = (fabricObject.radius * Math.max(fabricObject.scaleX, fabricObject.scaleY));
    }
    
    fabricObject.set({ scaleX: 1, scaleY: 1 });
    renderAll();
});


// =================================================================
// Toolbar Event Listeners
// =================================================================
function setActiveTool(toolId) {
    state.currentDrawMode = toolId;
    document.querySelectorAll('.tool-btn, .tool-group-btn').forEach(btn => btn.classList.remove('active'));
    
    const clickedButton = document.getElementById(toolId);
    const groupButton = clickedButton.closest('.tool-group')?.querySelector('.tool-group-btn');

    if (groupButton) {
        groupButton.classList.add('active');
        groupButton.textContent = clickedButton.textContent;
    } else {
        clickedButton.classList.add('active');
    }

    canvas.isDrawingMode = (state.currentDrawMode === 'pen');
    canvas.selection = (state.currentDrawMode === 'select');
    canvas.forEachObject(obj => obj.selectable = (state.currentDrawMode === 'select'));
    canvas.defaultCursor = (state.currentDrawMode === 'select') ? 'default' : 'crosshair';
    canvas.discardActiveObject().renderAll();
}

document.querySelectorAll('.tool-group-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const popup = e.currentTarget.nextElementSibling;
        const isActive = popup.classList.contains('active');
        document.querySelectorAll('.tool-popup').forEach(p => p.classList.remove('active'));
        if (!isActive) popup.classList.add('active');
    });
});

document.querySelectorAll('.tool-btn').forEach(button => {
    button.addEventListener('click', () => {
        setActiveTool(button.id)
        document.querySelectorAll('.tool-popup').forEach(p => p.classList.remove('active'));
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.tool-group')) {
        document.querySelectorAll('.tool-popup').forEach(p => p.classList.remove('active'));
    }
});

document.getElementById('undo').addEventListener('click', performUndo);
document.getElementById('clear').addEventListener('click', clearCanvas);

document.querySelectorAll('.preset-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const newWidth = parseFloat(e.currentTarget.textContent);
        state.brushWidth = newWidth;
        canvas.freeDrawingBrush.width = state.brushWidth;
        // Removed logic that modified selected objects
    });
});

const colorPalette = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#C06000'];
const paletteContainer = document.querySelector('.color-palette');
colorPalette.forEach(color => {
    const button = document.createElement('button');
    button.style.backgroundColor = color;
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.color-palette button').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.brushColor = color;
        canvas.freeDrawingBrush.color = state.brushColor;
        // Removed logic that modified selected objects
    });
    paletteContainer.appendChild(button);
});
document.querySelector('.color-palette button').click();

document.getElementById('fill-switch').addEventListener('click', (e) => {
    state.isShapeFilled = !state.isShapeFilled;
    e.currentTarget.parentElement.classList.toggle('outline', !state.isShapeFilled);
    // Removed logic that modified selected objects
});

// Set initial tool
setActiveTool('pen');
