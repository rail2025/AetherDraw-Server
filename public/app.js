// --- Canvas Setup ---
const canvas = new fabric.Canvas('canvas', {
    backgroundColor: '#333',
    isDrawingMode: true
});

function resizeCanvas() {
    const toolbar = document.getElementById('toolbar');
    const container = document.getElementById('canvas-container');
    const { width, height } = container.getBoundingClientRect();
    canvas.setWidth(width);
    canvas.setHeight(height);
    canvas.renderAll();
}

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(document.getElementById('canvas-container'));
resizeCanvas();

// --- Toolbar Logic ---
const toolButtons = document.querySelectorAll('.tool-btn, .tool-group-btn');
let currentTool = 'pen';

toolButtons.forEach(button => {
    button.addEventListener('click', () => {
        toolButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        currentTool = button.id ? button.id.split('-')[0] : 'placeholder';
        canvas.isDrawingMode = (currentTool === 'pen');
        console.log("Current Tool:", currentTool);
    });
});

// Set pen properties
canvas.freeDrawingBrush.color = '#FFFFFF';
canvas.freeDrawingBrush.width = 4;

// --- Color Palette ---
const colorPalette = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#C06000'
];
const paletteContainer = document.querySelector('.color-palette');

colorPalette.forEach(color => {
    const button = document.createElement('button');
    button.style.backgroundColor = color;
    button.addEventListener('click', () => {
        canvas.freeDrawingBrush.color = color;
        console.log("Brush color set to:", color);
    });
    paletteContainer.appendChild(button);
});

// --- Thickness Presets ---
const thicknessButtons = document.querySelectorAll('.preset-btn');
thicknessButtons.forEach(button => {
    button.addEventListener('click', () => {
        thicknessButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        const newWidth = parseFloat(button.textContent);
        canvas.freeDrawingBrush.width = newWidth;
        console.log("Brush width set to:", newWidth);
    });
});