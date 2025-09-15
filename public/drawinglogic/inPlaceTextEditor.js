const InPlaceTextEditor = (function () {
    let isEditingInPlace = false;
    let targetTextObject = null;
    let targetKonvaShape = null;
    let originalText = "";

    // Side Panel elements
    let sidePanel = null;
    let sidePanelTextArea = null;
    let confirmButton = null;
    let fontButtons = {};

    // In-place overlay element
    let overlayTextArea = null;

    let undoManager = null;
    let pageManager = null;
    let callbacks = {};

    function _initializeDOM() {
        // Find Side Panel elements from the DOM
        sidePanel = document.getElementById('editor-side-panel');
        sidePanelTextArea = document.getElementById('side-panel-textarea');
        confirmButton = document.getElementById('confirm-text-changes-btn');
        document.querySelectorAll('.font-size-controls button').forEach(btn => {
            fontButtons[btn.dataset.size] = btn;
        });

        // Find In-Place Overlay from the DOM
        overlayTextArea = document.getElementById('inplace-text-overlay');
    }
    /*function _createDOM() {
        // Create Side Panel
        sidePanel = document.createElement('div');
        sidePanel.id = 'editor-side-panel';
        sidePanel.innerHTML = `
            <h3>Text Properties</h3>
            <div class="panel-section">
                <label>Content</label>
                <textarea id="side-panel-textarea"></textarea>
            </div>
            <div class="panel-section">
                <label>Font Size</label>
                <div class="font-size-controls">
                    <button data-size="12">S</button>
                    <button data-size="20">M</button>
                    <button data-size="32">L</button>
                    <button data-size="48">XL</button>
                </div>
            </div>
            <button id="confirm-text-changes-btn">Confirm Changes</button>
        `;
        document.body.appendChild(sidePanel);

        sidePanelTextArea = document.getElementById('side-panel-textarea');
        confirmButton = document.getElementById('confirm-text-changes-btn');
        document.querySelectorAll('.font-size-controls button').forEach(btn => {
            fontButtons[btn.dataset.size] = btn;
        });

        // Create In-Place Overlay
        overlayTextArea = document.createElement('textarea');
        overlayTextArea.id = 'inplace-text-overlay';
        document.body.appendChild(overlayTextArea);
    }*/
    
    function _commitChanges() {
        if (!targetTextObject) return;
        
        const newText = sidePanelTextArea.value;
        const textChanged = originalText !== newText;
        // Font size changes are now committed instantly, but we check text here.

        if (textChanged) {
            targetTextObject.text = newText;
            undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Edit Text");
            callbacks.onUpdateObject(targetTextObject);
        }
    }

    function _attachSidePanelListeners() {
        confirmButton.onclick = () => {
            _commitChanges();
            _hideSidePanel();
//            callbacks.onStateChanged(); // Deselect object
            callbacks.onDeselectAll();  // new callback to clear selection
        };

        sidePanelTextArea.oninput = () => {
            if (targetTextObject) {
                targetTextObject.text = sidePanelTextArea.value;
                callbacks.onStateChanged(); // Live preview on canvas
            }
        };

        Object.values(fontButtons).forEach(btn => {
            btn.onclick = () => {
                if(targetTextObject) {
                    const newSize = parseFloat(btn.dataset.size);
                    targetTextObject.fontSize = newSize;
                    undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Change Font Size");
                    callbacks.onUpdateObject(targetTextObject);
                    _updateSidePanelUI();
                }
            };
        });
    }

    function _updateSidePanelUI() {
        if (!targetTextObject) return;
        sidePanelTextArea.value = targetTextObject.text;
        Object.entries(fontButtons).forEach(([size, button]) => {
            button.classList.toggle('active', parseFloat(size) === targetTextObject.fontSize);
        });
    }

    function _hideSidePanel() {
        sidePanel.classList.remove('is-visible');
        targetTextObject = null;
    }

    // --- In-Place Editing Logic ---

    function _finalizeInPlaceEdit(commit) {
        if (!isEditingInPlace) return;
        
        if (commit) {
            const newText = overlayTextArea.value;
            if (originalText !== newText) {
                targetTextObject.text = newText;
                undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Edit Text");
                callbacks.onUpdateObject(targetTextObject);
            }
        } else {
            // Revert to original text if cancelled
            targetTextObject.text = originalText;
        }

        // make original konva text visible
        if (targetKonvaShape) {
            targetKonvaShape.visible(true);
        }

        overlayTextArea.style.display = 'none';
        isEditingInPlace = false;
        tergetKonvaShape = null;
        
        // Very important: trigger a state change to re-render the canvas
        // This will make the underlying Konva text visible again.
        callbacks.onStateChanged(); 
    }

    return {
        initialize: function (um, pm, cbs) {
            undoManager = um;
            pageManager = pm;
            callbacks = cbs;
            //_createDOM();
            _initializeDOM();
            _attachSidePanelListeners();
        },

        showSidePanel: function(drawable) {
            targetTextObject = drawable;
            originalText = drawable.text; // Store original text for undo/commit check
            _updateSidePanelUI();
            sidePanel.classList.add('is-visible');
        },

        hideSidePanel: _hideSidePanel,

        beginInPlaceEdit: function(drawable, konvaShape, stage) {
            if (isEditingInPlace) _finalizeInPlaceEdit(true);

            isEditingInPlace = true;
            targetTextObject = drawable;
            targetKonvaShape = konvaShape; //store refernce
            originalText = drawable.text;

            //hide konva text
            targetKonvaShape.visible(false);
            targetKonvaShape.getLayer().batchDraw();

            // Prepare the overlay
            overlayTextArea.value = drawable.text;
            overlayTextArea.style.display = 'block';
            
            // Style and position the overlay
            const stageBox = stage.container().getBoundingClientRect();
            const pos = konvaShape.absolutePosition();
            
            overlayTextArea.style.top = `${stageBox.top + pos.y}px`;
            overlayTextArea.style.left = `${stageBox.left + pos.x}px`;
            overlayTextArea.style.width = `${konvaShape.width()}px`;
            overlayTextArea.style.height = `${konvaShape.height()}px`;
            overlayTextArea.style.fontSize = `${konvaShape.fontSize()}px`;
            overlayTextArea.style.fontFamily = konvaShape.fontFamily();
            overlayTextArea.style.color = konvaShape.fill();
            overlayTextArea.style.lineHeight = konvaShape.lineHeight() || 1.2;
            
            overlayTextArea.focus();
            overlayTextArea.select();

            // Add blur and keydown listeners to finalize the edit
            overlayTextArea.onblur = () => _finalizeInPlaceEdit(true);
            overlayTextArea.onkeydown = (e) => {
                if (e.key === 'Escape') _finalizeInPlaceEdit(false);
                if (e.key === 'Enter' && !e.shiftKey) _finalizeInPlaceEdit(true);
            };
            
            // Trigger a re-render to hide the underlying Konva text
            callbacks.onStateChanged();
        },
        
        endInPlaceEdit: _finalizeInPlaceEdit,

        isEditing: function() { return isEditingInPlace; }
    };
})();