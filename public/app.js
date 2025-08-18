document.addEventListener('DOMContentLoaded', () => {

    const state = {
        pages: [],
        currentPageIndex: 0,
        pageClipboard: null,
        currentToolName: 'select',
        currentDrawMode: 9, // Corresponds to DrawMode.Select
        brushColor: '#FFFFFF',
        brushWidth: 4,
        isShapeFilled: false,
    };

    const network = new NetworkManager();

    const toolNameToDrawMode = {
        pen: 0, line: 1, rectangle: 2, circle: 3, arrow: 4, cone: 5, dash: 6, donut: 7, triangle: 8,
        select: 9, eraser: 10,
        squareImage: 33, circleMarkImage: 35, triangleImage: 32, plusImage: 34,
        tankImage: 28, healerImage: 29, meleeImage: 30, rangedImage: 31,
        party1Image: 36, party2Image: 37, party3Image: 38, party4Image: 39,
        party5Image: 40, party6Image: 41, party7Image: 42, party8Image: 43,
        waymarkAImage: 24, waymarkBImage: 25, waymarkCImage: 26, waymarkDImage: 27,
        waymark1Image: 20, waymark2Image: 21, waymark3Image: 22, waymark4Image: 23,
        text: 44, emoji: 12,
        stackImage: 45, spreadImage: 46, lineStackImage: 17, flareImage: 16,
        donutAoEImage: 15, circleAoEImage: 14, bossImage: 13,
        dot1Image: 50, dot2Image: 51, dot3Image: 52, dot4Image: 53,
        dot5Image: 54, dot6Image: 55, dot7Image: 56, dot8Image: 57
    };

    const app = {
        getCurrentPage: () => state.pages[state.currentPageIndex],

        onUndo: () => {
            console.log("Undo action triggered.");
        },
        onClearAll: () => {
            console.log("Clear All action triggered.");
            const page = app.getCurrentPage();
            if (page) {
                page.drawables = [];
                CanvasManager.renderPage(page);
            }
        },
        onToolSelect: (toolName) => {
            state.currentToolName = toolName;
            state.currentDrawMode = toolNameToDrawMode[toolName];
            CanvasManager.updateSelectionMode(state.currentToolName === 'select');
            UIManager.updateToolbar(state);
        },
        onCanvasMouseDown: (pointer, target) => {
            const toolDetails = UIManager.getModeDetailsByToolName(state.currentToolName);

            // Check if the selected tool is an image/icon stamp.
            if (toolDetails && toolDetails.icon) {
                CanvasManager.placeImage(pointer, toolDetails.icon, state.currentToolName, state.currentDrawMode);
                // After placing an image, automatically switch back to the select tool for good UX.
                app.onToolSelect('select');
            }
            // Otherwise, handle it as a free-draw shape.
            else if (state.currentToolName !== 'select') {
                const options = {
                    drawMode: state.currentDrawMode,
                    color: state.brushColor,
                    strokeWidth: state.brushWidth,
                    fill: state.isShapeFilled ? state.brushColor : 'transparent'
                };
                CanvasManager.startDrawing(state.currentToolName, pointer, options);
            }
        },
        onObjectAdded: (drawable, preventRerender = false) => {
            if (!drawable) return;
            app.getCurrentPage().drawables.push(drawable);
            if (!preventRerender) {
                CanvasManager.renderPage(app.getCurrentPage());
            }
        },
        onObjectModified: (drawable) => {
            console.log("Object modified:", drawable);
        },
        onObjectsDeleted: (ids) => {
            console.log("Objects deleted:", ids);
        },
        onAddPage: () => {
            const newPageName = (state.pages.length + 1).toString();
            state.pages.push({ name: newPageName, drawables: [], undoStack: [] });
            app.onPageSwitch(state.pages.length - 1);
        },
        onPageSwitch: (index) => {
            if (index >= 0 && index < state.pages.length) {
                state.currentPageIndex = index;
                CanvasManager.renderPage(app.getCurrentPage());
                UIManager.renderPageTabs(state.pages, state.currentPageIndex, app.onPageSwitch);
            }
        },
        onDeletePage: () => {
            if (state.pages.length > 1) {
                state.pages.splice(state.currentPageIndex, 1);
                const newIndex = Math.min(state.pages.length - 1, state.currentPageIndex);
                app.onPageSwitch(newIndex);
            }
        },
        onColorChange: (color) => { state.brushColor = color; UIManager.updateToolbar(state); },
        onThicknessChange: (thickness) => { state.brushWidth = thickness; UIManager.updateToolbar(state); },
        onFillToggle: () => { state.isShapeFilled = !state.isShapeFilled; UIManager.updateToolbar(state); },
        onConnect: () => {
            const passphrase = UIManager.getPassphraseInput();
            if (passphrase) {
                UIManager.updateConnectionStatus("Connecting...");
                network.connect('wss://aetherdraw-server.onrender.com/ws', passphrase);
            }
        },
        onDisconnect: () => { network.disconnect(); },
        isNetworkConnected: () => network.isConnected(),
    };

    network.onConnected = () => { UIManager.updateConnectionStatus("Connected"); UIManager.hideLiveModal(); };
    network.onDisconnected = () => { UIManager.updateConnectionStatus("Disconnected"); };
    network.onError = (err) => { UIManager.updateConnectionStatus(`Error: ${err}`); };

    const callbacks = {
        onToolSelect: app.onToolSelect,
        onUndo: app.onUndo,
        onClearAll: app.onClearAll,
        onAddPage: app.onAddPage,
        onDeletePage: app.onDeletePage,
        onPageSwitch: app.onPageSwitch,
        onColorChange: app.onColorChange,
        onThicknessChange: app.onThicknessChange,
        onFillToggle: app.onFillToggle,
        onConnect: app.onConnect,
        onDisconnect: app.onDisconnect,
        isNetworkConnected: app.isNetworkConnected,
    };

    UIManager.initialize(callbacks);
    CanvasManager.initialize({
        onObjectAdded: app.onObjectAdded,
        onObjectModified: app.onObjectModified,
        onObjectsDeleted: app.onObjectsDeleted,
        onCanvasMouseDown: app.onCanvasMouseDown,
    });

    app.onAddPage();
});