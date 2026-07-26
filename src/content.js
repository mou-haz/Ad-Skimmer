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

function loadSettings() {
    api.storage.local.get(['clickSkipInterval', 'adSkipTimeOffset', 'enableExtension', 'siteRules'], (data) => {
        settings.clickSkipInterval = data.clickSkipInterval || 500;
        settings.adSkipTimeOffset = data.adSkipTimeOffset || 0.1;
        settings.enableExtension = data.enableExtension !== false;
        settings.siteRules = data.siteRules || [];

        console.log('Settings loaded from storage:', settings);
    });
}

// Simple URL pattern matching (manifest v3 format)
function matchPattern(url, pattern) {
    if (pattern === '*://*/*') return true;

    const patternRegex = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '\\?');

    return new RegExp(`^${patternRegex}$`).test(url);
}

// Get selectors for current page
function getSelectorsForCurrentPage(currentUrl) {

    const selector = {
        adVideoSelectors: [],
        skipButtons: [],
        skipMode: 'full'
    };

    for (const rule of settings.siteRules) {
        if (!rule.enabled) continue;

        if (matchPattern(currentUrl, rule.urlPattern)) {
            console.log(`Matched rule: ${rule.name}`);

            selector.adVideoSelectors = rule.adVideoSelectors;
            selector.skipButtons = rule.skipButtons;
            selector.skipMode = rule.skipMode;


            console.log('A matching rule found for URL:', currentUrl);
            break;
        }
    }

    return selector;
}

function skipAd() {
    if (selectors.skipButtons.length === 0) {
        console.log('skipAd not sent as no skipButtons for:.', selectorUrl);
        return;
    }

    for (const selector of selectors.skipButtons) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
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
            skipAd();
        }
        else if (selectors.skipMode === 'click-only') {
            console.log(`Ad detected (mode: ${selectors.skipMode})`);
            skipAd();
        }
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
}

let selectors = getSelectorsForCurrentPage();
let selectorUrl = '';
let lastSkipTime = 0;

function checkVideos() {

    const now = Date.now();
    if (now - lastSkipTime < settings.clickSkipInterval) return;
    lastSkipTime = now;

    const currentUrl = window.location.href;
    if (currentUrl !== selectorUrl) {
        selectorUrl = currentUrl;
        selectors = getSelectorsForCurrentPage(currentUrl);
    }

    if (selectors.adVideoSelectors.length === 0) return;

    document.querySelectorAll("video").forEach(video => {
        video._adActive ||= false;
        handleVideo(video);
    });
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
        observer = new MutationObserver(checkVideos);
        observer.observe(document.documentElement, {
            subtree: true,
            attributes: true,
            childList: true
        });
        checkVideos();
    }
}

api.runtime.onMessage.addListener((msg, sender) => {
    console.log('api.runtime.onMessage Listener received:', msg);
    if (msg.action !== 'settingsUpdated') {
        return;
    }

    settings = msg.data;
    if (settings.enableExtension == (observer === null)) {
        checkMonitoring();
    }
    console.log('Settings updated from options page:', settings);
});

loadSettings();
checkMonitoring();