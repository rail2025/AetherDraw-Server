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

    // NEW: Function to create a Konva shape from a drawable state object
    function createShapeFromDrawable(drawable) {
        if (!drawable) {
            console.error("AetherDraw Render Error: Cannot create shape from null drawable.");
            return;
        }

        // For now, we only handle image objects as per the current goal
        if (drawable.objectDrawMode >= DrawMode.Image && drawable.objectDrawMode <= DrawMode.Dot8Image) {
            // Check if the local URL for rendering exists
            if (!drawable.imageResourcePath) {
                console.error("AetherDraw Render Error: Drawable image is missing its 'imageResourcePath' for local rendering.", drawable);
                return;
            }

            Konva.Image.fromURL(drawable.imageResourcePath, function (imageNode) {
                imageNode.setAttrs({
                    x: drawable.left,
                    y: drawable.top,
                    width: drawable.width,
                    height: drawable.height,
                    rotation: drawable.angle,
                    offsetX: drawable.width / 2,
                    offsetY: drawable.height / 2,
                    draggable: true,
                });
                mainLayer.add(imageNode);
            });
        } else {
            console.log(`AetherDraw Render: Skipping unimplemented shape with DrawMode: ${drawable.objectDrawMode}`);
        }
    }

    return {
        initialize: function (callbacks) {
            const container = document.getElementById('canvas-container');
            if (!container) {
                console.error("AetherDraw Init Error: Canvas container not found.");
                return;
            }

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
            console.log("AetherDraw: CanvasManager initialized.");
        },

        // MODIFIED: This function is now fully implemented.
        renderPage: function (page) {
            if (!mainLayer) {
                console.error("AetherDraw Render Error: mainLayer is not initialized.");
                return;
            }
            if (!page || !page.drawables) {
                console.error("AetherDraw Render Error: Invalid page or drawables array provided.", page);
                return;
            }

            console.log(`AetherDraw Render: Clearing canvas and rendering ${page.drawables.length} objects for page.`);
            mainLayer.destroyChildren();

            page.drawables.forEach(drawable => {
                createShapeFromDrawable(drawable);
            });
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

        placeImage: function (pointer, imageUrl, toolName, drawMode, pluginResourcePath) {
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

                const drawable = {
                    uniqueId: crypto.randomUUID(),
                    toolName: toolName,
                    objectDrawMode: drawMode,
                    imageResourcePath: imageUrl, 
                    pluginResourcePath: pluginResourcePath, 
                    left: pointer.x,
                    top: pointer.y,
                    width: 30,
                    height: 30,
                    angle: 0,
                    scaleX: 1,
                    scaleY: 1
                };
                onObjectAdded(drawable, true); // Prevent double-render
            });
        }
    };
})();