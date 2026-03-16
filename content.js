
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

function isAdSkimmed(video) {
    return video._adActive && video.playbackRate == 16;
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
            const evObj = document.createEvent("Events");
            evObj.initEvent("click", true, false);
            button.dispatchEvent(evObj);
            button.click();
            console.log("Ad skipped.");
            return;
        }
    }
}

function checkVideos() {

    const videos = document.querySelectorAll("video");

    videos.forEach(video => {
	
    	video._adActive ||= false;
        const ytAd = isYouTubeAd();
        const genericAd = isGenericAd(video);

        if (ytAd || genericAd) {

            if (!isAdSkimmed(video)) {
                
                video._adActive = true;
                video.muted = true;
                video._pbRate = video.playbackRate;
                video.playbackRate = 16;
                video.currentTime = video.duration - 0.1;

                /*console.log(video.duration);
                if (Number.isFinite(video.duration) && video.duration > 0) {
                    const end = video.duration - 0.1;
                    video.currentTime = end;
                    console.log(end);
                }*/

                setLowestYouTubeQuality();

                console.log("Ad detected");

                console.log(video.playbackRate);
                console.log(video.currentTime);
            }

            skipAd();

        } else {

            if (video._adActive) {

                video._adActive = false;
                video.playbackRate = video._pbRate;
                video.muted = false;

                if (video.paused) {
                    video.play().catch(()=>{});
                }

                console.log("Ad ended");
            }

        }

    });
}

//setInterval(checkVideos, 150);
const observer = new MutationObserver(checkVideos);

observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    childList: true
});

checkVideos();