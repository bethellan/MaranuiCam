// ===== v6.4.4 — Removes lower sunrise/sunset icons & adds minutes to times =====
const LAT = -41.327, LON = 174.794;
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";

const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let showingSurf = true;
let youtubeAPIReady = false;
let player;
let overlayAdded = false;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Load YouTube API
function loadYouTubeAPI() {
  const tag = document.createElement("script");
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
  setTimeout(() => { try { player.playVideo(); } catch {} }, fromGesture ? 0 : 300);
  setTimeout(() => {
    if (isIOS && !overlayAdded && !isPlaying()) addIOSOverlay();
  }, 3000);
}

function isPlaying() {
  try { return player.getPlayerState() === YT.PlayerState.PLAYING; }
  catch { return false; }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    const overlay = document.querySelector(".ios-play-overlay");
    if (overlay) overlay.remove();
    overlayAdded = false;
  }
}

function addIOSOverlay() {
  const cam = document.querySelector(".cam");
  if (!cam || overlayAdded) return;
  const overlay = document.createElement("div");
  overlay.className = "ios-play-overlay";
  overlay.textContent = "▶ Tap to Play Video";
  overlay.addEventListener("click", () => {
    tryPlay(true);
    overlay.remove();
    overlayAdded = false;
  });
  cam.appendChild(overlay);
  overlayAdded = true;
}

// Camera toggle
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

window.addEventListener("load", () => {
  setToggle();
  loadYouTubeAPI();
  document.getElementById("dateLabel")?.textContent =
    new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  refresh();
  setInterval(refresh, 30 * 60 * 1000);
});

// ---------- Utility ----------
function toHourISO(d) { return new Date(d).toISOString().slice(0, 13) + ":00"; }
function degToCompass(num) {
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[Math.round(num / 22.5) % 16];
}

// ---------- Offline fallback ----------
function offlineData() {
  const base = new Date(); base.setMinutes(0,0,0);
  const hours = Array.from({ length: 24 }, (_, i) => new Date(base.getTime() + i * 3600 * 1000));
  const fake = (min,max)=> +(Math.random()*(max-min)+min).toFixed(1);
  return {
    labelHours: hours,
    wave: hours.map(()=>fake(0.8,1.6)),
    waveP: hours.map(()=>fake(7,10)),
    wind: hours.map(()=>fake(8,20)),
    gusts: hours.map(()=>fake(12,28)),
    windDir: hours.map(()=>Math.floor(Math.random()*360)),
    rain: hours.map(()=>Math.random()<0.1?fake(0,1.2):0),
    tide: hours.map(()=>fake(0.6,1.4)),
    sunrise: new Date().setHours(7,15,0,0),
    sunset: new Date().setHours(19,5,0,0),
    offline:true
  };
}

// ---------- Fetch & display ----------
async function fetchData() {
  const forecast = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&daily=sunrise,sunset&timezone=auto&windspeed_unit=kmh`;
  const marine   = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_period,wave_direction&timezone=auto`;
  const tide     = `https://marine-api.open-meteo.com/v1/tide?latitude=${LAT}&longitude=${LON}&hourly=tide_height&timezone=auto`;
  try {
    const [fR, mR, tR] = await Promise.allSettled([ fetch(forecast), fetch(marine), fetch(tide) ]);
    const f = fR.value && fR.value.ok ? await fR.value.json() : {};
    const m = mR.value && mR.value.ok ? await mR.value.json() : {};
    const t = tR.value && tR.value.ok ? await tR.value.json() : {};
    const base = new Date(); base.setMinutes(0,0,0);
    const hours = Array.from({ length: 24 }, (_,i)=>new Date(base.getTime()+i*3600*1000));
    const idx = a => a ? Object.fromEntries(a.time.map((v,i)=>[v,i])) : {};
    const iF = idx(f.hourly||{}), iM = idx(m.hourly||{}), iT = idx(t.hourly||{});
    const
