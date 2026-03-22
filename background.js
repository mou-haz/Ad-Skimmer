const isMozilla = typeof browser !== 'undefined';
const extensionAPI = isMozilla ? browser : chrome;

const attachedTabs = new Set();

extensionAPI.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg.action !== 'skipAd') return;
    if (!sender.tab) return;

    const tabId = sender.tab.id;
    const { x, y } = msg.coords;

    try {
        if (!isMozilla && typeof chrome.debugger !== 'undefined') {
            if (!attachedTabs.has(tabId)) {
                await chrome.debugger.attach({ tabId }, '1.3');
                attachedTabs.add(tabId);
                console.log('Debugger attached for tab', tabId);
            }

            await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
                type: 'mousePressed',
                x, y,
                button: 'left',
                clickCount: 1
            });
            await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
                type: 'mouseReleased',
                x, y,
                button: 'left',
                clickCount: 1
            });
            console.log('Ad skipped (trusted click)');
        } else {
            // Fallback for Firefox - send message to content script to click
            await extensionAPI.tabs.sendMessage(tabId, {
                action: 'clickAtCoords',
                coords: { x, y }
            });
            console.log('Ad skip triggered (simulated click)');
        }
    } catch (e) {
        console.warn('Skip failed:', e);
    } finally {
        if (!isMozilla && typeof chrome.debugger !== 'undefined') {
            try { 
                await chrome.debugger.detach({ tabId }); 
            } catch {}
        }
    }
});

extensionAPI.tabs.onRemoved.addListener(tabId => {
    if (attachedTabs.has(tabId)) {
        if (!isMozilla && typeof chrome.debugger !== 'undefined') {
            chrome.debugger.detach({ tabId }).catch(() => {});
        }
        attachedTabs.delete(tabId);
    }
});