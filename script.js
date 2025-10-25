// ===== v6.4.4 MaranuiCam — precise sunrise/sunset + full 24h tides (no popup) =====
const LAT = -41.327, LON = 174.794;
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";

const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let showingSurf = true;
let youtubeAPIReady = false;
let player;

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Load YouTube IFrame API
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// YouTube API ready callback
window.onYouTubeIframeAPIReady = function() {
  youtubeAPIReady = true;
  initPlayer();
};

function initPlayer() {
  if (!frame || !youtubeAPIReady) return;
  player = new YT.Player(frame, {
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function onPlayerReady(event) {
  tryPlay();
}

function tryPlay(fromGesture=false){
  if (!player || typeof player.playVideo !== 'function') return;
  try { player.mute && player.mute(); } catch(e){}
  setTimeout(() => { try { player.playVideo(); } catch(e){} }, fromGesture ? 0 : 300);
}

function isPlaying(){
  try { return player && player.getPlayerState && player.getPlayerState() === YT.PlayerState.PLAYING; }
  catch { return false; }
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    setTimeout(() => { try { player.playVideo(); } catch(e){} }, 800);
  }
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
  document.getElementById("dateLabel").textContent =
    new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  refresh();
  setInterval(refresh, 30*60*1000);
});

/* ---------- Helpers ---------- */
function toHourISO(d) { return new Date(d).toISOString().slice(0, 13) + ":00"; }
function degToCompass(num) {
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[Math.round(num / 22.5) % 16];
}

/* ---------- Offline fallback ---------- */
function offlineData() {
  const base = new Date(); base.setMinutes(0,0,0);
  const hours = Array.from({ length: 24 }, (_, i) => new Date(base.getTime() + i*3600*1000));
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
    sunrise: new Date().setHours(7,0,0,0),
    sunset: new Date().setHours(19,0,0,0),
    offline:true
  };
}

/* ---------- Fetch sunrise/sunset with minute precision ---------- */
async function fetchSunTimes(lat, lon) {
  try {
    const resp = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
    const json = await resp.json();
    if (json.status === "OK") {
      return {
        sunrise: new Date(json.results.sunrise),
        sunset: new Date(json.results.sunset)
      };
    }
  } catch (e) {
    console.warn("Sunrise-Sunset fetch failed:", e);
  }
  return { sunrise: new Date().setHours(7,0,0,0), sunset: new Date().setHours(19,0,0,0) };
}

/* ---------- Fetch + align Open-Meteo data ---------- */
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

    const data = {
      labelHours: hours,
      wind: [], gusts: [], windDir: [], rain: [],
      wave: [], waveP: [], waveD: [], tide: [],
      sunrise: f.daily?.sunrise ? new Date(f.daily.sunrise[0]) : new Date().setHours(7,0),
      sunset:  f.daily?.sunset  ? new Date(f.daily.sunset[0])  : new Date().setHours(19,0),
      offline:false
    };

    hours.forEach(h=>{
      const iso = toHourISO(h);
      const fI=iF[iso], mI=iM[iso], tI=iT[iso];
      data.wind.push(fI!=null? f.hourly.wind_speed_10m[fI]:null);
      data.gusts.push(fI!=null? f.hourly.wind_gusts_10m[fI]:null);
      data.windDir.push(fI!=null? f.hourly.wind_direction_10m[fI]:null);
      data.rain.push(fI!=null? f.hourly.precipitation[fI]:null);
      data.wave.push(mI!=null? m.hourly.wave_height[mI]:null);
      data.waveP.push(mI!=null? m.hourly.wave_period[mI]:null);
      data.waveD.push(mI!=null? m.hourly.wave_direction[mI]:null);
      data.tide.push(tI!=null? t.hourly.tide_height[tI]:null);
    });

    return data;
  } catch (err) {
    console.warn("Falling back:", err);
    return offlineData();
  }
}

