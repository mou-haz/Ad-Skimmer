const api = chrome;

let settings = {
    clickSkipInterval: 500,
    adSkipTimeOffset: 0.1,
    enableExtension: true,
    siteRules: []
};

function handleSkipButton(button) {
    const rect = button.getBoundingClientRect();
    const message = {
        action: 'skipAd',
        coords: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        }
    };

    try {
        if (api.runtime?.id) {
            api.runtime.sendMessage(message);
            console.warn('Messsage sent:', message);
        }
        else {
            console.warn('Messsage NOT sent:', message);
        }
    } catch (e) {
        console.warn('Messsage NOT sent with error:', e);
    }
    console.log('skipAd sent to background (Chrome)');
}

async function loadSettings() {
    return new Promise((resolve) => {
        api.storage.local.get(
            ['clickSkipInterval', 'adSkipTimeOffset', 'enableExtension', 'siteRules'],
            (data) => {
                settings.clickSkipInterval = data.clickSkipInterval || 500;
                settings.adSkipTimeOffset = data.adSkipTimeOffset || 0.1;
                settings.enableExtension = data.enableExtension !== false;
                settings.siteRules = data.siteRules || [];

                console.log('Settings loaded from storage:', settings);

                resolve();
            }
        );
    });
}

// Simple URL pattern matching (manifest v3 format)
function matchPattern(url, pattern) {
    if (pattern === '*://*/*' || pattern === '*') return true;

    const patternRegex = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '\\?');

    return new RegExp(`^${patternRegex}$`).test(url);
}

// Get selectors for current page
function getSelectorsForCurrentPage(currentUrl) {

    const selector = {
        adVideoSelectors: new Set(),
        skipButtons: new Set(),
        skipMode: null
    };

    for (const rule of settings.siteRules) {
        if (!rule.enabled) continue;
        if (!matchPattern(currentUrl, rule.urlPattern)) continue;

        console.log(`✅ Matched rule: ${rule.name || rule.urlPattern}`);

        (rule.adVideoSelectors || []).forEach(s => selector.adVideoSelectors.add(s));
        (rule.skipButtons || []).forEach(s => selector.skipButtons.add({ rule: s, videoDependent: rule.skipMode === 'full' }));

        if (selector.skipMode === null || rule.skipMode === 'full') {
            selector.skipMode = rule.skipMode;
        }
    }

    return {
        adVideoSelectors: Array.from(selector.adVideoSelectors),
        skipButtons: Array.from(selector.skipButtons),
        skipMode: selector.skipMode
    };
}

function trySkipButtons(skipButtons) {
    if (skipButtons.length === 0) {
        console.log('trySkipButtons not sent as no skipButtons for:.', selectorUrl);
        return;
    }

    for (const selector of skipButtons) {
        const button = document.querySelector(selector.rule);
        if (button && button.offsetParent !== null) {
            console.log('button found for selector:', selector.rule);
            console.log('URL:', selectorUrl);
            handleSkipButton(button);
            break;
        }
    }
}

function shouldSkim(video) {
    if (!video || !video.duration) return false;
    if (!video._adActive || video.playbackRate != 16) return true;
    if (!isFinite(video.duration)) return false;

    return video.currentTime < video.duration - settings.adSkipTimeOffset;
}

function handleVideo(video) {

    const isAd = selectors.adVideoSelectors.some(sel => {
        try { return video.matches(sel); } catch { return false; }
    });

    if (isAd) {
        // Full mode: speed up + click button
        if (selectors.skipMode === 'full') {
            if (shouldSkim(video)) {
                video._adActive = true;
                video.muted = true;
                video._pbRate = video.playbackRate;
                video.playbackRate = 16;
                video.currentTime = video.duration - settings.adSkipTimeOffset;
                console.log(`Ad detected (mode: ${selectors.skipMode})`);
            }
        }
        else if (selectors.skipMode === 'click-only') {
            console.log(`Ad detected (mode: ${selectors.skipMode})`);
        }

        trySkipButtons(selectors.skipButtons);
        return true;
    } else {
        video.muted = false;

        if (!video._adActive) return;

        video._adActive = false;

        if (selectors.skipMode === 'full') {
            video.playbackRate = video._pbRate || 1;
        }

        video._pbRate = null;
        console.log("Ad ended");
    }

    return false;
}

let selectors = '';
let selectorUrl = '';
let lastSkipTime = 0;

function checkPage() {

    const now = Date.now();
    if (now - lastSkipTime < settings.clickSkipInterval) return;
    lastSkipTime = now;

    const currentUrl = window.location.href;
    if (currentUrl !== selectorUrl) {
        selectorUrl = currentUrl;
        selectors = getSelectorsForCurrentPage(currentUrl);
    }

    if (!checkVideos()) {
        trySkipButtons(selectors.skipButtons.filter(rule => !rule.videoDependent));
    }
}

function checkVideos() {

    if (selectors.adVideoSelectors.length === 0) return false;

    let found = false;

    document.querySelectorAll("video").forEach(video => {
        video._adActive ||= false;
        if (!found) {
            found = handleVideo(video) || found;
        }
    });

    return found;
}

let observer = null;

function checkMonitoring() {
    if (!settings.enableExtension) {
        if (observer instanceof MutationObserver) {
            observer.disconnect();
            observer = null;
        }
    }
    else {
        selectorUrl = '';
        observer = new MutationObserver(checkPage);
        observer.observe(document.documentElement, {
            subtree: true,
            attributes: true,
            childList: true
        });
        checkPage();
    }
}

api.runtime.onMessage.addListener(function (msg, sender) {
    console.log('api.runtime.onMessage Listener received:', msg);
    if (msg.action !== 'settingsUpdated') {
        return;
    }

    settings.enableExtension = msg.data.enableExtension;
    settings.adSkipTimeOffset = msg.data.adSkipTimeOffset;
    settings.clickSkipInterval = msg.data.clickSkipInterval;
    settings.siteRules = msg.data.siteRules;

    if (settings.enableExtension == (observer === null)) {
        checkMonitoring();
    }
    console.log('Settings updated from options page:', settings);
});

async function init() {
    await loadSettings();
    checkMonitoring();
}

init();