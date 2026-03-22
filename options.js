// Default site rules configuration - stored in settings
const DEFAULT_RULES = [
    {
        name: "YouTube",
        enabled: true,
        urlPattern: "*://*.youtube.com/*",
        adVideoSelectors: [
            ".html5-video-player.ad-showing video"
        ],
        skipButtons: [
            ".ytp-ad-skip-button-modern",
            ".ytp-skip-ad-button",
            "button[aria-label^='Skip ad']"
        ],
        skipMode: "full"
    },
    {
        name: "Shahid (MBC)",
        enabled: true,
        urlPattern: "*://shahid.mbc.net/*",
        adVideoSelectors: [
            ".bitmovinplayer-ima-container[style*='display: block'] video[title='Advertisement']"
        ],
        skipButtons: [
            ".bmp-skip-ad-button",
            "button[aria-label*='Skip']"
        ],
        skipMode: "full"
    }
];

// Initialize options page
document.addEventListener('DOMContentLoaded', loadOptions);

// Event listeners
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

// Dropdown functionality
document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = toggle.closest('.dropdown');
        
        // Close other dropdowns
        document.querySelectorAll('.dropdown.active').forEach(d => {
            if (d !== dropdown) d.classList.remove('active');
        });
        
        dropdown.classList.toggle('active');
    });
});

// Close dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown.active').forEach(d => {
        d.classList.remove('active');
    });
});

// Close dropdown when item is clicked
document.querySelectorAll('.dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
        item.closest('.dropdown').classList.remove('active');
    });
});

// Load options from storage
async function loadOptions() {
    try {
        const data = await getFromStorage(['clickSkipInterval', 'adSkipTimeOffset', 'enableExtension', 'siteRules']);

        console.log('Loaded from storage:', data);

        document.getElementById('clickSkipInterval').value = data.clickSkipInterval || 500;
        document.getElementById('adSkipTimeOffset').value = data.adSkipTimeOffset || 0.1;
        document.getElementById('enableExtension').checked = data.enableExtension !== false;
        
        updateIntervalDisplay();
        updateOffsetDisplay();
        
        // Use stored rules or defaults
        const rulesToUse = (data.siteRules && data.siteRules.length > 0) ? data.siteRules : DEFAULT_RULES;
        
        // If using defaults, save them to storage
        if (!data.siteRules || data.siteRules.length === 0) {
            await saveToStorage({
                siteRules: DEFAULT_RULES
            });
        }
        
        renderSiteRules(rulesToUse);
    } catch (error) {
        console.error('Error loading options:', error);
        renderSiteRules(DEFAULT_RULES);
        showStatus('Error loading settings', 'error');
    }
}

// Helper: Get from storage with proper callback handling
function getFromStorage(keys) {
    return new Promise((resolve) => {
        const defaults = {};
        keys.forEach(key => {
            defaults[key] = null;
        });
        
        chrome.storage.local.get(defaults, (result) => {
            console.log('Retrieved from storage:', result);
            resolve(result);
        });
    });
}

// Helper: Save to storage with proper callback handling
function saveToStorage(data) {
    return new Promise((resolve) => {
        chrome.storage.local.set(data, () => {
            console.log('Successfully saved to storage:', data);
            resolve();
        });
    });
}

// Update interval display
function updateIntervalDisplay() {
    const value = document.getElementById('clickSkipInterval').value;
    document.getElementById('clickSkipIntervalDisplay').textContent = `${value}ms`;
}

// Update offset display
function updateOffsetDisplay() {
    const value = document.getElementById('adSkipTimeOffset').value;
    document.getElementById('adSkipTimeOffsetDisplay').textContent = `${value}s`;
}

// Render site rules
function renderSiteRules(rules) {
    const container = document.getElementById('siteRulesList');
    container.innerHTML = '';

    if (!rules || rules.length === 0) {
        container.innerHTML = '<p style="color: var(--text-tertiary); text-align: center; padding: 20px;">No site rules configured. Add one to get started.</p>';
        return;
    }

    rules.forEach((rule, index) => {
        const ruleEl = createRuleElement(rule, index);
        container.appendChild(ruleEl);
    });
}

