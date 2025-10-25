// ===== v6.5.1 MaranuiCam — fully stable build =====
const LAT = -41.327, LON = 174.794;
const NIWA_KEY = "AaVzAAAEjgZnzj1oZGopBRuRAsBGEE25";
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";

const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let showingSurf = true, youtubeAPIReady = false, player, overlayAdded = false;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

/* ---------- YouTube ---------- */
function loadYouTubeAPI() {
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
}
window.onYouTubeIframeAPIReady = () => (youtubeAPIReady = true, initPlayer());
function initPlayer() {
  if (!frame || !youtubeAPIReady) return;
  player = new YT.Player(frame, { events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange } });
}
function onPlayerReady() {
  tryPlay();
  ["touchstart", "click"].forEach(e => document.addEventListener(e, () => tryPlay(true), { once: true }));
}
function tryPlay(force = false) {
  if (!player?.playVideo) return;
  try { player.mute?.(); } catch {}
  setTimeout(() => { try { player.playVideo(); } catch {} }, force ? 0 : 300);
  setTimeout(() => { if (isIOS && !overlayAdded && !isPlaying()) addIOSOverlay(); }, 3000);
}
function isPlaying() {
  try { return player?.getPlayerState() === YT.PlayerState.PLAYING; } catch { return false; }
}
function onPlayerStateChange(e) {
  if (e.data === YT.PlayerState.PLAYING) {
    document.querySelector(".ios-play-overlay")?.remove(); overlayAdded = false;
  } else if ([YT.PlayerState.PAUSED, YT.PlayerState.ENDED].includes(e.data)) {
    setTimeout(() => try { player.playVideo(); } catch {} , 800);
  }
}
function addIOSOverlay() {
  const cam = document.querySelector(".cam");
  if (!cam || overlayAdded) return;
  const o = document.createElement("div");
  o.className = "ios-play-overlay";
  o.textContent = "▶ Tap to Play Video";
  o.onclick = () => tryPlay(true);
  cam.appendChild(o);
  overlayAdded = true;
}
function setToggle() {
  camToggle.classList.toggle("toggle--surf", showingSurf);
  camToggle.classList.toggle("toggle--airport", !showingSurf);
}
camToggle.onclick = () => {
  showingSurf = !showingSurf; setToggle();
  frame.style.opacity = "0";
  setTimeout(() => {
    frame.src = showingSurf ? SURF_EMBED : AIRPORT_EMBED;
    frame.style.opacity = "1";
    setTimeout(() => { window.YT && youtubeAPIReady && initPlayer(); tryPlay(); }, 400);
  }, 200);
};
window.onload = () => {
  setToggle(); loadYouTubeAPI();
  document.getElementById("dateLabel").textContent = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  refresh(); setInterval(refresh, 1800000);
};

/* ---------- Helpers ---------- */
function degToCompass(d) {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(d / 22.5) % 16];
}
function offlineData() {
  const base = new Date(); base.setMinutes(0,0,0);
  const hours = Array.from({ length: 24 }, (_, i) => new Date(base.getTime() + 36e5 * i));
  const r = (a,b) => +(Math.random() * (b - a) + a).toFixed(1);
  return {
    labelHours: hours,
    wave: hours.map(() => r(0.8, 1.6)),
    waveP: hours.map(() => r(7, 10)),
    wind: hours.map(() => r(8, 20)),
    gusts: hours.map(() => r(12, 28)),
    windDir: hours.map(() => Math.floor(Math.random() * 360)),
    rain: hours.map(() => Math.random() < 0.1 ? r(0, 1.2) : 0),
    tide: hours.map(() => r(0.6, 1.4)),
    sunrise: new Date().setHours(7, 0, 0, 0),
    sunset: new Date().setHours(19, 0, 0, 0),
    offline: true
  };
}
async function fetchSunTimes(lat, lon) {
  try {
    const res = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
    const j = await res.json();
    if (j.status === "OK") return { sunrise: new Date(j.results.sunrise), sunset: new Date(j.results.sunset) };
  } catch (e) { console.warn("Sunrise fetch failed:", e); }
  return { sunrise: new Date().setHours(7, 0), sunset: new Date().setHours(19, 0) };
}

