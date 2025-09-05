const UIManager = (function () {
    const modeDetails = {
        Select: { label: 'Select' },
        Eraser: { label: 'Eraser' },
        Copy: { label: 'Copy' },
        Paste: { label: 'Paste' },
        Undo: { label: 'Undo' },
        ClearAll: { label: 'Clear All' },
        Emoji: { label: 'Emoji' },
        SetBG: { label: 'Set BG (URL)' },

        Pen: { label: "Pen" },
        StraightLine: { label: "Line" },
        Dash: { label: "Dash" },
        Rectangle: { label: "Rect" },
        Circle: { label: "Circle" },
        Arrow: { label: "Arrow" },
        Cone: { label: "Cone" },
        Triangle: { label: "Triangle" },
        TextTool: { label: "TEXT" },

        SquareImage: { label: "Square", imageResourcePath: "./icons/Square.png", pluginResourcePath: "PluginImages.toolbar.Square.png" },
        CircleMarkImage: { label: "Circle", imageResourcePath: "./icons/CircleMark.png", pluginResourcePath: "PluginImages.toolbar.CircleMark.png" },
        TriangleImage: { label: "Triangle", imageResourcePath: "./icons/Triangle.png", pluginResourcePath: "PluginImages.toolbar.Triangle.png" },
        PlusImage: { label: "Plus", imageResourcePath: "./icons/Plus.png", pluginResourcePath: "PluginImages.toolbar.Plus.png" },
        RoleTankImage: { label: "Tank", imageResourcePath: "./icons/Tank.jpg", pluginResourcePath: "PluginImages.toolbar.Tank.JPG" },
        RoleHealerImage: { label: "Healer", imageResourcePath: "./icons/Healer.jpg", pluginResourcePath: "PluginImages.toolbar.Healer.JPG" },
        RoleMeleeImage: { label: "Melee", imageResourcePath: "./icons/Melee.jpg", pluginResourcePath: "PluginImages.toolbar.Melee.JPG" },
        RoleRangedImage: { label: "Ranged", imageResourcePath: "./icons/Ranged.jpg", pluginResourcePath: "PluginImages.toolbar.Ranged.JPG" },
        Party1Image: { label: "P1", imageResourcePath: "./icons/Party1.png", pluginResourcePath: "PluginImages.toolbar.Party1.png" },
        Party2Image: { label: "P2", imageResourcePath: "./icons/Party2.png", pluginResourcePath: "PluginImages.toolbar.Party2.png" },
        Party3Image: { label: "P3", imageResourcePath: "./icons/Party3.png", pluginResourcePath: "PluginImages.toolbar.Party3.png" },
        Party4Image: { label: "P4", imageResourcePath: "./icons/Party4.png", pluginResourcePath: "PluginImages.toolbar.Party4.png" },
        Party5Image: { label: "P5", imageResourcePath: "./icons/Party5.png", pluginResourcePath: "PluginImages.toolbar.Party5.png" },
        Party6Image: { label: "P6", imageResourcePath: "./icons/Party6.png", pluginResourcePath: "PluginImages.toolbar.Party6.png" },
        Party7Image: { label: "P7", imageResourcePath: "./icons/Party7.png", pluginResourcePath: "PluginImages.toolbar.Party7.png" },
        Party8Image: { label: "P8", imageResourcePath: "./icons/Party8.png", pluginResourcePath: "PluginImages.toolbar.Party8.png" },
        WaymarkAImage: { label: "A", imageResourcePath: "./icons/A.png", pluginResourcePath: "PluginImages.toolbar.A.png" },
        WaymarkBImage: { label: "B", imageResourcePath: "./icons/B.png", pluginResourcePath: "PluginImages.toolbar.B.png" },
        WaymarkCImage: { label: "C", imageResourcePath: "./icons/C.png", pluginResourcePath: "PluginImages.toolbar.C.png" },
        WaymarkDImage: { label: "D", imageResourcePath: "./icons/D.png", pluginResourcePath: "PluginImages.toolbar.D.png" },
        Waymark1Image: { label: "1", imageResourcePath: "./icons/1_waymark.png", pluginResourcePath: "PluginImages.toolbar.1_waymark.png" },
        Waymark2Image: { label: "2", imageResourcePath: "./icons/2_waymark.png", pluginResourcePath: "PluginImages.toolbar.2_waymark.png" },
        Waymark3Image: { label: "3", imageResourcePath: "./icons/3_waymark.png", pluginResourcePath: "PluginImages.toolbar.3_waymark.png" },
        Waymark4Image: { label: "4", imageResourcePath: "./icons/4_waymark.png", pluginResourcePath: "PluginImages.toolbar.4_waymark.png" },
        StackImage: { label: "Stack", imageResourcePath: "./icons/stack.svg", pluginResourcePath: "PluginImages.svg.stack.svg" },
        SpreadImage: { label: "Spread", imageResourcePath: "./icons/spread.svg", pluginResourcePath: "PluginImages.svg.spread.svg" },
        LineStackImage: { label: "Line Stack", imageResourcePath: "./icons/line_stack.svg", pluginResourcePath: "PluginImages.svg.line_stack.svg" },
        FlareImage: { label: "Flare", imageResourcePath: "./icons/flare.svg", pluginResourcePath: "PluginImages.svg.flare.svg" },
        DonutAoEImage: { label: "Donut", imageResourcePath: "./icons/donut.svg", pluginResourcePath: "PluginImages.svg.donut.svg" },
        CircleAoEImage: { label: "AoE", imageResourcePath: "./icons/prox_aoe.svg", pluginResourcePath: "PluginImages.svg.prox_aoe.svg" },
        BossImage: { label: "Boss", imageResourcePath: "./icons/boss.svg", pluginResourcePath: "PluginImages.svg.boss.svg" },
        Dot1Image: { label: "Dot 1", imageResourcePath: "./icons/1dot.svg", pluginResourcePath: "PluginImages.svg.1dot.svg" },
        Dot2Image: { label: "Dot 2", imageResourcePath: "./icons/2dot.svg", pluginResourcePath: "PluginImages.svg.2dot.svg" },
        Dot3Image: { label: "Dot 3", imageResourcePath: "./icons/3dot.svg", pluginResourcePath: "PluginImages.svg.3dot.svg" },
        Dot4Image: { label: "Dot 4", imageResourcePath: "./icons/4dot.svg", pluginResourcePath: "PluginImages.svg.4dot.svg" },
        Dot5Image: { label: "Dot 5", imageResourcePath: "./icons/5dot.svg", pluginResourcePath: "PluginImages.svg.5dot.svg" },
        Dot6Image: { label: "Dot 6", imageResourcePath: "./icons/6dot.svg", pluginResourcePath: "PluginImages.svg.6dot.svg" },
        Dot7Image: { label: "Dot 7", imageResourcePath: "./icons/7dot.svg", pluginResourcePath: "PluginImages.svg.7dot.svg" },
        Dot8Image: { label: "Dot 8", imageResourcePath: "./icons/8dot.svg", pluginResourcePath: "PluginImages.svg.8dot.svg" },
    };

    const toolDefinitions = [
        { type: 'grid', modes: ['Select', 'Eraser'] },
        { type: 'grid', modes: ['Copy', 'Paste'] },
        { type: 'full-button', mode: 'Undo' },
        { type: 'full-button', mode: 'ClearAll' },
        { type: 'full-button', mode: 'Emoji' },
        { type: 'full-button', mode: 'SetBG' },
        { type: 'separator' },
        {
            type: 'main-grid', groups: [
                { primary: 'Pen', subModes: ['Pen', 'StraightLine', 'Dash'], tooltip: "Drawing Tools" },
                { primary: 'Rectangle', subModes: ['Rectangle', 'Circle', 'Arrow', 'Cone', 'Triangle'], tooltip: "Shape Tools" },
                { primary: 'SquareImage', subModes: ['SquareImage', 'CircleMarkImage', 'TriangleImage', 'PlusImage'], tooltip: "Placeable Shapes" },
                { primary: 'RoleTankImage', subModes: ['RoleTankImage', 'RoleHealerImage', 'RoleMeleeImage', 'RoleRangedImage'], tooltip: "Role Icons" },
                { primary: 'Party1Image', subModes: ['Party1Image', 'Party2Image', 'Party3Image', 'Party4Image', 'Party5Image', 'Party6Image', 'Party7Image', 'Party8Image'], tooltip: "Party Number Icons" },
                { primary: 'WaymarkAImage', subModes: ['WaymarkAImage', 'WaymarkBImage', 'WaymarkCImage', 'WaymarkDImage'], tooltip: "Waymarks A-D" },
                { primary: 'Waymark1Image', subModes: ['Waymark1Image', 'Waymark2Image', 'Waymark3Image', 'Waymark4Image'], tooltip: "Waymarks 1-4" },
                { primary: 'StackImage', subModes: ['StackImage', 'SpreadImage', 'LineStackImage', 'FlareImage', 'DonutAoEImage', 'CircleAoEImage', 'BossImage'], tooltip: "Mechanic Icons" },
                { primary: 'TextTool', subModes: [], tooltip: "Text Tool" },
                { primary: 'Dot3Image', subModes: ['Dot1Image', 'Dot2Image', 'Dot3Image', 'Dot4Image', 'Dot5Image', 'Dot6Image', 'Dot7Image', 'Dot8Image'], tooltip: "Colored Dots" },
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
    let pluginPathToWebPath = {};

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
                    btn.onclick = () => {
                        console.log(`[ui.js] Grid button clicked. Mode: ${mode}`);
                        callbacks.onToolSelect(mode);
                    }
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
                const cbName = `on${def.mode}`;
                if (callbacks[cbName]) {
                    btn.onclick = () => callbacks[cbName]();
                } else {
                    btn.onclick = () => {
                        console.log(`[ui.js] Full-width button clicked. Mode: ${def.mode}`);
                        callbacks.onToolSelect(def.mode);
                    };
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
                    if (detail && detail.imageResourcePath) {
                        btn.innerHTML = `<img src="${detail.imageResourcePath}" alt="${detail.label || ''}"><span>${detail.label || ''}</span>`;
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
            if (detail && detail.imageResourcePath) {
                btn.innerHTML = `<img src="${detail.imageResourcePath}" alt="${detail.label || ''}"><span>${detail.label || mode}</span>`;
            } else if (detail) {
                btn.innerHTML = `<span>${detail.label}</span>`;
            }
            btn.onclick = () => {
                console.log(`[ui.js] Sub-mode button clicked. Mode: ${mode}`);
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
            Object.keys(modeDetails).forEach(key => {
                const detail = modeDetails[key];
                if (detail.pluginResourcePath && detail.imageResourcePath) {
                    pluginPathToWebPath[detail.pluginResourcePath] = detail.imageResourcePath;
                }
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
        getWebPathFromPluginPath: function (pluginPath) {
            return pluginPathToWebPath[pluginPath] || pluginPath;
        }
    };
})();