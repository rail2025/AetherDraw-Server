const UndoManager = (function (config) {
    const settings = {
        maxUndoLevels: (config && config.maxUndoLevels) || 30
    };

    let undoStack = [];

    return {
        recordAction: function (currentDrawables, actionDescription) {
            // Trim the stack if it's too large by removing the oldest action.
            while (undoStack.length >= settings.maxUndoLevels) {
                undoStack.shift();
            }

            // Create a deep clone of each drawable by calling its own .clone() method.
            const stateToSave = currentDrawables.map(drawable => drawable.clone());

            const action = {
                state: stateToSave,
                description: actionDescription
            };

            undoStack.push(action);
        },

        undo: function () {
            if (this.canUndo()) {
                const lastAction = undoStack.pop();
                return lastAction.state;
            }
            return null;
        },

        
        canUndo: function () {
            return undoStack.length > 0;
        },

        
        clearHistory: function () {
            undoStack = [];
        }
    };
})();