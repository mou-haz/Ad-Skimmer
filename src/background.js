const attachedTabs = new Set();

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.action !== 'skipAd') return;
    if (!sender.tab) return;

    const tabId = sender.tab.id;
    const { x, y } = msg.coords;

    handleChromeSkip(tabId, x, y);
});

async function handleChromeSkip(tabId, x, y) {
    try {
        if (!attachedTabs.has(tabId)) {
            await chrome.debugger.attach({ tabId }, '1.3');
            attachedTabs.add(tabId);
            console.log('Debugger attached for tab:', tabId);
        }

        //(trusted click)
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

        console.log('Ad skipped successfully (trusted click)');
    } 
    catch (e) {
        console.warn('Failed to skip ad:', e);
    }
    finally{
        if (attachedTabs.has(tabId)) {
            chrome.debugger.detach({ tabId }).catch((e) => {
                console.warn('Failed to detach:', e);
            });
            attachedTabs.delete(tabId);
            console.log('Debugger detached for tab:', tabId);
        }
    }
}