// Create a single rule element
function createRuleElement(rule, index) {
    const div = document.createElement('div');
    div.className = 'site-rule';
    div.innerHTML = `
        <div class="site-rule-header">
            <span class="site-rule-title">${escapeHtml(rule.name)}</span>
            <div class="site-rule-toggle">
                <span>${rule.enabled ? 'Enabled' : 'Disabled'}</span>
                <div class="toggle-switch ${rule.enabled ? 'active' : ''}" data-index="${index}"></div>
                <button class="remove-rule-btn" data-index="${index}">Remove</button>
            </div>
        </div>
        <div class="site-rule-fields">
            <div class="site-rule-field">
                <label>Rule Name</label>
                <input type="text" class="rule-name" value="${escapeHtml(rule.name)}" data-index="${index}">
            </div>
            <div class="site-rule-field">
                <label>URL Pattern (manifest v3 format)</label>
                <input type="text" class="rule-url-pattern" value="${escapeHtml(rule.urlPattern)}" data-index="${index}">
                <span class="selector-hint">Example: *://*.example.com/* or https://example.com/*</span>
            </div>
            <div class="site-rule-field">
                <label>Skip Mode</label>
                <select class="rule-skip-mode" data-index="${index}">
                    <option value="full" ${rule.skipMode === 'full' ? 'selected' : ''}>Full (Speed up + Click button)</option>
                    <option value="click-only" ${rule.skipMode === 'click-only' ? 'selected' : ''}>Click Only (Just click skip button)</option>
                </select>
                <span class="selector-hint">Full mode speeds up video and clicks. Click-only mode just clicks the button.</span>
            </div>
            <div class="site-rule-field">
                <label>Ad Video Selectors (one per line)</label>
                <textarea class="rule-ad-selectors" data-index="${index}">${escapeHtml(rule.adVideoSelectors.join('\n'))}</textarea>
                <span class="selector-hint">CSS selectors to identify ad videos</span>
            </div>
            <div class="site-rule-field">
                <label>Skip Button Selectors (one per line)</label>
                <textarea class="rule-skip-buttons" data-index="${index}">${escapeHtml(rule.skipButtons.join('\n'))}</textarea>
                <span class="selector-hint">CSS selectors to find skip ad buttons</span>
            </div>
            <div class="site-rule-actions">
                <button class="btn btn-small btn-secondary" data-index="${index}" onclick="exportSingleRule(${index})">Export</button>
                <button class="btn btn-small btn-secondary" data-index="${index}" onclick="copySingleRuleToClipboard(${index})">Copy</button>
            </div>
        </div>
    `;

    // Event listeners for this rule
    const toggle = div.querySelector('.toggle-switch');
    toggle.addEventListener('click', () => toggleRule(index));

    div.querySelector('.remove-rule-btn').addEventListener('click', () => removeRule(index));

    div.querySelectorAll('input, textarea, select').forEach(el => {
        el.addEventListener('change', saveOptions);
    });

    return div;
}

// Toggle rule enabled/disabled
function toggleRule(index) {
    const toggle = document.querySelector(`.toggle-switch[data-index="${index}"]`);
    toggle.classList.toggle('active');
    saveOptions();
}

// Remove a rule
function removeRule(index) {
    const rules = getRulesFromUI();
    if (confirm(`Remove "${rules[index].name}" rule?`)) {
        rules.splice(index, 1);
        renderSiteRules(rules);
        saveOptions();
    }
}

// Add new rule
function addNewRule() {
    const rules = getRulesFromUI();
    const newRule = {
        name: `Custom Rule ${rules.length + 1}`,
        enabled: true,
        urlPattern: "*://*.example.com/*",
        adVideoSelectors: ["video[data-ad='true']"],
        skipButtons: ["button.skip-ad"],
        skipMode: "full"
    };
    rules.push(newRule);
    renderSiteRules(rules);
    document.getElementById('siteRulesList').scrollTop = document.getElementById('siteRulesList').scrollHeight;
}

// Get all rules from UI
function getRulesFromUI() {
    const rules = [];
    document.querySelectorAll('.site-rule').forEach((el, index) => {
        const toggle = el.querySelector('.toggle-switch');
        const adSelectors = el.querySelector('.rule-ad-selectors').value
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        const skipSelectors = el.querySelector('.rule-skip-buttons').value
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        
        rules.push({
            name: el.querySelector('.rule-name').value || `Rule ${index + 1}`,
            enabled: toggle.classList.contains('active'),
            urlPattern: el.querySelector('.rule-url-pattern').value,
            adVideoSelectors: adSelectors,
            skipButtons: skipSelectors,
            skipMode: el.querySelector('.rule-skip-mode').value || 'full'
        });
    });
    return rules;
}

// Validate rule structure
function validateRule(rule) {
    return (
        rule.name && typeof rule.name === 'string' &&
        rule.urlPattern && typeof rule.urlPattern === 'string' &&
        Array.isArray(rule.adVideoSelectors) &&
        Array.isArray(rule.skipButtons) &&
        (rule.skipMode === 'full' || rule.skipMode === 'click-only')
    );
}

