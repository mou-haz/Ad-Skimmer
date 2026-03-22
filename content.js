let settings = {
    clickSkipInterval: 500,
    adSkipTimeOffset: 0.1,
    enableExtension: true,
    siteRules: []
};

function loadSettings() {
    chrome.storage.local.get(['clickSkipInterval', 'adSkipTimeOffset', 'enableExtension', 'siteRules'], (data) => {
        settings.clickSkipInterval = data.clickSkipInterval || 500;
        settings.adSkipTimeOffset = data.adSkipTimeOffset || 0.1;
        settings.enableExtension = data.enableExtension !== false;
        settings.siteRules = data.siteRules || [];
        
        console.log('Settings loaded from storage:', settings);
        
        startMonitoring();
    });
}

// Load settings on initialization
loadSettings();

// Listen for settings updates from options page
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'settingsUpdated') {
        settings = msg.data;
        console.log('Settings updated from options page:', settings);
    }
    
    // Handle fallback click for Firefox
    if (msg.action === 'clickAtCoords') {
        const { x, y } = msg.coords;
        try {
            const element = document.elementFromPoint(x, y);
            if (element && element.offsetParent !== null) {
                const events = [
                    new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
                    new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
                    new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
                ];
                
                events.forEach(e => element.dispatchEvent(e));
                console.log('Element clicked via events');
            }
        } catch (e) {
            console.warn('Click fallback failed:', e);
        }
    }
});

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
function getSelectorsForCurrentPage() {
    const currentUrl = window.location.href;
    
    for (const rule of settings.siteRules) {
        if (!rule.enabled) continue;
        
        if (matchPattern(currentUrl, rule.urlPattern)) {
            console.log(`Matched rule: ${rule.name}`);
            return {
                adVideoSelectors: rule.adVideoSelectors || [],
                skipButtons: rule.skipButtons || [],
                skipMode: rule.skipMode || 'full'
            };
        }
    }
    
    console.log('No matching site rule found for URL:', currentUrl);
    return {
        adVideoSelectors: [],
        skipButtons: [],
        skipMode: 'full'
    };
}

function skipAd() {
    if (selectors.skipButtons.length === 0) return;
    
    for (const selector of selectors.skipButtons) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
            const rect = button.getBoundingClientRect();
            chrome.runtime.sendMessage({
                action: 'skipAd',
                coords: { 
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                }
            });
            console.log('skipAd sent.');
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
        try {
            return video.matches(sel);
        } catch {
            return false;
        }
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
        
        video._pbRate = undefined;
        console.log("Ad ended");
    }
}

let selectors = getSelectorsForCurrentPage();
let lastSkipTime = 0;

function checkVideos() {
    if (!settings.enableExtension) return;
    
    const now = Date.now();
    if (now - lastSkipTime < settings.clickSkipInterval) return;
    lastSkipTime = now;

    selectors = getSelectorsForCurrentPage();
    
    if (selectors.adVideoSelectors.length === 0) return;

    const videos = document.querySelectorAll("video");

    videos.forEach(video => {
        video._adActive ||= false;
        
        handleVideo(video);
    });
}

function startMonitoring() {
    const observer = new MutationObserver(checkVideos);
    observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        childList: true
    });
    checkVideos();
}