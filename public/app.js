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
    if (state.undoStack.length >= MAX_UNDO_LEVELS) {
        state.undoStack.shift();
    }
    state.undoStack.push(JSON.parse(JSON.stringify(state.drawables)));
    console.log(`Action recorded: ${actionDescription}. Undo stack size: ${state.undoStack.length}`);
}

function performUndo() {
    if (state.undoStack.length > 0) {
        state.drawables = state.undoStack.pop();
        renderAll();
        console.log(`Undo performed. Remaining undo states: ${state.undoStack.length}`);
    } else {
        console.log("Nothing to undo.");
    }
}

// =================================================================
// Canvas Setup & Rendering
// =================================================================
const canvasContainer = document.getElementById('canvas-container');
const canvas = new fabric.Canvas('canvas', {
    backgroundColor: '#333',
    selection: false,
});

function resizeCanvas() {
    const { width, height } = canvasContainer.getBoundingClientRect();
    canvas.setWidth(width);
    canvas.setHeight(height);
}
const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvasContainer);
resizeCanvas();

function renderAll() {
    canvas.clear();
    state.drawables.forEach(drawable => {
        let fabricObject;
        const commonProps = {
            left: drawable.left,
            top: drawable.top,
            fill: drawable.fill,
            stroke: drawable.stroke,
            strokeWidth: drawable.strokeWidth,
            angle: drawable.angle,
            selectable: true,
            originX: 'left',
            originY: 'top',
        };

        switch (drawable.objectDrawMode) {
            case 'rectangle':
                fabricObject = new fabric.Rect({ ...commonProps, width: drawable.width, height: drawable.height });
                break;
            case 'circle':
                fabricObject = new fabric.Circle({ ...commonProps, radius: drawable.radius });
                break;
            case 'triangle':
                 fabricObject = new fabric.Triangle({ ...commonProps, width: drawable.width, height: drawable.height });
                break;
            case 'line':
                fabricObject = new fabric.Line([drawable.x1, drawable.y1, drawable.x2, drawable.y2], {
                    stroke: drawable.stroke,
                    strokeWidth: drawable.strokeWidth,
                    selectable: true,
                });
                break;
        }

        if (fabricObject) {
            canvas.add(fabricObject);
        }
    });
    canvas.renderAll();
}

// =================================================================
// Drawing Event Logic
// =================================================================
let isDrawing = false;
let startPoint = null;
let currentDrawable = null;

canvas.on('mouse:down', (o) => {
    if (state.currentDrawMode === 'select' || state.currentDrawMode === 'pen') return;

    recordUndoState(`Start drawing ${state.currentDrawMode}`);
    isDrawing = true;
    startPoint = canvas.getPointer(o.e);

    const uniqueId = crypto.randomUUID();
    
    currentDrawable = {
        uniqueId: uniqueId,
        objectDrawMode: state.currentDrawMode,
        color: hexToRgba(state.brushColor, 1.0),
        thickness: state.brushWidth,
        isFilled: state.isShapeFilled,
        
        // Properties for Fabric.js rendering
        left: startPoint.x,
        top: startPoint.y,
        width: 0,
        height: 0,
        radius: 0,
        x1: startPoint.x,
        y1: startPoint.y,
        x2: startPoint.x,
        y2: startPoint.y,
        angle: 0,
        fill: state.isShapeFilled ? state.brushColor + '66' : 'transparent',
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
    };

    state.drawables.push(currentDrawable);
});

canvas.on('mouse:move', (o) => {
    if (!isDrawing) return;

    const pointer = canvas.getPointer(o.e);
    const width = Math.abs(pointer.x - startPoint.x);
    const height = Math.abs(pointer.y - startPoint.y);

    currentDrawable.left = Math.min(pointer.x, startPoint.x);
    currentDrawable.top = Math.min(pointer.y, startPoint.y);

    switch (currentDrawable.objectDrawMode) {
        case 'rectangle':
        case 'triangle':
            currentDrawable.width = width;
            currentDrawable.height = height;
            break;
        case 'circle':
            currentDrawable.radius = Math.max(width, height) / 2;
            currentDrawable.left = startPoint.x - currentDrawable.radius;
            currentDrawable.top = startPoint.y - currentDrawable.radius;
            break;
        case 'line':
            currentDrawable.x2 = pointer.x;
            currentDrawable.y2 = pointer.y;
            break;
    }
    
    renderAll();
});

canvas.on('mouse:up', (o) => {
    if (!isDrawing) return;
    isDrawing = false;
    currentDrawable = null;
    startPoint = null;
    renderAll(); // Final render to ensure selectable is true
});


// =================================================================
// Toolbar Event Listeners
// =================================================================
document.querySelectorAll('.tool-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn, .tool-group-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        state.currentDrawMode = button.id;
        canvas.isDrawingMode = (state.currentDrawMode === 'pen');
        canvas.selection = (state.currentDrawMode === 'select');
        canvas.defaultCursor = (state.currentDrawMode === 'select') ? 'default' : 'crosshair';
        canvas.discardActiveObject().renderAll(); // Deselect objects when changing tools
    });
});

document.querySelector('button.full-width-btn').addEventListener('click', performUndo);

document.querySelectorAll('.preset-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.brushWidth = parseFloat(e.currentTarget.textContent);
        canvas.freeDrawingBrush.width = state.brushWidth;
    });
});

const colorPalette = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#C06000'];
const paletteContainer = document.querySelector('.color-palette');
colorPalette.forEach(color => {
    const button = document.createElement('button');
    button.style.backgroundColor = color;
    button.addEventListener('click', () => {
        state.brushColor = color;
        canvas.freeDrawingBrush.color = state.brushColor;
    });
    paletteContainer.appendChild(button);
});

// Helper function to convert hex color to an RGBA object for serialization
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b, a: alpha };
}

// Set initial tool
document.getElementById('pen').click();
