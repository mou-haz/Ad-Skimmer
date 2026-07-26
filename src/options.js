const api = chrome;
// Default site rules
const DEFAULT_RULES = [
    {
        name: "YouTube",
        enabled: true,
        urlPattern: "*://*.youtube.com/*",
        adVideoSelectors: [".html5-video-player.ad-showing video:not(ytd-video-masthead-ad-primary-video-renderer *)"],
        skipButtons: [".ytp-ad-skip-button-modern", ".ytp-skip-ad-button", "button[aria-label^='Skip ad']"],
        skipMode: "full"
    },
    {
        name: "Shahid (MBC)",
        enabled: true,
        urlPattern: "*://shahid.mbc.net/*",
        adVideoSelectors: [".bitmovinplayer-ima-container[style*='display: block'] video[title='Advertisement']"],
        skipButtons: [".bmp-skip-ad-button", "button[aria-label*='Skip']"],
        skipMode: "full"
    }
];

document.addEventListener('DOMContentLoaded', initOptions);

async function initOptions() {
    setupEventListeners();
    await loadOptions();
}

function setupEventListeners() {
    document.getElementById('saveBtn').addEventListener('click', saveOptions);
    document.getElementById('resetBtn').addEventListener('click', resetOptions);
    document.getElementById('addSiteBtn').addEventListener('click', addNewRule);
    document.getElementById('exportRulesBtn').addEventListener('click', exportRules);
    document.getElementById('exportClipboardBtn').addEventListener('click', exportToClipboard);
    document.getElementById('importRulesBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importClipboardBtn').addEventListener('click', importFromClipboard);
    document.getElementById('importFile').addEventListener('change', importRules);
    document.getElementById('resetDefaultsBtn').addEventListener('click', resetToDefaults);
    document.getElementById('clickSkipInterval').addEventListener('input', updateIntervalDisplay);
    document.getElementById('adSkipTimeOffset').addEventListener('input', updateOffsetDisplay);

    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = toggle.closest('.dropdown');
            // Close other dropdowns
            document.querySelectorAll('.dropdown.active').forEach(d => {
                if (d !== dropdown) d.classList.remove('active');
            });
            // Toggle this dropdown
            dropdown.classList.toggle('active');
        });
    });

    // Close dropdown when an item is clicked
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const dropdown = item.closest('.dropdown');
            if (dropdown) dropdown.classList.remove('active');
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[c]);
}

async function loadOptions() {
    const { clickSkipInterval, adSkipTimeOffset, enableExtension, siteRules } = await getFromStorage([
        'clickSkipInterval', 'adSkipTimeOffset', 'enableExtension', 'siteRules'
    ]);

    document.getElementById('clickSkipInterval').value = clickSkipInterval ?? 500;
    document.getElementById('adSkipTimeOffset').value = adSkipTimeOffset ?? 0.1;
    document.getElementById('enableExtension').checked = enableExtension ?? true;

    updateIntervalDisplay();
    updateOffsetDisplay();

    const rules = siteRules?.length ? siteRules : DEFAULT_RULES;
    if (!siteRules || !siteRules.length) {
        await resetToDefaults(true);
    }
    else {
        renderSiteRules(rules);
    }
}

