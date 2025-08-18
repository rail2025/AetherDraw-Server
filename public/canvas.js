const CanvasManager = (function () {
    let stage = null;
    let mainLayer = null;
    let isDrawing = false;
    let startPoint = null;

    let onObjectAdded = () => { };
    let onCanvasMouseDown = () => { };

    function resizeCanvas() {
        const container = document.getElementById('canvas-container');
        if (stage && container) {
            stage.width(container.offsetWidth);
            stage.height(container.offsetHeight);
        }
    }

    return {
        initialize: function (callbacks) {
            const container = document.getElementById('canvas-container');
            if (!container) return;

            onObjectAdded = callbacks.onObjectAdded || onObjectAdded;
            onCanvasMouseDown = callbacks.onCanvasMouseDown || onCanvasMouseDown;

            stage = new Konva.Stage({
                container: 'konva-container',
                width: container.offsetWidth,
                height: container.offsetHeight,
            });

            mainLayer = new Konva.Layer();
            stage.add(mainLayer);

            stage.on('mousedown', function (e) {
                const pointer = stage.getPointerPosition();
                onCanvasMouseDown(pointer, e.target);
            });

            window.addEventListener('resize', resizeCanvas);
        },

        renderPage: function (page) {
            if (mainLayer) {
                mainLayer.destroyChildren();
            }
        },

        updateSelectionMode: function (isSelectMode) {
            if (!stage) return;
            const container = stage.container();
            container.style.cursor = isSelectMode ? 'default' : 'crosshair';
        },

        startDrawing: function (toolName, pointer, options) {
            console.log(`Start drawing with tool: ${toolName}`, { pointer, options });
            isDrawing = true;
            startPoint = pointer;
        },

        placeImage: function (pointer, imageUrl, toolName, drawMode) {
            Konva.Image.fromURL(imageUrl, function (imageNode) {
                imageNode.setAttrs({
                    x: pointer.x,
                    y: pointer.y,
                    width: 30,
                    height: 30,
                    offsetX: 15, // Center the image on the cursor
                    offsetY: 15,
                    draggable: true,
                });
                mainLayer.add(imageNode);

                // Create a drawable object for state management
                const drawable = {
                    uniqueId: Konva.Util.getRandomId(),
                    toolName: toolName,
                    objectDrawMode: drawMode,
                    imageResourcePath: imageUrl,
                    left: pointer.x,
                    top: pointer.y,
                    width: 30,
                    height: 30,
                    angle: 0,
                    scaleX: 1,
                    scaleY: 1
                };
                onObjectAdded(drawable);
            });
        }
    };
})();