/* ---------- Open-Meteo (safe) ---------- */
async function fetchData() {
  const url1 = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&daily=sunrise,sunset&timezone=Pacific/Auckland&windspeed_unit=kmh`;
  const url2 = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_period,wave_direction&timezone=Pacific/Auckland`;
  try {
    const [a, r] = await Promise.allSettled([fetch(url1), fetch(url2)]);
    const o = a.value && a.value.ok ? await a.value.json() : {};
    const s = r.value && r.value.ok ? await r.value.json() : {};
    const arr = (x) => Array.isArray(x) ? x : [];
    const hourly = o.hourly || {}, marine = s.hourly || {};
    const now = new Date(); now.setMinutes(0,0,0);
    const hours = Array.from({ length: 24 }, (_, i) => new Date(now.getTime() + 36e5 * i));
    return {
      labelHours: hours,
      wind: arr(hourly.wind_speed_10m),
      gusts: arr(hourly.wind_gusts_10m),
      windDir: arr(hourly.wind_direction_10m),
      rain: arr(hourly.precipitation),
      wave: arr(marine.wave_height),
      waveP: arr(marine.wave_period),
      waveD: arr(marine.wave_direction),
      tide: Array(24).fill(null),
      sunrise: o.daily?.sunrise ? new Date(o.daily.sunrise[0]) : new Date().setHours(7,0),
      sunset: o.daily?.sunset ? new Date(o.daily.sunset[0]) : new Date().setHours(19,0),
      offline: false
    };
  } catch (err) {
    console.warn("Falling back:", err);
    return offlineData();
  }
}

/* ---------- NIWA Tides ---------- */
async function fetchTidePredictionsNIWA() {
  try {
    const url = `https://api.niwa.co.nz/tides/data?lat=${LAT}&long=${LON}`;
    const resp = await fetch(url, { headers: { "x-apikey": NIWA_KEY } });
    if (!resp.ok) throw new Error("NIWA request failed: " + resp.status);
    const data = await resp.json();
    console.log("NIWA Tide Data (raw):", data);
    const rows =
      (Array.isArray(data.predictions) && data.predictions) ||
      (Array.isArray(data.values) && data.values) ||
      (Array.isArray(data.data) && data.data) || [];
    const norm = rows.map(p => {
      const time = p.time || p.dateTime || null;
      const height = p.height ?? p.value ?? null;
      const raw = (p.type ?? p.event ?? "").toString().toLowerCase();
      let type = raw.includes("high") ? "HIGH" : raw.includes("low") ? "LOW" : null;
      return (time && type) ? { time, height, type } : null;
    }).filter(Boolean);
    console.table(norm.slice(0,6));
    return { highs: norm.filter(e=>e.type==="HIGH"), lows: norm.filter(e=>e.type==="LOW"), offline:false };
  } catch (err) {
    console.warn("NIWA tide fetch failed, falling back:", err);
    return { highs:[], lows:[], offline:true };
  }
}

/* ---------- Build Table ---------- */
function buildTable(d) {
  const tH = document.getElementById("thead"), tB = document.getElementById("tbody");
  if (!tH || !tB) return;
  tH.innerHTML = tB.innerHTML = "";
  const hdr = document.createElement("tr");
  hdr.innerHTML = "<th>Metric</th>" + d.labelHours.map(h => `<th>${h.toLocaleTimeString([], {hour:"2-digit"})}</th>`).join("");
  tH.appendChild(hdr);
  const rows = [
    ["Wave (m)", d.wave, v => v?.toFixed(1) ?? "—"],
    ["Period (s)", d.waveP, v => v?.toFixed(0) ?? "—"],
    ["Wind (km/h)", d.wind, v => v?.toFixed(0) ?? "—"],
    ["Gusts (km/h)", d.gusts, v => v?.toFixed(0) ?? "—"],
    ["Direction", d.windDir, v => v!=null ? `${degToCompass(v)} <span style='transform:rotate(${v}deg)' class='dir-arrow'>➤</span>`:"—"],
    ["Rain (mm/hr)", d.rain, v => v?.toFixed(1) ?? "—"],
    ["Tide (m)", d.tide, v => v?.toFixed(2) ?? "—"]
  ];
  rows.forEach(([n,a,f]) => {
    const r = document.createElement("tr");
    r.innerHTML = `<th>${n}</th>` + a.map(x => `<td>${f(x)}</td>`).join("");
    tB.appendChild(r);
  });
  const surf = d.labelHours.map((_,i)=>score(d.wave[i],d.wind[i],d.rain[i],d.windDir[i],d.waveP[i],d.tide[i]));
  const sRow = document.createElement("tr");
  sRow.innerHTML = "<th>Surfability (1–10)</th>" + surf.map(v => {
    const c = v>=8?"good":v>=5?"fair":"poor";
    return `<td class="scale-surf ${c}">${v.toFixed(1)}</td>`;
  }).join("");
  tB.appendChild(sRow);
  const badge = document.getElementById("scoreBadge");
  if (badge) { badge.textContent = `Surfability ${surf[0].toFixed(1)}`; badge.className = "chip score "+(surf[0]>=8?"good":surf[0]>=5?"fair":"poor"); }
}

