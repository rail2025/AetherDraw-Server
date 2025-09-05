// drawableFactory.js

const DrawableFactory = {
    /**
     * Creates a drawable object instance from a plain state object.
     * This is crucial for re-instantiating objects to restore their methods (e.g., .translate).
     * @param {object} state - A plain object containing the drawable's data.
     * @returns {BaseDrawable|null} A new instance of the correct drawable class, restored to its previous state.
     */
    createFromState: function(state) {
        if (!state || typeof state.objectDrawMode === 'undefined') {
            console.error("DrawableFactory: Invalid state object provided.", state);
            return null;
        }

        let instance = null;

        // Based on the object's type, call the appropriate constructor.
        // The constructor initializes the object with its basic required parameters.
        switch (state.objectDrawMode) {
            case DrawMode.Rectangle:
                instance = new DrawableRectangle(state.startPoint, state.color, state.thickness, state.isFilled);
                break;
            case DrawMode.Circle:
                instance = new DrawableCircle(state.center, state.color, state.thickness, state.isFilled);
                break;
            case DrawMode.Triangle:
                // The constructor intelligently handles receiving an array of vertices.
                instance = new DrawableTriangle(state.vertices, state.color, state.thickness, state.isFilled);
                break;
            case DrawMode.Pen:
                // The constructor only requires the first point to start.
                instance = new DrawablePath(state.points[0], state.color, state.thickness);
                break;
            case DrawMode.Arrow:
                instance = new DrawableArrow(state.startPoint, state.color, state.thickness, state.isFilled);
                break;
            case DrawMode.StraightLine:
                instance = new DrawableStraightLine(state.startPoint, state.color, state.thickness);
                break;
            case DrawMode.TextTool:
                // The text setter handles internal layout, so we pass properties to the constructor.
                instance = new DrawableText(state.position, state.text, state.color, state.fontSize, state.wrappingWidth);
                break;
            default:
                // Handle all image types by checking if the mode is in the image range.
                if (state.objectDrawMode >= DrawMode.Image) {
                    const drawSize = { width: state.width, height: state.height };
                    instance = new DrawableImage(state.objectDrawMode, state.pluginResourcePath, state.position, drawSize, state.color, state.rotation);
                } else {
                    console.warn(`DrawableFactory: Unrecognized objectDrawMode '${state.objectDrawMode}'`);
                    return null;
                }
                break;
        }

        // After creating the instance with its base parameters, we use Object.assign.
        // This copies all remaining properties (like .endPoint, .radius, .rotation, .uniqueId, etc.)
        // from the saved state onto the new instance, fully restoring it.
        if (instance) {
            Object.assign(instance, state);
        }
        
        return instance;
    }
};  