function getFromStorage(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function saveToStorage(data) {
    return new Promise(resolve => {
        chrome.storage.local.set(data, resolve);
        api.runtime.sendMessage({ action: "settingsUpdated", data: data });
    });
}

function updateIntervalDisplay() {
    document.getElementById('clickSkipIntervalDisplay').textContent =
        document.getElementById('clickSkipInterval').value + 'ms';
}

function updateOffsetDisplay() {
    document.getElementById('adSkipTimeOffsetDisplay').textContent =
        document.getElementById('adSkipTimeOffset').value + 's';
}

// ------------------------
// Site Rules Rendering
// ------------------------
function renderSiteRules(rules) {
    const container = document.getElementById('siteRulesList');
    container.innerHTML = '';
    if (!rules.length) {
        const p = document.createElement('p');
        p.textContent = "No site rules configured. Add one to get started.";
        p.style.color = "var(--text-tertiary)";
        p.style.textAlign = "center";
        p.style.padding = "20px";
        container.appendChild(p);
        return;
    }

    rules.forEach((rule, index) => container.appendChild(buildRuleElement(rule, index)));
}

function buildRuleElement(rule, index) {
    const div = document.createElement('div');
    div.className = 'site-rule';

    // Header
    const header = document.createElement('div');
    header.className = 'site-rule-header';

    const title = document.createElement('span');
    title.className = 'site-rule-title';
    title.textContent = rule.name;

    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'site-rule-toggle';

    const statusText = document.createElement('span');
    statusText.textContent = rule.enabled ? 'Enabled' : 'Disabled';

    const toggle = document.createElement('div');
    toggle.className = 'toggle-switch' + (rule.enabled ? ' active' : '');
    toggle.dataset.index = index;
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        saveOptions();
        statusText.textContent = toggle.classList.contains('active') ? 'Enabled' : 'Disabled';
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-rule-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        if (confirm(`Remove "${rule.name}"?`)) {
            const allRules = getRulesFromUI();
            allRules.splice(index, 1);
            renderSiteRules(allRules);
            saveOptions();
        }
    });

    toggleContainer.append(statusText, toggle, removeBtn);
    header.append(title, toggleContainer);

    // Fields
    const fields = document.createElement('div');
    fields.className = 'site-rule-fields';

    function addField(labelText, type, value, className) {
        const field = document.createElement('div');
        field.className = 'site-rule-field';
        const label = document.createElement('label');
        label.textContent = labelText;
        let input;
        if (type === 'textarea') {
            input = document.createElement('textarea');
            input.value = value;
        } else if (type === 'select') {
            input = document.createElement('select');
            ['full', 'click-only'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt === 'full' ? 'Full (Speed up + Click button)' : 'Click Only (Just click skip button)';
                if (opt === value) o.selected = true;
                input.appendChild(o);
            });
        } else {
            input = document.createElement('input');
            input.type = type;
            input.value = value;
        }
        input.className = className;
        input.dataset.index = index;
        input.addEventListener('change', saveOptions);
        field.append(label, input);
        fields.appendChild(field);
    }

    addField('Rule Name', 'text', rule.name, 'rule-name');
    addField('URL Pattern', 'text', rule.urlPattern, 'rule-url-pattern');
    addField('Skip Mode', 'select', rule.skipMode, 'rule-skip-mode');
    addField('Ad Video Selectors', 'textarea', rule.adVideoSelectors.join('\n'), 'rule-ad-selectors');
    addField('Skip Button Selectors', 'textarea', rule.skipButtons.join('\n'), 'rule-skip-buttons');

    // Actions
    const actions = document.createElement('div');
    actions.className = 'site-rule-actions';
    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export';
    exportBtn.className = 'btn btn-small btn-secondary';
    exportBtn.addEventListener('click', () => exportSingleRule(index));

    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'btn btn-small btn-secondary';
    copyBtn.addEventListener('click', () => copySingleRuleToClipboard(index));

    actions.append(exportBtn, copyBtn);
    fields.appendChild(actions);

    div.append(header, fields);
    return div;
}

function getRulesFromUI() {
    const rules = [];
    document.querySelectorAll('.site-rule').forEach((el) => {
        const toggle = el.querySelector('.toggle-switch');
        const adSelectors = el.querySelector('.rule-ad-selectors').value.split('\n').map(s => s.trim()).filter(Boolean);
        const skipSelectors = el.querySelector('.rule-skip-buttons').value.split('\n').map(s => s.trim()).filter(Boolean);
        rules.push({
            name: el.querySelector('.rule-name').value,
            enabled: toggle.classList.contains('active'),
            urlPattern: el.querySelector('.rule-url-pattern').value,
            adVideoSelectors: adSelectors,
            skipButtons: skipSelectors,
            skipMode: el.querySelector('.rule-skip-mode').value
        });
    });
    return rules;
}

