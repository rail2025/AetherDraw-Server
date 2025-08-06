// =================================================================
// Canvas Setup
// =================================================================
const canvasContainer = document.getElementById('canvas-container');
const canvas = new fabric.Canvas('canvas', {
    backgroundColor: '#333',
    selection: true, // Enable object selection
});

function resizeCanvas() {
    const { width, height } = canvasContainer.getBoundingClientRect();
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.renderAll();
}

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(canvasContainer);
resizeCanvas();

// =================================================================
// Global State
// =================================================================
let currentDrawMode = 'pen';
let isDrawing = false;
let startPoint = null;
let currentObject = null;

let brushColor = '#FFFFFF';
let brushWidth = 4;
let isShapeFilled = true; // Default to filled shapes

// =================================================================
// Toolbar Logic
// =================================================================
const toolButtons = document.querySelectorAll('.tool-btn');

toolButtons.forEach(button => {
    button.addEventListener('click', () => {
        toolButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        currentDrawMode = button.id;
        canvas.isDrawingMode = (currentDrawMode === 'pen');
        canvas.selection = (currentDrawMode === 'select');
        canvas.defaultCursor = (currentDrawMode === 'select') ? 'default' : 'crosshair';

        console.log("Mode changed to:", currentDrawMode);
    });
});

// Initialize default tool
document.getElementById('pen').click();


// =================================================================
// Drawing Event Logic
// =================================================================

canvas.on('mouse:down', (o) => {
    if (currentDrawMode === 'select' || currentDrawMode === 'pen') return;

    isDrawing = true;
    startPoint = canvas.getPointer(o.e);
    
    const sharedProperties = {
        left: startPoint.x,
        top: startPoint.y,
        originX: 'left',
        originY: 'top',
        stroke: brushColor,
        strokeWidth: brushWidth,
        fill: isShapeFilled ? brushColor + '66' : 'transparent', // Hex alpha for fill
        selectable: false, // Prevent selection while drawing
    };

    switch (currentDrawMode) {
        case 'rectangle':
            currentObject = new fabric.Rect({ ...sharedProperties, width: 0, height: 0 });
            break;
        case 'circle':
            currentObject = new fabric.Circle({ ...sharedProperties, radius: 0 });
            break;
        case 'triangle':
            currentObject = new fabric.Triangle({ ...sharedProperties, width: 0, height: 0 });
            break;
        case 'line':
            currentObject = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
                stroke: brushColor,
                strokeWidth: brushWidth,
                selectable: false,
            });
            break;
        // More tools will be added here
    }

    if (currentObject) {
        canvas.add(currentObject);
    }
});

canvas.on('mouse:move', (o) => {
    if (!isDrawing || !currentObject) return;

    const pointer = canvas.getPointer(o.e);
    
    switch (currentDrawMode) {
        case 'rectangle':
        case 'triangle':
            currentObject.set({
                width: Math.abs(pointer.x - startPoint.x),
                height: Math.abs(pointer.y - startPoint.y),
                originX: (pointer.x < startPoint.x) ? 'right' : 'left',
                originY: (pointer.y < startPoint.y) ? 'bottom' : 'top',
            });
            break;
        case 'circle':
            const radius = Math.sqrt(
                Math.pow(pointer.x - startPoint.x, 2) + Math.pow(pointer.y - startPoint.y, 2)
            ) / 2;
            currentObject.set({
                radius: radius,
                originX: 'center',
                originY: 'center',
                left: (startPoint.x + pointer.x) / 2,
                top: (startPoint.y + pointer.y) / 2,
            });
            break;
        case 'line':
            currentObject.set({ x2: pointer.x, y2: pointer.y });
            break;
    }

    canvas.renderAll();
});

canvas.on('mouse:up', (o) => {
    if (isDrawing && currentObject) {
        currentObject.set({ selectable: true }); // Make the final object selectable
    }
    isDrawing = false;
    currentObject = null;
    startPoint = null;
});


// =================================================================
// Color & Thickness Logic
// =================================================================
const colorPalette = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#C06000'
];
const paletteContainer = document.querySelector('.color-palette');

colorPalette.forEach(color => {
    const button = document.createElement('button');
    button.style.backgroundColor = color;
    button.addEventListener('click', () => {
        brushColor = color;
        canvas.freeDrawingBrush.color = brushColor;
    });
    paletteContainer.appendChild(button);
});

const thicknessButtons = document.querySelectorAll('.preset-btn');
thicknessButtons.forEach(button => {
    button.addEventListener('click', () => {
        thicknessButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        brushWidth = parseFloat(button.textContent);
        canvas.freeDrawingBrush.width = brushWidth;
    });
});
