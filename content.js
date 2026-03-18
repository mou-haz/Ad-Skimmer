function setLowestYouTubeQuality() {
    try {
        const player = document.querySelector(".html5-video-player");
        if (!player) return;

        if (player.getAvailableQualityLevels) {
            const levels = player.getAvailableQualityLevels();
            if (levels && levels.length) {
                player.setPlaybackQuality(levels[levels.length - 1]);
            }
        }
    } catch(e){}
}

function isAdSkimmed(video) {
    return video._adActive && video.playbackRate == 16;
}

let lastSkipTime = 0;
const clickSkipInterval = 250;// in ms.
const skipButtons = [
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        'button[aria-label^="Skip ad"]'
    ];

function skipAd() {
    const now = Date.now();
    if (now - lastSkipTime < clickSkipInterval) return;
    lastSkipTime = now;

    for (const selector of skipButtons) {
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
            break; // only send one button
        }
    }
}

const adVideoSelectors = [
    '.bitmovinplayer-ima-container[style*="display: block"] video[title="Advertisement"]',
    '.html5-video-player.ad-showing video'
    ];

function checkVideos() {

    const videos = document.querySelectorAll("video");

    videos.forEach(video => {
	
    	video._adActive ||= false;
        const isAdVideo = adVideoSelectors.some(sel => {
            try {
                return video.matches(sel);
            } catch {
                return false;
            }
        });

        if (isAdVideo) {

            if (!isAdSkimmed(video)) {
                
                video._adActive = true;
                video.muted = true;
                video._pbRate = video.playbackRate;
                video.playbackRate = 16;
                video.currentTime = video.duration - 0.1;

                //setLowestYouTubeQuality();
                console.log("Ad detected");
            }

            skipAd();

        } else {

            video.muted = false;
            if (video._adActive) {

                video._adActive = false;
                video.playbackRate = video._pbRate;

                console.log("Ad ended");
            }

        }

    });
}

const observer = new MutationObserver(checkVideos);

observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    childList: true
});

checkVideos();