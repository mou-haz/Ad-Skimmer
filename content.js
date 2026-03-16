let adActive = false;

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

function isYouTubeAd() {
    return document.querySelector(".ad-showing") !== null;
}

function isVisible(el) {

    while (el) {

        const style = window.getComputedStyle(el);

        if (
            el.hidden ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            style.opacity === "0"
        ) {
            return false;
        }

        el = el.parentElement;
    }

    return true;
}

function isGenericAd(video) {

    if (!isVisible(video)) return false;

    if (video.title === "Advertisement") return true;

    let p = video.parentElement;

    while (p) {

        if (!isVisible(p)) return false;

        if (p.title === "Advertisement") return true;

        p = p.parentElement;
    }

    return false;
}

function skipAd() {

    const skipButtons = [
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        'button[aria-label^="Skip ad"]'
    ];

    for (const selector of skipButtons) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent !== null) {
            button.click();
            console.log("Ad skipped.");
            return;
        }
    }
}

function checkVideos() {

    const videos = document.querySelectorAll("video");

    videos.forEach(video => {

        const ytAd = isYouTubeAd();
        const genericAd = isGenericAd(video);

        if (ytAd || genericAd) {

            if (!adActive) {
                adActive = true;

                video.playbackRate = 16;
                video.currentTime = video.duration - 0.1;
                video.muted = true;

                setLowestYouTubeQuality();

                console.log("Ad detected");
            }

            skipAd();

        } else {

            if (adActive) {
                adActive = false;

                video.playbackRate = 1;
                video.muted = false;

                console.log("Ad ended");
            }

        }

    });
}

setInterval(checkVideos, 250);