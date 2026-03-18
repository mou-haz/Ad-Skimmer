chrome.runtime.onMessage.addListener(async (msg, sender) => {
    if (msg.action !== 'skipAd') return;
    if (!sender.tab) return;

    const tabId = sender.tab.id;
    const { x, y } = msg.coords;

    try {
        await chrome.debugger.attach({ tabId }, '1.3');
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
    } catch (e) {
        console.warn('Skip failed:', e);
    } finally {
        try { await chrome.debugger.detach({ tabId }); } catch {}
    }
});