// Export all rules as JSON file
function exportRules() {
    const rules = getRulesFromUI();
    const dataStr = JSON.stringify(rules, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ad-skimmer-rules-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus('Rules exported!', 'success');
}

// Export single rule as JSON file
function exportSingleRule(index) {
    const rules = getRulesFromUI();
    const rule = rules[index];
    const dataStr = JSON.stringify([rule], null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${rule.name.replace(/\s+/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showStatus(`"${rule.name}" exported!`, 'success');
}

// Export all rules to clipboard
async function exportToClipboard() {
    try {
        const rules = getRulesFromUI();
        const dataStr = JSON.stringify(rules, null, 2);
        await navigator.clipboard.writeText(dataStr);
        showStatus('Rules copied to clipboard!', 'success');
    } catch (error) {
        console.error('Clipboard error:', error);
        showStatus('Error copying to clipboard', 'error');
    }
}

// Copy single rule to clipboard
async function copySingleRuleToClipboard(index) {
    try {
        const rules = getRulesFromUI();
        const rule = rules[index];
        const dataStr = JSON.stringify([rule], null, 2);
        await navigator.clipboard.writeText(dataStr);
        showStatus(`"${rule.name}" copied to clipboard!`, 'success');
    } catch (error) {
        console.error('Clipboard error:', error);
        showStatus('Error copying to clipboard', 'error');
    }
}

// Import rules from JSON file
function importRules(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            const importedRules = Array.isArray(importedData) ? importedData : [importedData];
            
            // Validate each rule
            const validRules = importedRules.filter((rule, idx) => {
                if (!validateRule(rule)) {
                    console.warn(`Rule ${idx} is invalid:`, rule);
                    return false;
                }
                return true;
            });

            if (validRules.length === 0) {
                throw new Error('No valid rules found in the file');
            }

            const currentRules = getRulesFromUI();
            const mergedRules = [...currentRules, ...validRules];

            renderSiteRules(mergedRules);
            showStatus(`Imported ${validRules.length} rule(s)!`, 'success');
            
            // Auto-save
            saveOptions();
        } catch (error) {
            console.error('Import error:', error);
            showStatus(`Error importing rules: ${error.message}`, 'error');
        }
    };
    reader.readAsText(file);

    // Reset file input
    event.target.value = '';
}

// Import rules from clipboard
async function importFromClipboard() {
    try {
        const clipboardText = await navigator.clipboard.readText();
        const importedData = JSON.parse(clipboardText);
        const importedRules = Array.isArray(importedData) ? importedData : [importedData];
        
        // Validate each rule
        const validRules = importedRules.filter((rule, idx) => {
            if (!validateRule(rule)) {
                console.warn(`Rule ${idx} is invalid:`, rule);
                return false;
            }
            return true;
        });

        if (validRules.length === 0) {
            throw new Error('No valid rules found in clipboard');
        }

        const currentRules = getRulesFromUI();
        const mergedRules = [...currentRules, ...validRules];

        renderSiteRules(mergedRules);
        showStatus(`Imported ${validRules.length} rule(s) from clipboard!`, 'success');
        
        // Auto-save
        saveOptions();
    } catch (error) {
        console.error('Clipboard import error:', error);
        if (error.message.includes('Unexpected token')) {
            showStatus('Error: Clipboard does not contain valid JSON', 'error');
        } else if (error.message.includes('NotAllowedError')) {
            showStatus('Error: Permission to read clipboard denied', 'error');
        } else {
            showStatus(`Error: ${error.message}`, 'error');
        }
    }
}

// Save all options
async function saveOptions() {
    try {
        const clickSkipInterval = parseInt(document.getElementById('clickSkipInterval').value) || 500;
        const adSkipTimeOffset = parseFloat(document.getElementById('adSkipTimeOffset').value) || 0.1;
        const enableExtension = document.getElementById('enableExtension').checked;
        const siteRules = getRulesFromUI();

        const dataToSave = {
            clickSkipInterval,
            adSkipTimeOffset,
            enableExtension,
            siteRules
        };

        console.log('Saving options:', dataToSave);

        await saveToStorage(dataToSave);
        
        showStatus('Settings saved!', 'success');
        
        // Notify content scripts of changes
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'settingsUpdated',
                    data: dataToSave
                }).catch(() => {}); // Ignore tabs where content script isn't loaded
            });
        });
    } catch (error) {
        console.error('Error saving options:', error);
        showStatus('Error saving settings!', 'error');
    }
}

// Reset to defaults
async function resetOptions() {
    if (confirm('Reset all settings to defaults?')) {
        try {
            await saveToStorage({
                clickSkipInterval: 500,
                adSkipTimeOffset: 0.1,
                enableExtension: true,
                siteRules: DEFAULT_RULES
            });
            await loadOptions();
            showStatus('Reset to defaults!', 'success');
        } catch (error) {
            console.error('Error resetting:', error);
            showStatus('Error resetting settings!', 'error');
        }
    }
}

// Reset to defaults (button in Site Rules)
async function resetToDefaults() {
    if (confirm('Reset site rules to defaults?')) {
        try {
            renderSiteRules(DEFAULT_RULES);
            await saveToStorage({ siteRules: DEFAULT_RULES });
            showStatus('Site rules reset to defaults!', 'success');
        } catch (error) {
            console.error('Error resetting site rules:', error);
            showStatus('Error resetting site rules!', 'error');
        }
    }
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.className = 'status-message';
    }, 3000);
}

// Utility: escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}