/* ---------- Build table ---------- */
function buildTable(d) {
  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");
  thead.innerHTML = tbody.innerHTML = "";

  const trH = document.createElement("tr");
  trH.innerHTML = "<th>Metric</th>" +
    d.labelHours.map(h=>`<th${isNight(d,h)?' class="night"':''}>${h.toLocaleTimeString([], {hour:'2-digit'})}</th>`).join("");
  thead.appendChild(trH);

  const rows = [
    ["Wave (m)", d.wave, v=>v?.toFixed(1)??"—"],
    ["Period (s)", d.waveP, v=>v?.toFixed(0)??"—"],
    ["Wind (km/h)", d.wind, v=>v?.toFixed(0)??"—"],
    ["Gusts (km/h)", d.gusts, v=>v?.toFixed(0)??"—"],
    ["Direction", d.windDir, v=> v!=null ? `${degToCompass(v)} <span style='transform:rotate(${v}deg)' class='dir-arrow'>➤</span>` : "—"],
    ["Rain (mm/hr)", d.rain, v=>v?.toFixed(1)??"—"],
    ["Tide (m)", d.tide, v=>v?.toFixed(2)??"—"]
  ];

  rows.forEach(([label, arr, fmt])=>{
    const tr=document.createElement("tr");
    tr.innerHTML="<th>"+label+"</th>"+
      arr.map((v,i)=>`<td${isNight(d,i)?' class="night"':''}>${fmt(v)}</td>`).join("");
    tbody.appendChild(tr);
  });

  const surf = d.labelHours.map((_,i)=>score(d.wave[i], d.wind[i], d.rain[i], d.windDir[i]));
  const tr=document.createElement("tr");
  tr.innerHTML="<th>Surfability (1–10)</th>"+
    surf.map((v,i)=>{
      const cls = v>=8?"good":v>=5?"fair":"poor";
      return `<td class="scale-surf ${cls}${isNight(d,i)?' night':''}">${v.toFixed(1)}</td>`;
    }).join("");
  tbody.appendChild(tr);

  const now = surf[0];
  const badge=document.getElementById("scoreBadge");
  badge.textContent=`Surfability ${now.toFixed(1)}`;
  badge.className="chip score "+(now>=8?"good":now>=5?"": "poor");
}

function isNight(d, h) {
  const hh = (h instanceof Date) ? h : d.labelHours[h];

  // Get today's sunrise and sunset
  const sunrise = new Date(d.sunrise);
  const sunset = new Date(d.sunset);

  // If the hour belongs to the next day, shift sunrise/sunset forward by 24h
  if (hh.getDate() !== sunrise.getDate()) {
    sunrise.setDate(sunrise.getDate() + 1);
    sunset.setDate(sunset.getDate() + 1);
  }

  // Night is before sunrise or after sunset for that day
  return hh < sunrise || hh >= sunset;
}



/* ---------- Update chips ---------- */



/* ---------- Update chips ---------- */
/* ---------- Update chips ---------- */
function updateChips(d) {
  const sunChip = document.getElementById("sunChip");
  if (sunChip) {
    sunChip.innerHTML =
      `🌅 ${new Date(d.sunrise).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}  ` +
      `🌇 ${new Date(d.sunset).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }

  // Removed tideChip section entirely
}


/* ---------- Scoring ---------- */
function score(wave,wind,rain,dir){
  if(wave==null) return 0;
  let s=10 - Math.abs(wave-1)*5;
  s -= wind>20? (wind-20)/5 : 0;
  if(rain>0.5) s-=2;
  if(dir && (dir<200||dir>340)) s+=1;
  return Math.max(0,Math.min(10,s));
}

/* ---------- Refresh cycle ---------- */
async function refresh(){
  const fallback=offlineData();
  buildTable(fallback);
  const sunTimes=await fetchSunTimes(LAT,LON);
  fallback.sunrise=sunTimes.sunrise;
  fallback.sunset=sunTimes.sunset;
  updateChips(fallback);
  document.getElementById("dataStatus").textContent="⏳ loading...";
  try{
    const d=await fetchData();
    const sun=await fetchSunTimes(LAT,LON);
    d.sunrise=sun.sunrise; d.sunset=sun.sunset;
    buildTable(d);
    updateChips(d);
    document.getElementById("dataStatus").textContent=d.offline?"📁 Offline":"🌐 Live";
    document.getElementById("updatedAt").textContent=new Date().toLocaleTimeString();
  }catch(e){
    console.error("Refresh failed:",e);
    document.getElementById("dataStatus").textContent="❌ Error";
  }
}


/* ---------- About panel toggle ---------- */
window.addEventListener("DOMContentLoaded", () => {
  const aboutBtn = document.getElementById("aboutBtn");
  const aboutPanel = document.getElementById("aboutPanel");
  const closeAbout = document.getElementById("closeAbout");

  if (aboutBtn && aboutPanel) {
    aboutBtn.addEventListener("click", () => {
      aboutPanel.classList.add("active");
    });
    closeAbout.addEventListener("click", () => {
      aboutPanel.classList.remove("active");
    });
    aboutPanel.addEventListener("click", (e) => {
      if (e.target === aboutPanel) aboutPanel.classList.remove("active");
    });
  }
});
