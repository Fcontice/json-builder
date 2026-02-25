document.addEventListener('DOMContentLoaded', () => {

    let flatRecordsCache = [];
    let canvasSchemaCache = [];
    let rawJsonInput = null;

    const elInput = document.getElementById('json-input');
    const elInputPreviewContainer = document.getElementById('json-input-preview-container');
    const elInputPreviewCode = document.getElementById('json-input-preview');
    const elBtnEditInput = document.getElementById('btn-edit-input');
    const elBtnParse = document.getElementById('btn-parse');
    const elParseError = document.getElementById('parse-error');

    const elCanvasRoot = document.getElementById('canvas-root');
    const elTrashZone = document.getElementById('trash-zone');
    const elBtnClear = document.getElementById('btn-clear-canvas');
    const elBtnAddObject = document.getElementById('btn-add-object');

    const elOutput = document.getElementById('json-preview');
    const elBtnConvert = document.getElementById('btn-convert');
    const elBtnDownload = document.getElementById('btn-download');

    let previewTimer = null;

    // --- Phase 4: Universal Recursive Flattening ---
    // Converts any nested JSON arrays/objects into 1D flat rows
    function flattenJSON(input) {
        const results = [];
        const currentContext = {};

        function recurse(current, path) {
            if (Array.isArray(current)) {
                if (current.length === 0) {
                    results.push({ ...currentContext });
                } else {
                    for (let i = 0; i < current.length; i++) {
                        recurse(current[i], path);
                    }
                }
            } else if (current !== null && typeof current === 'object') {
                const keys = Object.keys(current);
                if (keys.length === 0) {
                    results.push({ ...currentContext });
                } else {
                    const addedPaths = [];
                    let hasComplex = false;

                    // Pass 1: Primitives
                    for (let i = 0; i < keys.length; i++) {
                        const key = keys[i];
                        const val = current[key];
                        if (val === null || typeof val !== 'object') {
                            const newPath = path ? `${path}.${key}` : key;
                            currentContext[newPath] = val;
                            addedPaths.push(newPath);
                        } else {
                            hasComplex = true;
                        }
                    }

                    if (!hasComplex) {
                        results.push({ ...currentContext });
                    } else {
                        // Pass 2: Objects / Arrays
                        let didRecurse = false;
                        for (let i = 0; i < keys.length; i++) {
                            const key = keys[i];
                            const val = current[key];
                            if (val !== null && typeof val === 'object') {
                                const newPath = path ? `${path}.${key}` : key;
                                recurse(val, newPath);
                                didRecurse = true;
                            }
                        }

                        if (!didRecurse) results.push({ ...currentContext });
                    }

                    // Backtrack to avoid allocating intermediate contexts per level
                    for (let i = 0; i < addedPaths.length; i++) {
                        delete currentContext[addedPaths[i]];
                    }
                }
            } else {
                // Primitive at root (edge case)
                const safePath = path || 'value';
                currentContext[safePath] = current;
                results.push({ ...currentContext });
                delete currentContext[safePath];
            }
        }

        recurse(input, "");
        return results;
    }

    // --- Phase 1: Parsing and Tokens ---
    elBtnParse.addEventListener('click', () => {
        const raw = elInput.value.trim();
        if (!raw) {
            showError('Please paste some JSON data first.');
            return;
        }
        try {
            rawJsonInput = JSON.parse(raw);
            elParseError.classList.add('hidden');
        } catch (e) {
            showError('Invalid JSON format: ' + e.message);
            return;
        }

        flatRecordsCache = flattenJSON(rawJsonInput);

        // Auto populate canvas with original JSON schema shape
        elCanvasRoot.innerHTML = '';
        autoPopulateCanvas(rawJsonInput, elCanvasRoot, "");
        initializeSortableTree(elCanvasRoot);

        // Show the beautiful input preview
        elInput.classList.add('hidden');
        elInputPreviewContainer.classList.remove('hidden');
        elInputPreviewCode.textContent = JSON.stringify(rawJsonInput, null, 2);
        delete elInputPreviewCode.dataset.highlighted;
        if (window.hljs) hljs.highlightElement(elInputPreviewCode);

        // Populate sample text in textarea if it's too big, just memory mgmt
        // But UI should feel nice. Let's just trigger update.
        triggerSchemaUpdate();
    });

    elBtnEditInput.addEventListener('click', () => {
        elInputPreviewContainer.classList.add('hidden');
        elInput.classList.remove('hidden');
        elInput.focus();
    });

    function showError(msg) {
        elParseError.textContent = msg;
        elParseError.classList.remove('hidden');
        setTimeout(() => elParseError.classList.add('hidden'), 5000);
    }

    function autoPopulateCanvas(jsonItem, containerElement, currentPath) {
        if (jsonItem === null || typeof jsonItem !== 'object') return;

        if (Array.isArray(jsonItem)) {
            if (jsonItem.length > 0) autoPopulateCanvas(jsonItem[0], containerElement, currentPath);
            return;
        }

        const keys = Object.keys(jsonItem);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const val = jsonItem[key];
            const newPath = currentPath ? `${currentPath}.${key}` : key;

            let mode = 'field';
            if (val !== null && typeof val === 'object') {
                mode = 'object';
            }

            const token = createTokenElement(key, newPath, mode);
            containerElement.appendChild(token);

            if (mode === 'object') {
                const subContainer = token.querySelector(':scope > .children-container');
                autoPopulateCanvas(val, subContainer, newPath);
            }
        }
    }

    function createTokenElement(key, path, initialMode) {
        const token = document.createElement('div');
        token.className = `token ${initialMode === 'field' ? 'is-field' : ''}`;
        token.dataset.key = key;
        token.dataset.path = path;

        const header = document.createElement('div');
        header.className = 'token-header';

        const handle = document.createElement('span');
        handle.className = 'drag-handle';
        handle.innerHTML = '⋮⋮';

        const label = document.createElement('span');
        label.className = 'key-name';
        label.textContent = key;
        label.contentEditable = "true";
        label.spellcheck = false;
        label.style.outline = "none";
        label.addEventListener('focus', () => { label.style.borderBottom = "1px dashed var(--accent)"; });
        label.addEventListener('blur', () => {
            label.style.borderBottom = "none";
            token.dataset.key = label.textContent.trim() || 'unnamed';
            triggerSchemaUpdate();
        });
        label.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
        });

        const btnMode = document.createElement('button');
        btnMode.className = `mode-btn mode-${initialMode}`;
        btnMode.dataset.mode = initialMode;
        btnMode.textContent = initialMode.charAt(0).toUpperCase() + initialMode.slice(1);

        // Cycle through modes: Field -> Group -> Object -> Field
        btnMode.addEventListener('click', (e) => {
            e.stopPropagation();
            let nMode = btnMode.dataset.mode;

            if (nMode === 'field') nMode = 'group';
            else if (nMode === 'group') nMode = 'object';
            else nMode = 'field';

            btnMode.dataset.mode = nMode;
            btnMode.className = `mode-btn mode-${nMode}`;
            btnMode.textContent = nMode.charAt(0).toUpperCase() + nMode.slice(1);

            if (nMode === 'field') token.classList.add('is-field');
            else token.classList.remove('is-field');

            triggerSchemaUpdate();
        });

        header.appendChild(handle);
        header.appendChild(label);
        header.appendChild(btnMode);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container';

        token.appendChild(header);
        token.appendChild(childrenContainer);
        return token;
    }

    // --- Phase 2: Drag and Drop Setup ---

    // UI Effects for Trash highlight
    const globalSortableOptions = {
        onStart: function () {
            elTrashZone.classList.add('highlight');
        },
        onEnd: function () {
            elTrashZone.classList.remove('highlight');
        }
    };

    function handleSortableAdd(evt) {
        const item = evt.item;

        // Magically upgrade Field -> Object if dropped into it
        const targetContainer = evt.to;
        const parentToken = targetContainer.closest('.token');
        if (parentToken) {
            const btnMode = parentToken.querySelector('.mode-btn');
            if (btnMode && btnMode.dataset.mode === 'field') {
                btnMode.dataset.mode = 'object';
                btnMode.className = 'mode-btn mode-object';
                btnMode.textContent = 'Object';
                parentToken.classList.remove('is-field');
            }
        }

        // Initialize sortable for ourselves just in case it doesn't have it
        const myContainer = item.querySelector(':scope > .children-container');
        if (myContainer && !myContainer.dataset.sortableInitialized) {
            myContainer.dataset.sortableInitialized = 'true';
            new Sortable(myContainer, {
                group: 'schema',
                animation: 150,
                fallbackOnBody: true,
                swapThreshold: 0.65,
                onAdd: handleSortableAdd,
                onUpdate: triggerSchemaUpdate,
                onRemove: triggerSchemaUpdate,
                ...globalSortableOptions
            });
        }

        triggerSchemaUpdate();
    }

    // Root Canvas initialized once
    function initializeSortableTree(rootDOM) {
        const containers = rootDOM.querySelectorAll('.children-container');

        // Init root
        if (!rootDOM.dataset.sortableInitialized) {
            rootDOM.dataset.sortableInitialized = 'true';
            new Sortable(rootDOM, {
                group: 'schema',
                animation: 150,
                fallbackOnBody: true,
                swapThreshold: 0.65,
                onAdd: handleSortableAdd,
                onUpdate: triggerSchemaUpdate,
                onRemove: triggerSchemaUpdate,
                ...globalSortableOptions
            });
        }

        // Init all nested deeply
        for (let i = 0; i < containers.length; i++) {
            const container = containers[i];
            if (!container.dataset.sortableInitialized) {
                container.dataset.sortableInitialized = 'true';
                new Sortable(container, {
                    group: 'schema',
                    animation: 150,
                    fallbackOnBody: true,
                    swapThreshold: 0.65,
                    onAdd: handleSortableAdd,
                    onUpdate: triggerSchemaUpdate,
                    onRemove: triggerSchemaUpdate,
                    ...globalSortableOptions
                });
            }
        }
    }

    // Trash Zone: destroy dropped elements
    new Sortable(elTrashZone, {
        group: 'schema',
        onAdd: function (evt) {
            evt.item.remove();
            triggerSchemaUpdate();
        }
    });

    elBtnAddObject.addEventListener('click', () => {
        const token = createTokenElement('new_object', '', 'object');
        elCanvasRoot.appendChild(token);

        const container = token.querySelector(':scope > .children-container');
        if (container) {
            container.dataset.sortableInitialized = 'true';
            new Sortable(container, {
                group: 'schema',
                animation: 150,
                fallbackOnBody: true,
                swapThreshold: 0.65,
                onAdd: triggerSchemaUpdate,
                onUpdate: triggerSchemaUpdate,
                onRemove: triggerSchemaUpdate,
                ...globalSortableOptions
            });
        }
        triggerSchemaUpdate();
    });

    elBtnClear.addEventListener('click', () => {
        elCanvasRoot.innerHTML = '';
        triggerSchemaUpdate();
    });

    // Parse the visual tree into a logical ruleset (schema)
    function triggerSchemaUpdate() {
        canvasSchemaCache = parseDomSchema(elCanvasRoot);
        if (canvasSchemaCache.length > 0 && flatRecordsCache.length > 0) {
            elBtnConvert.disabled = false;
        } else {
            elBtnConvert.disabled = true;
            elBtnDownload.disabled = true;
        }
    }

    function parseDomSchema(containerElement) {
        const schema = [];
        const tokens = containerElement.querySelectorAll(':scope > .token');
        for (const t of tokens) {
            const key = t.dataset.key;
            const path = t.dataset.path;
            const mode = t.querySelector('.mode-btn').dataset.mode;

            const subContainer = t.querySelector(':scope > .children-container');
            const childrenSchema = subContainer ? parseDomSchema(subContainer) : [];

            schema.push({
                key: key,
                path: path,
                mode: mode,
                children: mode !== 'field' ? childrenSchema : [] // fields ignore children
            });
        }
        return schema; // Preserves nested visual order
    }

    // --- Phase 5: Generic Recursion Alg ---
    // Pure function entirely decoupled from UI
    function restructureRecords(records, schemaNodes) {
        if (!schemaNodes || schemaNodes.length === 0) return records;

        const groupNodes = [];
        for (let i = 0; i < schemaNodes.length; i++) {
            if (schemaNodes[i].mode === 'group') groupNodes.push(schemaNodes[i]);
        }

        if (groupNodes.length > 0) {
            const groupNode = groupNodes[0];

            // Map O(1) group partitioning
            const grouped = new Map();
            for (let i = 0; i < records.length; i++) {
                const record = records[i];
                const val = record[groupNode.path]; // use universal path
                const groupValStr = String(val !== undefined && val !== null ? val : 'null');

                let group = grouped.get(groupValStr);
                if (!group) {
                    group = [];
                    grouped.set(groupValStr, group);
                }
                group.push(record);
            }

            const result = {};
            for (const [key, groupRecs] of grouped.entries()) {
                result[key] = restructureRecords(groupRecs, groupNode.children);
            }
            return result;
        } else {
            // No grouping at this layer -> Maps into array of objects using remaining Fields/Objects
            const numRecords = records.length;
            const result = new Array(numRecords);

            for (let i = 0; i < numRecords; i++) {
                result[i] = buildLeafObject(records[i], schemaNodes);
            }
            return result;
        }
    }

    function buildLeafObject(record, nodes) {
        const obj = {};
        for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            if (n.mode === 'field') {
                obj[n.key] = record[n.path];
            } else if (n.mode === 'object' || n.mode === 'group') {
                // Treats inner groups as nested objects if evaluating mapping
                obj[n.key] = buildLeafObject(record, n.children);
            }
        }
        return obj;
    }

    // --- Phase 3 & 6: Convert Preview & DL ---
    let activeOutputJsonStr = "";

    elBtnConvert.addEventListener('click', () => {
        updatePreview();
    });

    function updatePreview() {
        if (!flatRecordsCache || flatRecordsCache.length === 0) {
            renderOutputText("No data parsed or empty input.");
            elBtnDownload.disabled = true;
            return;
        }

        if (canvasSchemaCache.length === 0) {
            renderOutputText("Drag keys onto the canvas to define structure...\n\nUse \"Group\" to map items into objects by this key.\nUse \"Field\" to pick specific properties for the arrays.");
            elBtnDownload.disabled = true;
            return;
        }

        try {
            const transformed = restructureRecords(flatRecordsCache, canvasSchemaCache);
            activeOutputJsonStr = JSON.stringify(transformed, null, 2);
            renderOutputText(activeOutputJsonStr);
            elBtnDownload.disabled = false;
        } catch (e) {
            renderOutputText("Error transforming data: " + e.message);
            elBtnDownload.disabled = true;
        }
    }

    function renderOutputText(text) {
        elOutput.textContent = text;
        delete elOutput.dataset.highlighted;
        if (window.hljs) hljs.highlightElement(elOutput);
    }

    // Initial paint
    if (window.hljs) hljs.highlightElement(elOutput);

    elBtnDownload.addEventListener('click', () => {
        if (!activeOutputJsonStr) return;
        const blob = new Blob([activeOutputJsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'restructured_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

});