// ------------------------
// Save / Reset / Add
// ------------------------
async function saveOptions() {
    const clickSkipInterval = parseInt(document.getElementById('clickSkipInterval').value) || 500;
    const adSkipTimeOffset = parseFloat(document.getElementById('adSkipTimeOffset').value) || 0.1;
    const enableExtension = document.getElementById('enableExtension').checked;
    const siteRules = getRulesFromUI();

    await saveToStorage({ clickSkipInterval, adSkipTimeOffset, enableExtension, siteRules });
    showStatus('Settings saved!', 'success');
}

async function resetOptions() {
    if (confirm('Reset all settings to defaults?')) {
        await saveToStorage({ clickSkipInterval: 500, adSkipTimeOffset: 0.1, enableExtension: true, siteRules: DEFAULT_RULES });
        await loadOptions();
        showStatus('Reset to defaults!', 'success');
    }
}

function resetToDefaults(confirmed = false) {
    if (confirmed || confirm('Reset site rules to defaults?')) {
        saveToStorage({ siteRules: DEFAULT_RULES });
        renderSiteRules(DEFAULT_RULES);
        showStatus('Site rules reset to defaults!', 'success');
    }
}

function addNewRule() {
    const rules = getRulesFromUI();
    rules.push({
        name: `Custom Rule ${rules.length + 1}`,
        enabled: true,
        urlPattern: "*://*.example.com/*",
        adVideoSelectors: ["video[data-ad='true']"],
        skipButtons: ["button.skip-ad"],
        skipMode: "full"
    });
    renderSiteRules(rules);
}

// ------------------------
// Status display
// ------------------------
function showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = `status-message ${type}`;
    setTimeout(() => { el.textContent = ''; el.className = 'status-message'; }, 3000);
}

// ------------------------
// Export / Import
// ------------------------
function exportRules() {
    const blob = new Blob([JSON.stringify(getRulesFromUI(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ad-skimmer-rules-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus('Rules exported!', 'success');
}

function exportSingleRule(index) {
    const rule = getRulesFromUI()[index];
    const blob = new Blob([JSON.stringify([rule], null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${rule.name.replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus(`"${rule.name}" exported!`, 'success');
}

async function exportToClipboard() {
    try {
        await navigator.clipboard.writeText(JSON.stringify(getRulesFromUI(), null, 2));
        showStatus('Rules copied to clipboard!', 'success');
    } catch (e) { showStatus('Error copying to clipboard', 'error'); }
}

async function copySingleRuleToClipboard(index) {
    try {
        await navigator.clipboard.writeText(JSON.stringify([getRulesFromUI()[index]], null, 2));
        showStatus('Rule copied!', 'success');
    } catch (e) { showStatus('Error copying to clipboard', 'error'); }
}

function importRules(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        try {
            const data = JSON.parse(evt.target.result);
            const rules = Array.isArray(data) ? data : [data];
            const valid = rules.filter(validateRule);
            if (!valid.length) throw new Error("No valid rules");
            const merged = [...getRulesFromUI(), ...valid];
            renderSiteRules(merged); saveOptions();
            showStatus(`Imported ${valid.length} rule(s)!`, 'success');
        } catch (err) { showStatus(err.message, 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
}

async function importFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        const data = JSON.parse(text);
        const rules = Array.isArray(data) ? data : [data];
        const valid = rules.filter(validateRule);
        if (!valid.length) throw new Error("No valid rules in clipboard");
        const merged = [...getRulesFromUI(), ...valid];
        renderSiteRules(merged); saveOptions();
        showStatus(`Imported ${valid.length} rule(s) from clipboard!`, 'success');
    } catch (err) { showStatus(err.message, 'error'); }
}

function validateRule(rule) {
    return rule.name && rule.urlPattern && Array.isArray(rule.adVideoSelectors) && Array.isArray(rule.skipButtons) && ['full', 'click-only'].includes(rule.skipMode);
}