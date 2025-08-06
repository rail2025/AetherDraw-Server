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
        state.undoStack.shift(); // Remove the oldest state
    }
    // Deep clone the drawables array to save its state
    state.undoStack.push(JSON.parse(JSON.stringify(state.drawables)));
    console.log(`Action recorded: ${actionDescription}. Undo stack size: ${state.undoStack.length}`);
}

function performUndo() {
    if (state.undoStack.length > 0) {
        state.drawables = state.undoStack.pop();
        renderAll();
        console.log(`Undo performed. Undo stack size: ${state.undoStack.length}`);
    } else {
        console.log("Nothing to undo.");
    }
}


// =================================================================
// Canvas Setup
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


// =================================================================
// Drawing & State Management
// =================================================================
let isDrawing = false;
let startPoint = null;
let currentFabricObject = null;

// This function converts our data objects into Fabric.js objects for display
function renderAll() {
    canvas.clear();
    state.drawables.forEach(drawable => {
        let fabricObject;
        // This will be expanded to handle every shape type
        if (drawable.objectDrawMode === 'rectangle') {
            fabricObject = new fabric.Rect({
                left: drawable.left,
                top: drawable.top,
                width: drawable.width,
                height: drawable.height,
                fill: drawable.fill,
                stroke: drawable.stroke,
                strokeWidth: drawable.strokeWidth,
                angle: drawable.angle,
                selectable: true,
            });
        }
        // Add more 'if' conditions for circles, lines, etc. here

        if (fabricObject) {
            canvas.add(fabricObject);
        }
    });
}

canvas.on('mouse:down', (o) => {
    if (state.currentDrawMode === 'select') return;
    
    recordUndoState(`Start drawing ${state.currentDrawMode}`);

    isDrawing = true;
    startPoint = canvas.getPointer(o.e);
    
    const sharedProperties = {
        left: startPoint.x,
        top: startPoint.y,
        stroke: state.brushColor,
        strokeWidth: state.brushWidth,
        fill: state.isShapeFilled ? state.brushColor + '66' : 'transparent',
        selectable: false,
    };

    if (state.currentDrawMode === 'rectangle') {
        currentFabricObject = new fabric.Rect({ ...sharedProperties, width: 0, height: 0 });
    }
    // Add logic for other shapes here later

    if (currentFabricObject) {
        canvas.add(currentFabricObject);
    }
});

canvas.on('mouse:move', (o) => {
    if (!isDrawing || !currentFabricObject) return;

    const pointer = canvas.getPointer(o.e);

    if (state.currentDrawMode === 'rectangle') {
        currentFabricObject.set({
            width: Math.abs(pointer.x - startPoint.x),
            height: Math.abs(pointer.y - startPoint.y),
            originX: (pointer.x < startPoint.x) ? 'right' : 'left',
            originY: (pointer.y < startPoint.y) ? 'bottom' : 'top',
        });
    }
    // Add logic for other shapes here later

    canvas.renderAll();
});

canvas.on('mouse:up', (o) => {
    if (!isDrawing || !currentFabricObject) return;

    // Create the data object that mirrors the C# structure
    const newDrawable = {
        // uniqueId: crypto.randomUUID(),
        objectDrawMode: state.currentDrawMode, // This will be an enum value later
        color: hexToRgba(state.brushColor, state.isShapeFilled ? 0.4 : 1.0),
        thickness: state.brushWidth,
        isFilled: state.isShapeFilled,
        // Shape-specific properties
        left: currentFabricObject.left,
        top: currentFabricObject.top,
        width: currentFabricObject.width,
        height: currentFabricObject.height,
        angle: currentFabricObject.angle,
        // We will add more properties for other shapes
    };

    // Replace the temporary visual object with a new one from our data store
    state.drawables.push(newDrawable);
    
    // In a real scenario, we would now serialize `newDrawable` and send it
    
    isDrawing = false;
    currentFabricObject = null;
    startPoint = null;
    
    renderAll();
});


// =================================================================
// Toolbar Event Listeners
// =================================================================
const toolButtons = document.querySelectorAll('.tool-btn');
toolButtons.forEach(button => {
    button.addEventListener('click', () => {
        toolButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        state.currentDrawMode = button.id;
        canvas.isDrawingMode = (state.currentDrawMode === 'pen');
        canvas.selection = (state.currentDrawMode === 'select');
        canvas.defaultCursor = (state.currentDrawMode === 'select') ? 'default' : 'crosshair';
    });
});

document.querySelector('button.full-width-btn').addEventListener('click', performUndo);

const thicknessButtons = document.querySelectorAll('.preset-btn');
thicknessButtons.forEach(button => {
    button.addEventListener('click', () => {
        thicknessButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        state.brushWidth = parseFloat(button.textContent);
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
