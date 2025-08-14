document.addEventListener('DOMContentLoaded', () => {

    const state = {
        pages: [],
        currentPageIndex: 0,
        pageClipboard: null,
        currentToolName: 'select',
        currentDrawMode: 9, // DrawMode.Select
        brushColor: '#FFFFFF',
        brushWidth: 4,
        isShapeFilled: false,
    };

    const network = new NetworkManager();
    const MAX_UNDO_LEVELS = 30;

    let throttleTimeout = null;
    const THROTTLE_MS = 50; // Throttle updates to every 50ms

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
        recordUndoState: () => {
            const page = app.getCurrentPage();
            if (!page) return;
            if (page.undoStack.length >= MAX_UNDO_LEVELS) page.undoStack.shift();
            page.undoStack.push(JSON.parse(JSON.stringify(page.drawables)));
        },
        onUndo: () => {
            const page = app.getCurrentPage();
            if (!page || page.undoStack.length === 0) return;

            const prevState = page.undoStack.pop();
            page.drawables = JSON.parse(JSON.stringify(prevState));
            CanvasManager.renderPage(page);

            if (network.isConnected()) {
                const payloadData = serializePageToBytes(prevState);
                network.sendStateUpdate({
                    pageIndex: state.currentPageIndex,
                    action: PayloadActionType.ReplacePage,
                    data: payloadData
                });
            }
        },
        onClearAll: () => {
            const page = app.getCurrentPage();
            if (!page || page.drawables.length === 0) return;

            app.recordUndoState();
            page.drawables = [];
            CanvasManager.renderPage(page);

            if (network.isConnected()) {
                network.sendStateUpdate({
                    pageIndex: state.currentPageIndex,
                    action: PayloadActionType.ClearPage,
                    data: null
                });
            }
        },
        onToolSelect: (toolName) => {
            state.currentToolName = toolName;
            state.currentDrawMode = toolNameToDrawMode[toolName];
            CanvasManager.updateSelectionMode(state.currentToolName === 'select');
            UIManager.updateToolbar(state);
        },
        onCanvasMouseDown: (pointer) => {
            if (state.currentToolName !== 'select') {
                CanvasManager.startDrawing(
                    state.currentToolName,
                    state.currentDrawMode,
                    pointer,
                    state.brushColor,
                    state.brushWidth,
                    state.isShapeFilled
                );
            }
        },
        onObjectAdded: (drawable) => {
            if (!drawable) return;
            app.recordUndoState();
            app.getCurrentPage().drawables.push(drawable);
            if (network.isConnected()) {
                const payloadData = serializePageToBytes([drawable]);
                network.sendStateUpdate({ pageIndex: state.currentPageIndex, action: PayloadActionType.AddObjects, data: payloadData });
            }
            CanvasManager.renderPage(app.getCurrentPage());
        },
        onObjectTransforming: (drawable) => {
            if (!drawable || !network.isConnected()) return;
            if (throttleTimeout) return;

            throttleTimeout = setTimeout(() => {
                const payloadData = serializePageToBytes([drawable]);
                network.sendStateUpdate({
                    pageIndex: state.currentPageIndex,
                    action: PayloadActionType.UpdateObjects,
                    data: payloadData
                });
                throttleTimeout = null;
            }, THROTTLE_MS);
        },
        onObjectModified: (drawable) => {
            if (!drawable) return;

            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
                throttleTimeout = null;
            }

            app.recordUndoState();
            const page = app.getCurrentPage();
            const index = page.drawables.findIndex(d => d.uniqueId === drawable.uniqueId);
            if (index !== -1) page.drawables[index] = drawable;

            if (network.isConnected()) {
                const payloadData = serializePageToBytes([drawable]);
                network.sendStateUpdate({ pageIndex: state.currentPageIndex, action: PayloadActionType.UpdateObjects, data: payloadData });
            }
            CanvasManager.renderPage(app.getCurrentPage());
        },
        onObjectsDeleted: (ids) => {
            if (ids.length === 0) return;
            app.recordUndoState();
            const page = app.getCurrentPage();
            page.drawables = page.drawables.filter(d => !ids.includes(d.uniqueId));
            if (network.isConnected()) {
                const writer = new BufferHandler();
                writer.writeInt32(ids.length);
                ids.forEach(id => writer.writeGuid(id));
                network.sendStateUpdate({ pageIndex: state.currentPageIndex, action: PayloadActionType.DeleteObjects, data: writer.getBuffer() });
            }
            CanvasManager.renderPage(page);
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
        onObjectTransforming: app.onObjectTransforming, // Pass the new callback
        onObjectModified: app.onObjectModified,
        onObjectsDeleted: app.onObjectsDeleted,
        onCanvasMouseDown: app.onCanvasMouseDown,
    });

    app.onAddPage();
});