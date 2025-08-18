const UIManager = (function () {
    // This object maps tool names to their properties, like labels and icon paths.
    // It's a data-driven way to build the UI.
    const modeDetails = {
        select: { label: 'Select' },
        eraser: { label: 'Eraser' },
        copy: { label: 'Copy' },
        paste: { label: 'Paste' },
        undo: { label: 'Undo' },
        clearAll: { label: 'Clear All' },
        emoji: { label: 'Emoji' },
        setbg: { label: 'Set BG (URL)' },

        pen: { label: "Pen" },
        line: { label: "Line" },
        dash: { label: "Dash" },
        rectangle: { label: "Rect" },
        circle: { label: "Circle" },
        arrow: { label: "Arrow" },
        cone: { label: "Cone" },
        triangle: { label: "Triangle" },
        text: { label: "TEXT" },

        squareImage: { label: "Square", icon: "./icons/Square.png" },
        circleMarkImage: { label: "Circle", icon: "./icons/CircleMark.png" },
        triangleImage: { label: "Triangle", icon: "./icons/Triangle.png" },
        plusImage: { label: "Plus", icon: "./icons/Plus.png" },
        tankImage: { label: "Tank", icon: "./icons/Tank.jpg" },
        healerImage: { label: "Healer", icon: "./icons/Healer.jpg" },
        meleeImage: { label: "Melee", icon: "./icons/Melee.jpg" },
        rangedImage: { label: "Ranged", icon: "./icons/Ranged.jpg" },
        party1Image: { label: "P1", icon: "./icons/Party1.png" },
        party2Image: { label: "P2", icon: "./icons/Party2.png" },
        party3Image: { label: "P3", icon: "./icons/Party3.png" },
        party4Image: { label: "P4", icon: "./icons/Party4.png" },
        party5Image: { label: "P5", icon: "./icons/Party5.png" },
        party6Image: { label: "P6", icon: "./icons/Party6.png" },
        party7Image: { label: "P7", icon: "./icons/Party7.png" },
        party8Image: { label: "P8", icon: "./icons/Party8.png" },
        waymarkAImage: { label: "A", icon: "./icons/A.png" },
        waymarkBImage: { label: "B", icon: "./icons/B.png" },
        waymarkCImage: { label: "C", icon: "./icons/C.png" },
        waymarkDImage: { label: "D", icon: "./icons/D.png" },
        waymark1Image: { label: "1", icon: "./icons/1_waymark.png" },
        waymark2Image: { label: "2", icon: "./icons/2_waymark.png" },
        waymark3Image: { label: "3", icon: "./icons/3_waymark.png" },
        waymark4Image: { label: "4", icon: "./icons/4_waymark.png" },
        stackImage: { label: "Stack", icon: "./icons/stack.svg" },
        spreadImage: { label: "Spread", icon: "./icons/spread.svg" },
        lineStackImage: { label: "Line Stack", icon: "./icons/line_stack.svg" },
        flareImage: { label: "Flare", icon: "./icons/flare.svg" },
        donutAoEImage: { label: "Donut", icon: "./icons/donut.svg" },
        circleAoEImage: { label: "AoE", icon: "./icons/prox_aoe.svg" },
        bossImage: { label: "Boss", icon: "./icons/boss.svg" },
        dot1Image: { label: "Dot 1", icon: "./icons/1dot.svg" },
        dot2Image: { label: "Dot 2", icon: "./icons/2dot.svg" },
        dot3Image: { label: "Dot 3", icon: "./icons/3dot.svg" },
        dot4Image: { label: "Dot 4", icon: "./icons/4dot.svg" },
        dot5Image: { label: "Dot 5", icon: "./icons/5dot.svg" },
        dot6Image: { label: "Dot 6", icon: "./icons/6dot.svg" },
        dot7Image: { label: "Dot 7", icon: "./icons/7dot.svg" },
        dot8Image: { label: "Dot 8", icon: "./icons/8dot.svg" },
    };

    // This defines the structure and layout of the entire toolbar.
    const toolDefinitions = [
        { type: 'grid', modes: ['select', 'eraser'] },
        { type: 'grid', modes: ['copy', 'paste'] },
        { type: 'full-button', mode: 'undo' },
        { type: 'full-button', mode: 'clearAll' },
        { type: 'full-button', mode: 'emoji' },
        { type: 'full-button', mode: 'setbg' },
        { type: 'separator' },
        {
            type: 'main-grid', groups: [
                { primary: 'pen', subModes: ['pen', 'line', 'dash'], tooltip: "Drawing Tools" },
                { primary: 'rectangle', subModes: ['rectangle', 'circle', 'arrow', 'cone', 'triangle'], tooltip: "Shape Tools" },
                { primary: 'squareImage', subModes: ['squareImage', 'circleMarkImage', 'triangleImage', 'plusImage'], tooltip: "Placeable Shapes" },
                { primary: 'tankImage', subModes: ['tankImage', 'healerImage', 'meleeImage', 'rangedImage'], tooltip: "Role Icons" },
                { primary: 'party1Image', subModes: ['party1Image', 'party2Image', 'party3Image', 'party4Image', 'party5Image', 'party6Image', 'party7Image', 'party8Image'], tooltip: "Party Number Icons" },
                { primary: 'waymarkAImage', subModes: ['waymarkAImage', 'waymarkBImage', 'waymarkCImage', 'waymarkDImage'], tooltip: "Waymarks A-D" },
                { primary: 'waymark1Image', subModes: ['waymark1Image', 'waymark2Image', 'waymark3Image', 'waymark4Image'], tooltip: "Waymarks 1-4" },
                { primary: 'stackImage', subModes: ['stackImage', 'spreadImage', 'lineStackImage', 'flareImage', 'donutAoEImage', 'circleAoEImage', 'bossImage'], tooltip: "Mechanic Icons" },
                { primary: 'text', subModes: [], tooltip: "Text Tool" },
                { primary: 'dot3Image', subModes: ['dot1Image', 'dot2Image', 'dot3Image', 'dot4Image', 'dot5Image', 'dot6Image', 'dot7Image', 'dot8Image'], tooltip: "Colored Dots" },
            ]
        },
        { type: 'separator' },
        { type: 'fillToggle' },
        { type: 'separator' },
        { type: 'label', label: 'Thickness:' },
        { type: 'presets', presets: [1.5, 4, 7, 10] },
        { type: 'separator' },
        { type: 'palette' },
        { type: 'footer' }
    ];

    const colorPalette = ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#808080', '#C86400'];
    let callbacks = {};
    let activeSubModeMap = {};
    let currentOpenGroup = null;

    function createToolbar() {
        const container = document.getElementById('toolbar');
        if (!container) return;
        container.innerHTML = '';
        let gridContainer;
        const startNewGrid = () => {
            if (gridContainer) container.appendChild(gridContainer);
            gridContainer = document.createElement('div');
            gridContainer.className = 'tool-grid';
        };
        toolDefinitions.forEach(def => {
            if (def.type === 'grid') {
                if (!gridContainer) startNewGrid();
                def.modes.forEach(mode => {
                    const btn = document.createElement('button');
                    const detail = modeDetails[mode];
                    btn.textContent = detail.label;
                    btn.id = `tool-${mode}`;
                    btn.title = detail.label;
                    btn.onclick = () => callbacks.onToolSelect(mode);
                    gridContainer.appendChild(btn);
                });
            } else if (def.type === 'full-button') {
                if (gridContainer) {
                    container.appendChild(gridContainer);
                    gridContainer = null;
                }
                const btn = document.createElement('button');
                const detail = modeDetails[def.mode];
                btn.textContent = detail.label;
                btn.id = `tool-${def.mode}`;
                btn.className = 'full-width-btn';
                btn.title = detail.label;
                const cbName = `on${def.mode.charAt(0).toUpperCase() + def.mode.slice(1)}`;
                if (callbacks[cbName]) {
                    btn.onclick = () => callbacks[cbName]();
                } else {
                    btn.onclick = () => callbacks.onToolSelect(def.mode);
                }
                container.appendChild(btn);
            } else if (def.type === 'main-grid') {
                if (gridContainer && gridContainer.children.length > 0) container.appendChild(gridContainer);
                gridContainer = document.createElement('div');
                gridContainer.className = 'tool-grid';
                gridContainer.style.gridTemplateColumns = '1fr 1fr';
                def.groups.forEach(group => {
                    const btn = document.createElement('button');
                    btn.className = 'tool-group-btn';
                    btn.id = `tool-group-${group.primary}`;
                    btn.title = group.tooltip;
                    const activeModeInGroup = activeSubModeMap[group.primary] || group.primary;
                    const detail = modeDetails[activeModeInGroup];
                    if (detail && detail.icon) {
                        btn.innerHTML = `<img src="${detail.icon}" alt="${detail.label || ''}"><span>${detail.label || ''}</span>`;
                    } else if (detail) {
                        btn.innerHTML = `<span>${detail.label}</span>`;
                    }
                    btn.onclick = (event) => {
                        if (group.subModes && group.subModes.length > 0) {
                            renderToolOptions(group, event.currentTarget);
                        } else {
                            renderToolOptions(null);
                            callbacks.onToolSelect(group.primary);
                        }
                    };
                    gridContainer.appendChild(btn);
                });
                container.appendChild(gridContainer);
                gridContainer = null;
            } else {
                if (gridContainer) {
                    container.appendChild(gridContainer);
                    gridContainer = null;
                }
                let element;
                switch (def.type) {
                    case 'separator': element = document.createElement('hr'); element.className = 'separator'; break;
                    case 'fillToggle':
                        element = document.createElement('div'); element.className = 'fill-toggle';
                        element.innerHTML = `<span id="fill-span">Fill</span><span id="outline-span">Outline</span>`;
                        element.onclick = () => callbacks.onFillToggle();
                        break;
                    case 'label':
                        element = document.createElement('div'); element.className = 'label';
                        element.textContent = def.label;
                        break;
                    case 'presets':
                        element = document.createElement('div'); element.className = 'preset-grid';
                        def.presets.forEach(p => {
                            const pBtn = document.createElement('button'); pBtn.dataset.value = p; pBtn.textContent = p;
                            pBtn.onclick = () => callbacks.onThicknessChange(p); element.appendChild(pBtn);
                        });
                        break;
                    case 'palette':
                        element = document.createElement('div'); element.className = 'color-palette';
                        colorPalette.forEach(c => {
                            const cBtn = document.createElement('button'); cBtn.dataset.color = c; cBtn.style.backgroundColor = c;
                            cBtn.onclick = () => callbacks.onColorChange(c); element.appendChild(cBtn);
                        });
                        break;
                    case 'footer':
                        element = document.createElement('div'); element.className = 'footer';
                        element.innerHTML = `<a href="https://github.com/rail2025/AetherDraw/issues" target="_blank" class="button-link bug-report">Report Bug</a><a href="https://ko-fi.com/rail2025" target="_blank" class="button-link kofi">Support on Ko-Fi</a>`;
                        break;
                }
                if (element) container.appendChild(element);
            }
        });
        if (gridContainer) container.appendChild(gridContainer);
    }

    function renderToolOptions(groupDef, buttonElement) {
        const container = document.getElementById('tool-options');
        if (!groupDef || currentOpenGroup === groupDef.primary) {
            container.style.display = 'none';
            currentOpenGroup = null;
            return;
        }
        currentOpenGroup = groupDef.primary;
        container.innerHTML = '';
        const groupEl = document.createElement('div');
        groupEl.className = 'tool-options-group';
        const title = document.createElement('h4');
        title.textContent = groupDef.tooltip;
        groupEl.appendChild(title);
        groupDef.subModes.forEach(mode => {
            const btn = document.createElement('button');
            btn.id = `tool-option-${mode}`;
            const detail = modeDetails[mode];
            if (detail && detail.icon) {
                btn.innerHTML = `<img src="${detail.icon}" alt="${detail.label || ''}"><span>${detail.label || mode}</span>`;
            } else if (detail) {
                btn.innerHTML = `<span>${detail.label}</span>`;
            }
            btn.onclick = () => {
                callbacks.onToolSelect(mode);
                activeSubModeMap[groupDef.primary] = mode;
                container.style.display = 'none';
                currentOpenGroup = null;
                createToolbar();
            };
            groupEl.appendChild(btn);
        });
        container.appendChild(groupEl);
        const rect = buttonElement.getBoundingClientRect();
        container.style.top = `${rect.top}px`;
        container.style.display = 'block';
    }

    function generatePassphrase() {
        const OpinionVerbs = ["I like", "I hate", "I want", "I need", "Craving", "Seeking", "Avoiding", "Serving", "Finding", "Cooking", "Tasting", "I found", "I lost", "I traded", "He stole", "She sold", "They want", "Remembering", "Forgetting", "Questioning", "Analyzing", "Ignoring", "Praising", "Chasing", "Selling"];
        const Adjectives = ["spicy", "creamy", "sultry", "glimmering", "ancient", "crispy", "zesty", "hearty", "fluffy", "savory", "frozen", "bubbling", "forbidden", "radiant", "somber", "dented", "gilded", "rusted", "glowing", "cracked", "smelly", "aromatic", "stale", "fresh", "bitter", "sweet", "silken", "spiky"];
        const FfxivNouns = ["Miqote", "Lalafell", "Gridanian", "Ul'dahn", "Limsan", "Ishgardian", "Doman", "Hrothgar", "Viera", "Garlean", "Sharlayan", "Sylph", "Au Ra", "Roegadyn", "Elezen", "Thavnairian", "Coerthan", "Ala Mhigan", "Ronkan", "Eorzean", "Astrologian", "Machinist", "Samurai", "Dancer", "Paladin", "Warrior"];
        const FoodItems = ["rolanberry pie", "LaNoscean toast", "dodo omelette", "pixieberry tea", "king salmon", "knightly bread", "stone soup", "archon burgers", "bubble chocolate", "tuna miq", "syrcus tower", "dalamud shard", "aetheryte shard", "allagan tomestone", "company seal", "gil-turtle", "cactuar needle", "malboro breath", "behemoth horn", "mandragora root", "black truffle", "popoto", "ruby tomato", "apkallu egg", "thavnairian onion"];
        const ActionPhrases = ["in my inventory", "on the marketboard", "from a retainer", "for the Grand Company", "in a treasure chest", "from a guildhest", "at the Gold Saucer", "near the aetheryte", "without permission", "for a friend", "under the table", "with great haste", "against all odds", "for my free company", "in the goblet"];
        const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const phrase = `${getRandom(OpinionVerbs)} ${getRandom(Adjectives)} ${getRandom(FfxivNouns)} ${getRandom(FoodItems)} ${getRandom(ActionPhrases)}.`;
        const input = document.getElementById('passphrase-input');
        if (input) {
            input.value = phrase;
        }
    }

    return {
        initialize: function (appCallbacks) {
            callbacks = appCallbacks;
            toolDefinitions.filter(d => d.type === 'main-grid').flatMap(d => d.groups).forEach(g => {
                activeSubModeMap[g.primary] = g.primary;
            });
            createToolbar();
            document.getElementById('add-page-btn').addEventListener('click', callbacks.onAddPage);
            document.getElementById('copy-page-btn').addEventListener('click', callbacks.onCopyPage);
            document.getElementById('paste-page-btn').addEventListener('click', callbacks.onPastePage);
            document.getElementById('delete-page-btn').addEventListener('click', callbacks.onDeletePage);
            document.getElementById('live-btn').addEventListener('click', () => this.showLiveModal(callbacks.isNetworkConnected()));
            document.getElementById('close-modal-btn').addEventListener('click', this.hideLiveModal);
            document.getElementById('connect-btn').addEventListener('click', callbacks.onConnect);
            document.getElementById('disconnect-btn').addEventListener('click', callbacks.onDisconnect);
            document.getElementById('generate-passphrase-btn').addEventListener('click', generatePassphrase);
        },
        updateToolbar: function (state) {
            document.querySelectorAll('#toolbar button').forEach(b => b.classList.remove('active'));
            const activeTool = state.currentToolName;
            let found = false;
            toolDefinitions.filter(d => d.type === 'main-grid').flatMap(d => d.groups).forEach(g => {
                const activeModeInGroup = activeSubModeMap[g.primary];
                if (activeModeInGroup === activeTool || g.primary === activeTool || g.subModes.includes(activeTool)) {
                    const groupBtn = document.getElementById(`tool-group-${g.primary}`);
                    if (groupBtn) groupBtn.classList.add('active');
                    found = true;
                }
            });
            if (!found) {
                const topLevelButton = document.getElementById(`tool-${activeTool}`);
                if (topLevelButton) topLevelButton.classList.add('active');
            }
            document.querySelectorAll('.color-palette button').forEach(b => b.classList.toggle('active', b.dataset.color.toLowerCase() === state.brushColor.toLowerCase()));
            document.querySelectorAll('.preset-grid button').forEach(b => b.classList.toggle('active', parseFloat(b.dataset.value) === state.brushWidth));
            const fillToggle = document.querySelector('.fill-toggle');
            if (fillToggle) {
                document.getElementById('fill-span').classList.toggle('active', state.isShapeFilled);
                document.getElementById('outline-span').classList.toggle('active', !state.isShapeFilled);
            }
        },
        renderPageTabs: function (pages, currentIndex, switchCb) {
            const container = document.getElementById('page-tabs');
            container.innerHTML = '';
            pages.forEach((page, index) => {
                const tab = document.createElement('button');
                tab.textContent = page.name;
                tab.className = index === currentIndex ? 'active' : '';
                tab.onclick = () => switchCb(index);
                container.appendChild(tab);
            });
            document.getElementById('delete-page-btn').disabled = pages.length <= 1;
        },
        showLiveModal: function (isConnected) {
            document.getElementById('live-session-modal').style.display = 'flex';
            document.getElementById('connect-btn').style.display = isConnected ? 'none' : 'block';
            document.getElementById('disconnect-btn').style.display = isConnected ? 'block' : 'none';
        },
        hideLiveModal: function () {
            document.getElementById('live-session-modal').style.display = 'none';
        },
        updateConnectionStatus: function (status) {
            document.getElementById('connection-status').textContent = `Status: ${status}`;
        },
        getPassphraseInput: function () {
            return document.getElementById('passphrase-input').value;
        },
        setPasteButtonEnabled: function (enabled) {
            document.getElementById('paste-page-btn').disabled = !enabled;
        },
        getModeDetailsByToolName: function (toolName) {
            return modeDetails[toolName] || null;
        },
        // NEW: Expose all mode details for the deserializer
        getAllModeDetails: function () {
            return modeDetails;
        }
    };
})();