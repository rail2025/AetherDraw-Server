const CanvasController = (function () {
    let state = null;
    let callbacks = {};
    let currentPageDrawables = [];
    let onToolSelectCallback = () => {};

    let isDrawing = false;
    let isErasing = false; 
    let currentDrawingObject = null; // This will now hold a Drawable, not a Konva shape.

    function hexToRgbaObject(hex) {
        if (!hex || hex.length < 4) return { r: 1, g: 1, b: 1, a: 1 };
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        return { r, g, b, a: 1.0 };
    }

    function createNewDrawingObject(toolName, startPos, color, thickness, isFilled) {
        let finalColor = { ...color };
        if (isFilled) {
            switch (toolName) {
                case 'Rectangle':
                case 'Circle':
                case 'Triangle':
                case 'Cone':
                    finalColor.a = 0.4;
                    break;
            }
        }

        switch (toolName) {
            case 'Pen':
                return new DrawablePath(startPos, finalColor, thickness);
            case 'Rectangle':
                return new DrawableRectangle(startPos, finalColor, thickness, isFilled);
            case 'Circle':
                return new DrawableCircle(startPos, finalColor, thickness, isFilled);
            case 'Cone':
                return new DrawableCone(startPos, finalColor, thickness, isFilled);
            case 'Triangle':
                return new DrawableTriangle(startPos, finalColor, thickness, isFilled);
            case 'Arrow':
                return new DrawableArrow(startPos, finalColor, thickness);
            case 'StraightLine':
                return new DrawableStraightLine(startPos, finalColor, thickness);
            case 'Dash':
                return new DrawableDash(startPos, finalColor, thickness);
            default:
                return null;
        }
    }

    
   function eraseAtPoint(pos) {
       // Find the topmost shape at the cursor position
       // We need to iterate backwards since the last drawn shape is on top.
       let deletedObjectIds = [];
       for (let i = currentPageDrawables.length - 1; i >= 0; i--) {
           const drawable = currentPageDrawables[i];
           if (drawable.isHit(pos)) {
               deletedObjectIds.push(drawable.uniqueId);
               break; // Stop after finding the first (topmost) object
           }
       }

       if (deletedObjectIds.length > 0) {
           callbacks.onObjectDeleted(deletedObjectIds);
       }
    }


    function finalizeCurrentDrawing() {
        if (!currentDrawingObject) {
            isDrawing = false;
            return;
        }
        currentDrawingObject.isPreview = false;

        let isValidObject = true;
        if (currentDrawingObject instanceof DrawablePath && currentDrawingObject.points.length < 2) isValidObject = false;
        else if (currentDrawingObject instanceof DrawableCircle && currentDrawingObject.radius < 1.5) isValidObject = false;
        else if (currentDrawingObject instanceof DrawableRectangle) {
            if (Math.abs(currentDrawingObject.startPoint.x - currentDrawingObject.endPoint.x) < 2 || Math.abs(currentDrawingObject.startPoint.y - currentDrawingObject.endPoint.y) < 2) {
                isValidObject = false;
            }
        }

        if (isValidObject) {
            callbacks.onObjectAdded(currentDrawingObject);
        } else {
            callbacks.onDrawingCancelled();
        }

        currentDrawingObject = null;
        isDrawing = false;
    }
    
    function placeImage(pointer) {
        const toolDetails = callbacks.getToolDetails(state.currentToolName);
        if (!toolDetails || !toolDetails.pluginResourcePath) return;

        const tint = {r:1, g:1, b:1, a:1};
        const drawSize = {width: 30, height: 30};
        const drawMode = DrawMode[state.currentToolName];
        const newImage = new DrawableImage(drawMode, toolDetails.pluginResourcePath, pointer, drawSize, tint, 0);
        
        callbacks.onObjectAdded(newImage, true);
        onToolSelectCallback('select');
    }

    return {
        initialize: function (appState, appCallbacks, pageDrawablesRef, toolSelectCallback) {
            state = appState;
            callbacks = appCallbacks;
            currentPageDrawables = pageDrawablesRef;
            onToolSelectCallback = toolSelectCallback;
        },

        setCurrentPageDrawables: function (pageDrawablesRef) {
            currentPageDrawables = pageDrawablesRef;
        },

        handleMouseDown: function (e) {
            console.log(`[canvasController.js] handleMouseDown entered. Tool: '${state.currentToolName}'`);
            const pointer = e.target.getStage().getPointerPosition();
            const toolDetails = callbacks.getToolDetails(state.currentToolName);
            const shapeTools = ['Pen', 'Rectangle', 'Circle', 'Triangle', 'Cone', 'Arrow', 'StraightLine', 'Dash'];

            if (state.currentToolName === 'Eraser') {
               isErasing = true;
               eraseAtPoint(pointer);
            } else if (shapeTools.includes(state.currentToolName)) {
            console.log('[canvasController.js] Tool is a shape. Attempting to create new drawing object.');
                isDrawing = true;
                callbacks.onDrawingStarted();
                const color = hexToRgbaObject(state.brushColor);
                currentDrawingObject = createNewDrawingObject(state.currentToolName, pointer, color, state.brushWidth, state.isShapeFilled);
                console.log('[PREVIEW LOG] MouseDown created drawable:', currentDrawingObject);
                // We no longer add a temporary Konva shape. The main render loop will handle the preview.
            } else if (toolDetails && toolDetails.imageResourcePath) {
                console.log('[canvasController.js] Tool is an image. Attempting to place image.');
                placeImage(pointer);
            } else {
                console.log(`[canvasController.js] Tool '${state.currentToolName}' not recognized as a shape or image tool. Doing nothing.`);
            }
        },

        handleMouseMove: function (e) {
            if (isDrawing && currentDrawingObject) {
                const pointer = e.target.getStage().getPointerPosition();
                
                if (currentDrawingObject instanceof DrawablePath || currentDrawingObject instanceof DrawableDash) {
                    currentDrawingObject.addPoint(pointer);
                } 
                else if (typeof currentDrawingObject.updatePreview === 'function') {
                    console.log('[PREVIEW LOG] Calling updatePreview...');
                    currentDrawingObject.updatePreview(pointer);
                    console.log('[PREVIEW LOG] Drawable updated after preview:', JSON.parse(JSON.stringify(currentDrawingObject)));
                }
                
                // Instead of drawing here, we rely on a render call from the main loop
                // For now, we manually trigger a quick update.
                console.log('[PREVIEW LOG] Calling onStateChanged for quick update.');
                callbacks.onStateChanged(true, currentDrawingObject);
            } else if (isErasing) {
                const pointer = e.target.getStage().getPointerPosition();
                eraseAtPoint(pointer); // Continuously erase on drag
            }
            
        },

        handleMouseUp: function (e) {
            if (isDrawing) {
                finalizeCurrentDrawing();
                onToolSelectCallback('select');
            }
            if (isErasing) {isErasing = false;}
        },
    };
})();