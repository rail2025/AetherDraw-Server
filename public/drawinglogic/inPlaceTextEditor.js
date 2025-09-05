const InPlaceTextEditor = (function () {
    let isEditing = false;
    let targetTextObject = null;
    let targetKonvaShape = null;
    let originalText = "";
    let originalFontSize = 0;
    
    let editorDiv = null;
    let textArea = null;
    let okButton = null;
    let cancelButton = null;

    let undoManager = null;
    let pageManager = null;
    let callbacks = {};

    function _createEditorDOM() {
        if (editorDiv) return;

        editorDiv = document.createElement('div');
        editorDiv.className = 'aether-text-editor';

        const fontControls = document.createElement('div');
        const fontSizes = [{ label: "S", size: 12 }, { label: "M", size: 20 }, { label: "L", size: 32 }, { label: "XL", size: 48 }];
        fontSizes.forEach(f => {
            const btn = document.createElement('button');
            btn.textContent = f.label;
            btn.onclick = () => {
                if (targetTextObject) {
                    targetTextObject.fontSize = f.size;
                    callbacks.onStateChanged();
                }
            };
            fontControls.appendChild(btn);
        });

        textArea = document.createElement('textarea');

        const buttonControls = document.createElement('div');
        buttonControls.className = 'editor-buttons';
        okButton = document.createElement('button');
        okButton.textContent = "OK";
        cancelButton = document.createElement('button');
        cancelButton.textContent = "Cancel";
        buttonControls.appendChild(okButton);
        buttonControls.appendChild(cancelButton);

        editorDiv.appendChild(fontControls);
        editorDiv.appendChild(textArea);
        editorDiv.appendChild(buttonControls);

        document.body.appendChild(editorDiv);
    }

    function _commitAndEndEdit() {
        if (!isEditing || !targetTextObject) return;
        
        const textChanged = originalText !== textArea.value;
        const fontChanged = Math.abs(originalFontSize - targetTextObject.fontSize) > 0.01;

        targetTextObject.text = textArea.value;

        if (textChanged || fontChanged) {
            undoManager.recordAction(pageManager.getCurrentPageDrawables(), "Edit Text");
            callbacks.onUpdateObject(targetTextObject);
        }
        
        _cleanUpEditSession();
    }

    function _cancelAndEndEdit() {
        if (!isEditing || !targetTextObject) return;
        
        targetTextObject.text = originalText;
        targetTextObject.fontSize = originalFontSize;

        _cleanUpEditSession();
    }

    function _handleKeyDown(e) {
        if (e.key === 'Escape') {
            _cancelAndEndEdit();
        }
    }

    function _cleanUpEditSession() {
        isEditing = false;
        editorDiv.style.display = 'none';

        okButton.onclick = null;
        cancelButton.onclick = null;
        window.removeEventListener('keydown', _handleKeyDown);
        
        callbacks.onStateChanged();
        
        targetTextObject = null;
        targetKonvaShape = null;
    }

    return {
        initialize: function (um, pm, cbs) {
            undoManager = um;
            pageManager = pm;
            callbacks = cbs;
            _createEditorDOM();
        },

        beginEdit: function (textData, textShape, stage) {
            if (!textData || !textShape) return;

            isEditing = true;
            targetTextObject = textData;
            targetKonvaShape = textShape;
            originalText = textData.text;
            originalFontSize = textData.fontSize;

            textArea.value = textData.text;

            const pos = textShape.absolutePosition();
            const stageBox = stage.container().getBoundingClientRect();
            editorDiv.style.top = `${stageBox.top + pos.y}px`;
            editorDiv.style.left = `${stageBox.left + pos.x}px`;
            editorDiv.style.display = 'flex';

            okButton.onclick = _commitAndEndEdit;
            cancelButton.onclick = _cancelAndEndEdit;
            window.addEventListener('keydown', _handleKeyDown);

            textArea.focus();
            textArea.select();
        },

        isCurrentlyEditing: function (drawable) {
            return isEditing && targetTextObject && targetTextObject.uniqueId === drawable.uniqueId;
        },

        isEditing: function() {
            return isEditing;
        }
    };
})();