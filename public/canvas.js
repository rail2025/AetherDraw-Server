// Extend Fabric's Point class to include a normalize method, which is missing
// This will fix the TypeError and allow custom shapes like Cone to render correctly.
fabric.Point.prototype.normalize = function () {
    const length = Math.sqrt(this.x * this.x + this.y * this.y);
    if (length > 0) {
        return new fabric.Point(this.x / length, this.y / length);
    }
    return new fabric.Point(0, 0);
};

// A new, corrected Arrow class that matches the C# implementation's logic
fabric.AetherDrawArrow = fabric.util.createClass(fabric.Object, {
    type: 'aether-arrow',
    initialize: function (options) {
        options || (options = {});
        // Ensure startPoint and endPoint are always fabric.Point instances
        this.startPoint = new fabric.Point(options.startPoint.x, options.startPoint.y);
        this.endPoint = new fabric.Point(options.endPoint.x, options.endPoint.y);
        this.callSuper('initialize', options);
    },
    _render: function (ctx) {
        const shaftVector = this.endPoint.subtract(this.startPoint);
        const shaftLength = Math.sqrt(Math.pow(shaftVector.x, 2) + Math.pow(shaftVector.y, 2));
        if (shaftLength < 1) return;

        const shaftDir = shaftVector.normalize();

        const headLength = this.strokeWidth * 5;
        const headWidth = this.strokeWidth * 3;

        const p1 = this.startPoint;
        const p2 = this.endPoint;

        // Arrowhead points
        const headPerp = new fabric.Point(-shaftDir.y, shaftDir.x).multiply(headWidth / 2);
        const ah1 = new fabric.Point(p2.x + headPerp.x, p2.y + headPerp.y);
        const ah2 = new fabric.Point(p2.x - headPerp.x, p2.y - headPerp.y);
        const ahTip = new fabric.Point(p2.x + shaftDir.x * headLength, p2.y + shaftDir.y * headLength);

        ctx.save();
        ctx.lineWidth = this.strokeWidth;
        ctx.strokeStyle = this.stroke;
        ctx.fillStyle = this.stroke;

        // Draw Shaft
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Draw Arrowhead
        ctx.beginPath();
        ctx.moveTo(ahTip.x, ahTip.y);
        ctx.lineTo(ah1.x, ah1.y);
        ctx.lineTo(ah2.x, ah2.y);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
});


fabric.Triangle = fabric.util.createClass(fabric.Polygon, {
    type: 'triangle',
    initialize: function (points, options) {
        options || (options = {});
        this.callSuper('initialize', points, options);
    }
});

fabric.Cone = fabric.util.createClass(fabric.Object, {
    type: 'cone',
    initialize: function (options) {
        options || (options = {});
        this.callSuper('initialize', options);
        this.apex = options.apex || new fabric.Point(0, 0);
        this.baseCenter = options.baseCenter || new fabric.Point(0, 0);
        this.width = Math.abs(this.baseCenter.x - this.apex.x) * 2;
        this.height = Math.abs(this.baseCenter.y - this.apex.y);
    },
    _render: function (ctx) {
        const apex = this.apex;
        const baseCenter = this.baseCenter;
        const height = Math.sqrt(Math.pow(baseCenter.x - apex.x, 2) + Math.pow(baseCenter.y - apex.y, 2));
        const baseHalfWidth = height * 0.3; // ConeWidthFactor from C#

        const dir = new fabric.Point(baseCenter.x - apex.x, baseCenter.y - apex.y).normalize();
        const perp = new fabric.Point(-dir.y, dir.x).multiply(baseHalfWidth);

        const p1 = new fabric.Point(baseCenter.x + perp.x, baseCenter.y + perp.y);
        const p2 = new fabric.Point(baseCenter.x - perp.x, baseCenter.y - perp.y);

        ctx.beginPath();
        ctx.moveTo(apex.x, apex.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();

        if (this.fill) {
            ctx.fillStyle = this.fill;
            ctx.fill();
        }
        if (this.stroke && this.strokeWidth > 0) {
            ctx.lineWidth = this.strokeWidth;
            ctx.strokeStyle = this.stroke;
            ctx.stroke();
        }
    }
});


const CanvasManager = (function () {
    const canvas = new fabric.Canvas('canvas', {
        selection: true,
        backgroundColor: '#262629',
        stopContextMenu: true,
        fireRightClick: true,
    });

    let isDrawing = false;
    let currentFabricObject = null;
    let startPoint = null;

    let onObjectAdded = (drawable) => { };
    let onObjectTransforming = (drawable) => { };
    let onObjectModified = (drawable) => { };
    let onObjectsDeleted = (ids) => { };

    // More robust image/SVG loader that handles browser security correctly
    function loadImage(url) {
        return new Promise((resolve, reject) => {
            fabric.loadSVGFromURL(url, (objects, options) => {
                if (objects) {
                    const img = fabric.util.groupSVGElements(objects, options);
                    resolve(img);
                } else {
                    // Fallback for non-SVG images
                    fabric.Image.fromURL(url, (img) => {
                        if (img) {
                            resolve(img);
                        } else {
                            reject(`Failed to load image or SVG: ${url}`);
                        }
                    }, { crossOrigin: 'anonymous' });
                }
            });
        });
    }

    function drawGrid() {
        const gridSize = 40;
        const { width, height } = canvas.getElement().getBoundingClientRect();
        canvas.getObjects('grid').forEach(o => canvas.remove(o));
        const lines = [];
        for (let i = 1; i < (width / gridSize); i++) lines.push(new fabric.Line([i * gridSize, 0, i * gridSize, height], { stroke: '#404040', selectable: false, evented: false, name: 'grid' }));
        for (let i = 1; i < (height / gridSize); i++) lines.push(new fabric.Line([0, i * gridSize, width, i * gridSize], { stroke: '#404040', selectable: false, evented: false, name: 'grid' }));
        const gridGroup = new fabric.Group(lines, { selectable: false, evented: false, name: 'grid' });
        canvas.add(gridGroup);
        canvas.sendToBack(gridGroup);
    }

    function resizeCanvas() {
        const container = document.getElementById('canvas-container');
        if (!container) return;
        const { width, height } = container.getBoundingClientRect();
        canvas.setWidth(width);
        canvas.setHeight(height);
        drawGrid();
        canvas.renderAll();
    }

    function fabricToDrawable(fabricObject) {
        if (!fabricObject) return null;
        const baseDrawable = {
            uniqueId: fabricObject.uniqueId,
            toolName: fabricObject.toolName,
            objectDrawMode: fabricObject.objectDrawMode,
            stroke: fabricObject.stroke, fill: fabricObject.fill,
            strokeWidth: fabricObject.strokeWidth, angle: fabricObject.angle || 0,
            scaleX: fabricObject.scaleX || 1, scaleY: fabricObject.scaleY || 1,
        };

        if (fabricObject.points) { // Handles Polyline (used for Pen/Dash) and Triangle
            baseDrawable.points = fabricObject.points.map(p => ({ x: p.x, y: p.y }));
        } else if (fabricObject.type === 'aether-arrow') {
            baseDrawable.startPoint = { x: fabricObject.startPoint.x, y: fabricObject.startPoint.y };
            baseDrawable.endPoint = { x: fabricObject.endPoint.x, y: fabricObject.endPoint.y };
        } else if (fabricObject.type === 'line') {
            baseDrawable.x1 = fabricObject.x1; baseDrawable.y1 = fabricObject.y1;
            baseDrawable.x2 = fabricObject.x2; baseDrawable.y2 = fabricObject.y2;
        } else if (fabricObject.type === 'cone') {
            baseDrawable.apex = { x: fabricObject.apex.x, y: fabricObject.apex.y };
            baseDrawable.baseCenter = { x: fabricObject.baseCenter.x, y: fabricObject.baseCenter.y };
        }
        else {
            baseDrawable.left = fabricObject.left;
            baseDrawable.top = fabricObject.top;
            if (['rect', 'textbox'].includes(fabricObject.type)) {
                baseDrawable.width = fabricObject.width * (fabricObject.scaleX || 1);
                baseDrawable.height = fabricObject.height * (fabricObject.scaleY || 1);
                if (fabricObject.type === 'textbox') {
                    baseDrawable.text = fabricObject.text; baseDrawable.fontSize = fabricObject.fontSize;
                }
            } else if (fabricObject.type === 'circle') {
                baseDrawable.radius = fabricObject.radius * (fabricObject.scaleX || 1);
            } else if (fabricObject.type === 'image' || fabricObject.type === 'group') { // SVGs are loaded as groups
                baseDrawable.imageResourcePath = fabricObject.imageResourcePath;
                baseDrawable.width = fabricObject.width * (fabricObject.scaleX || 1);
                baseDrawable.height = fabricObject.height * (fabricObject.scaleY || 1);
            }
        }
        return baseDrawable;
    }

    async function drawableToFabric(drawable) {
        let fabricObject = null;
        const props = {
            ...drawable,
            selectable: true,
            evented: true,
        };

        switch (drawable.objectDrawMode) {
            case DrawMode.Pen:
            case DrawMode.Dash:
                fabricObject = new fabric.Polyline(drawable.points, { ...props, fill: null, strokeDashArray: drawable.objectDrawMode === DrawMode.Dash ? [drawable.strokeWidth * 2.5, drawable.strokeWidth * 1.25] : null });
                break;
            case DrawMode.StraightLine:
                fabricObject = new fabric.Line([drawable.x1, drawable.y1, drawable.x2, drawable.y2], { ...props, fill: null });
                break;
            case DrawMode.Arrow:
                fabricObject = new fabric.AetherDrawArrow({ ...props });
                break;
            case DrawMode.Rectangle:
                fabricObject = new fabric.Rect({ ...props });
                break;
            case DrawMode.Circle:
                fabricObject = new fabric.Circle({ ...props });
                break;
            case DrawMode.Triangle:
                fabricObject = new fabric.Triangle(drawable.points, { ...props });
                break;
            case DrawMode.Cone:
                fabricObject = new fabric.Cone({ ...props });
                break;
            case DrawMode.TextTool:
                fabricObject = new fabric.Textbox(drawable.text, { ...props });
                break;
            default:
                if (drawable.objectDrawMode >= DrawMode.Image && drawable.objectDrawMode <= DrawMode.Dot8Image) {
                    try {
                        const img = await loadImage(drawable.imageResourcePath);
                        fabricObject = img;
                        fabricObject.set({ ...props });
                    } catch (error) {
                        console.error(error);
                    }
                }
                break;
        }

        if (fabricObject) {
            canvas.add(fabricObject);
        }

        return fabricObject;
    }


    return {
        initialize: function (callbacks) {
            onObjectAdded = callbacks.onObjectAdded;
            onObjectTransforming = callbacks.onObjectTransforming;
            onObjectModified = callbacks.onObjectModified;
            onObjectsDeleted = callbacks.onObjectsDeleted;
            const container = document.getElementById('canvas-container');
            if (container) {
                const resizeObserver = new ResizeObserver(resizeCanvas);
                resizeObserver.observe(container);
            }
            canvas.on('mouse:down', (opt) => {
                if (opt.e.button !== 0) return;
                callbacks.onCanvasMouseDown(canvas.getPointer(opt.e), opt.target);
            });
            canvas.on('mouse:move', (opt) => {
                if (!isDrawing || !currentFabricObject) return;
                const pointer = canvas.getPointer(opt.e);
                switch (currentFabricObject.toolName) {
                    case 'pen':
                    case 'dash':
                        const lastPoint = currentFabricObject.points[currentFabricObject.points.length - 1];
                        const distance = Math.sqrt(Math.pow(pointer.x - lastPoint.x, 2) + Math.pow(pointer.y - lastPoint.y, 2));
                        if (distance > 2) {
                            currentFabricObject.points.push(new fabric.Point(pointer.x, pointer.y));
                        }
                        break;
                    case 'line':
                        currentFabricObject.set({ x2: pointer.x, y2: pointer.y });
                        break;
                    case 'arrow':
                        currentFabricObject.set({ endPoint: new fabric.Point(pointer.x, pointer.y) });
                        break;
                    case 'rectangle':
                        const width = pointer.x - startPoint.x;
                        const height = pointer.y - startPoint.y;
                        currentFabricObject.set({
                            left: width > 0 ? startPoint.x : pointer.x,
                            top: height > 0 ? startPoint.y : pointer.y,
                            width: Math.abs(width),
                            height: Math.abs(height)
                        });
                        break;
                    case 'circle':
                        const radius = Math.sqrt(Math.pow(startPoint.x - pointer.x, 2) + Math.pow(startPoint.y - pointer.y, 2)) / 2;
                        currentFabricObject.set({
                            left: (startPoint.x + pointer.x) / 2 - radius,
                            top: (startPoint.y + pointer.y) / 2 - radius,
                            radius: radius > 0 ? radius : 1
                        });
                        break;
                    case 'triangle':
                        currentFabricObject.points[1].setXY(pointer.x, startPoint.y);
                        currentFabricObject.points[2].setXY(pointer.x, pointer.y);
                        break;
                    case 'cone':
                        currentFabricObject.set({ baseCenter: pointer });
                        break;
                }
                canvas.renderAll();
            });
            canvas.on('mouse:up', (opt) => {
                if (!isDrawing || !currentFabricObject) return;
                isDrawing = false;
                const drawable = fabricToDrawable(currentFabricObject);
                canvas.remove(currentFabricObject);
                currentFabricObject = null;
                if (drawable) {
                    drawableToFabric(drawable).then(fabricObj => {
                        onObjectAdded(fabricToDrawable(fabricObj));
                    });
                }
            });

            canvas.on('object:moving', (opt) => {
                if (opt.target) onObjectTransforming(fabricToDrawable(opt.target));
            });
            canvas.on('object:scaling', (opt) => {
                if (opt.target) onObjectTransforming(fabricToDrawable(opt.target));
            });
            canvas.on('object:rotating', (opt) => {
                if (opt.target) onObjectTransforming(fabricToDrawable(opt.target));
            });
            canvas.on('object:modified', (opt) => {
                if (opt.target) onObjectModified(fabricToDrawable(opt.target));
            });
            resizeCanvas();
        },
        renderPage: async function (page) {
            canvas.clear();
            drawGrid();
            for (const drawable of page.drawables) {
                await drawableToFabric(drawable);
            }
        },
        startDrawing: async function (toolName, drawMode, pointer, brushColor, brushWidth, isShapeFilled) {
            const detail = UIManager.getModeDetailsByToolName(toolName);
            if (detail && detail.icon) {
                try {
                    const fabricImage = await loadImage(detail.icon);
                    const props = {
                        left: pointer.x - 15, // Centering the image
                        top: pointer.y - 15,
                        uniqueId: crypto.randomUUID(), toolName: toolName, objectDrawMode: drawMode,
                        imageResourcePath: detail.icon,
                    };

                    fabricImage.set(props);
                    if (fabricImage.type === 'group') {
                        fabricImage.scaleToWidth(30);
                        fabricImage.scaleToHeight(30);
                    }

                    onObjectAdded(fabricToDrawable(fabricImage));

                } catch (error) { console.error(error); }
                return;
            }

            isDrawing = true;
            startPoint = pointer;
            let props = {
                stroke: brushColor, strokeWidth: brushWidth,
                fill: isShapeFilled ? brushColor : 'transparent',
                selectable: false, evented: false,
                uniqueId: crypto.randomUUID(), toolName: toolName, objectDrawMode: drawMode,
            };

            switch (toolName) {
                case 'pen':
                    currentFabricObject = new fabric.Polyline([pointer], { ...props, fill: null });
                    break;
                case 'dash':
                    currentFabricObject = new fabric.Polyline([pointer], { ...props, fill: null, strokeDashArray: [props.strokeWidth * 2.5, props.strokeWidth * 1.25] });
                    break;
                case 'line':
                    currentFabricObject = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], { ...props, fill: null });
                    break;
                case 'arrow':
                    currentFabricObject = new fabric.AetherDrawArrow({ ...props, startPoint: new fabric.Point(pointer.x, pointer.y), endPoint: new fabric.Point(pointer.x, pointer.y) });
                    break;
                case 'rectangle':
                    currentFabricObject = new fabric.Rect({ ...props, left: pointer.x, top: pointer.y, width: 0, height: 0 });
                    break;
                case 'circle':
                    currentFabricObject = new fabric.Circle({ ...props, left: pointer.x, top: pointer.y, radius: 0 });
                    break;
                case 'triangle':
                    currentFabricObject = new fabric.Triangle([pointer, pointer, pointer], { ...props });
                    break;
                case 'cone':
                    currentFabricObject = new fabric.Cone({ ...props, apex: pointer, baseCenter: pointer });
                    break;
                case 'text':
                    const text = new fabric.Textbox('New Text', { ...props, left: pointer.x, top: pointer.y, width: 200, fontSize: 20, fill: brushColor, selectable: true, evented: true });
                    onObjectAdded(fabricToDrawable(text));
                    isDrawing = false;
                    return;
                default:
                    isDrawing = false;
                    return;
            }
            if (currentFabricObject) canvas.add(currentFabricObject);
        },
        deleteSelected: function () {
            const activeObjects = canvas.getActiveObjects();
            if (!activeObjects || activeObjects.length === 0) return;

            const idsToDelete = activeObjects.map(obj => obj.uniqueId);
            canvas.remove(...activeObjects);
            canvas.discardActiveObject();
            canvas.renderAll();

            onObjectsDeleted(idsToDelete);
        },
        updateSelectionMode: function (isSelectMode) {
            canvas.selection = isSelectMode;
            canvas.defaultCursor = isSelectMode ? 'default' : 'crosshair';
            canvas.getObjects().forEach(obj => {
                if (obj.name !== 'grid') { // Don't make the grid selectable
                    obj.selectable = isSelectMode;
                    obj.evented = isSelectMode;
                }
            });
            canvas.renderAll();
        }
    };
})();