/* ---------- Update Chips ---------- */
function updateChips(d) {
  const fmt = t => new Date(t).toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Pacific/Auckland"});
  const sunChip=document.getElementById("sunChip");
  if(sunChip&&d.sunrise&&d.sunset){sunChip.innerHTML=`🌅 ${fmt(d.sunrise)}  🌇 ${fmt(d.sunset)}`;}
  const tideChip=document.getElementById("tideChip");
  if(tideChip){
    if(d.tideTimes && (d.tideTimes.highs?.length || d.tideTimes.lows?.length)){
      const zone="Pacific/Auckland";
      const events=[...(d.tideTimes.highs||[]).map(e=>({...e,kind:"HIGH"})),...(d.tideTimes.lows||[]).map(e=>({...e,kind:"LOW"}))].map(e=>({...e,local:new Date(e.time)})).sort((a,b)=>a.local-b.local);
      const todayNZ=new Date().toLocaleDateString("en-NZ",{timeZone:zone});
      const todays=events.filter(e=>e.local.toLocaleDateString("en-NZ",{timeZone:zone})===todayNZ);
      const pool=todays.length?todays:events;
      const highs=pool.filter(e=>e.kind==="HIGH").slice(0,2);
      const lows=pool.filter(e=>e.kind==="LOW").slice(0,2);
      const highStr=highs.map(e=>`${fmt(e.local)}${e.height?` (${(+e.height).toFixed(2)} m)`:``}`).join("  ");
      const lowStr=lows.map(e=>`${fmt(e.local)}${e.height?` (${(+e.height).toFixed(2)} m)`:``}`).join("  ");
      tideChip.innerHTML=`🌊 HIGH: ${highStr||"—"}  LOW: ${lowStr||"—"}`;
    } else tideChip.innerHTML="🌊 Tide data unavailable";
  }
}

/* ---------- Surfability ---------- */
function score(wave,wind,rain,windDir,period,tide){
  if(wave==null)return 0;let s=10;
  s-=Math.abs(wave-1.2)*4;
  if(period>7)s+=Math.min(3,(period-7)*0.5);
  if(wind>15)s-=(wind-15)*0.2;
  if(windDir!=null){if(windDir>=315||windDir<=45)s+=2;else if(windDir>=135&&windDir<=225)s-=2;}
  if(rain>0.5)s-=1;
  if(tide!=null&&(tide<0.6||tide>1.6))s-=1;
  return Math.max(0,Math.min(10,s));
}

/* ---------- Refresh ---------- */
async function refresh(){
  document.getElementById("dataStatus").textContent="⏳ loading...";
  const offline=offlineData(); buildTable(offline);
  const sun=await fetchSunTimes(LAT,LON);
  offline.sunrise=sun.sunrise; offline.sunset=sun.sunset;
  updateChips(offline);
  try{
    const [marine,sun2,niwa]=await Promise.all([fetchData(),fetchSunTimes(LAT,LON),fetchTidePredictionsNIWA()]);
    marine.sunrise=sun2.sunrise; marine.sunset=sun2.sunset; marine.tideTimes=niwa;
    buildTable(marine); updateChips(marine);
    document.getElementById("dataStatus").textContent=niwa.offline?"🌐 Live (no NIWA)":"🌐 Live";
    document.getElementById("updatedAt").textContent=new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Pacific/Auckland"});
  }catch(err){
    console.error("Refresh failed:",err);
    document.getElementById("dataStatus").textContent="❌ Error";
  }
}
