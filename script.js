// ===== v6.4.4 iOS Autoplay Reliability Fix =====
const LAT = -41.327, LON = 174.794;
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";

const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let showingSurf = true;
let youtubeAPIReady = false;
let player;
let overlayActive = false;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// --- YouTube API loader
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}
window.onYouTubeIframeAPIReady = () => {
  youtubeAPIReady = true;
  initPlayer();
};

function initPlayer() {
  if (!frame || !youtubeAPIReady) return;
  player = new YT.Player(frame, {
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerReady() {
  tryPlay();
  document.addEventListener("click", () => tryPlay(true), { once: true });
}

function tryPlay(fromGesture = false) {
  if (!player || typeof player.playVideo !== "function") return;
  try { player.mute(); } catch {}
  player.playVideo();

  // Give time for iOS autoplay test
  setTimeout(() => {
    if (isIOS && !isPlaying() && !overlayActive) showOverlay();
  }, fromGesture ? 0 : 3000);
}

function isPlaying() {
  try { return player.getPlayerState() === YT.PlayerState.PLAYING; }
  catch { return false; }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    removeOverlay();
  }
}

function showOverlay() {
  const cam = document.querySelector(".cam");
  if (!cam) return;
  const overlay = document.createElement("div");
  overlay.className = "ios-play-overlay";
  overlay.textContent = "▶ Tap to Play Video";
  overlay.addEventListener("click", () => {
    tryPlay(true);
    removeOverlay();
  });
  cam.appendChild(overlay);
  overlayActive = true;
}

function removeOverlay() {
  const overlay = document.querySelector(".ios-play-overlay");
  if (overlay) overlay.remove();
  overlayActive = false;
}

// --- Camera toggle
function setToggle() {
  camToggle.classList.toggle("toggle--surf", showingSurf);
  camToggle.classList.toggle("toggle--airport", !showingSurf);
}

camToggle.addEventListener("click", () => {
  showingSurf = !showingSurf;
  setToggle();
  frame.style.opacity = "0";
  setTimeout(() => {
    frame.src = showingSurf ? SURF_EMBED : AIRPORT_EMBED;
    frame.style.opacity = "1";
    setTimeout(() => {
      if (window.YT && youtubeAPIReady) initPlayer();
      tryPlay();
    }, 400);
  }, 200);
});

// --- Init
window.addEventListener("load", () => {
  setToggle();
  loadYouTubeAPI();
});
