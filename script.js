// ===== v6.4.4 MaranuiCam — precise sunrise/sunset + full 24h tides (no popup) =====
const LAT = -41.327, LON = 174.794;
// ===== Camera setup: Surf ⇄ Airport ⇄ Lookout =====
const CAMS = [
  {
    id: "surf",
    titleLeft: "🏖️ Surf Cam",
    titleRight: "✈️ Airport Cam",
    url: "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1"
  },
  {
    id: "airport",
    titleLeft: "✈️ Airport Cam",
    titleRight: "🌊 Lookout Cam",
    url: "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1"
  },
  {
    id: "lookout",
    titleLeft: "🌊 Lookout Cam",
    titleRight: "🏖️ Surf Cam",
    url: "https://www.youtube.com/embed/BfCQIhmK6OE?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1"
  }
];

let currentCam = 0;
const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let youtubeAPIReady = false, player;


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

// ---------- Camera Toggle Cycle ----------
function updateToggleButton() {
  const nextIndex = (currentCam + 1) % CAMS.length;
  const thisCam = CAMS[currentCam];
  const nextCam = CAMS[nextIndex];
  camToggle.innerHTML = `
    <span class="toggle__left">${thisCam.titleLeft}</span>
    <span class="toggle__divider">⇄</span>
    <span class="toggle__right">${nextCam.titleRight}</span>`;
}

function switchCam() {
  currentCam = (currentCam + 1) % CAMS.length;
  const cam = CAMS[currentCam];
  frame.style.opacity = "0";
  setTimeout(() => {
    frame.src = cam.url;
    frame.style.opacity = "1";
    setTimeout(() => {
      if (window.YT && youtubeAPIReady) initPlayer();
      tryPlay();
    }, 400);
  }, 200);
  updateToggleButton();
}

camToggle.addEventListener("click", switchCam);


window.addEventListener("load", () => {
  loadYouTubeAPI();
  document.getElementById("dateLabel").textContent =
    new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  refresh();
  updateDayTitle();
  updateToggleButton();
  setInterval(refresh, 30*60*1000);
});

/* ---------- Day handling ---------- */
let dayOffset = 0; // 0 = today, -1 = yesterday, +1 = tomorrow
const MAX_PAST_DAYS = 7;    // how far back you can go
const MAX_FUTURE_DAYS = 7;  // how far forward you can go
function getBaseDate(offsetDays = 0) {
  // Align to NZ midnight (Pacific/Auckland)
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + offsetDays);
  return base;
}

function updateDayTitle() {
  const title = document.getElementById("dayTitle");
  if (!title) return;

  const base = getBaseDate(dayOffset);
  const label = base.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });

  // Adjust wording for today / yesterday / tomorrow
  let prefix = "";
  if (dayOffset === 0) prefix = "(Today)";
  else if (dayOffset === -1) prefix = "(Yesterday)";
  else if (dayOffset === 1) prefix = "(Tomorrow)";
  else prefix = `(${dayOffset > 0 ? "+" : ""}${dayOffset} days)`;

  title.textContent = `24-Hour Forecast — Lyall Bay ${prefix} ${label}`;
}


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
    waveD: hours.map(()=>Math.floor(Math.random()*360)),
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
/* ---------- Fetch + align Open-Meteo data ---------- */
/* ---------- Fetch + align Open-Meteo data by dayOffset (Pacific/Auckland) ---------- */
/* ---------- Fetch + align Open-Meteo data by dayOffset (Pacific/Auckland) ---------- */
async function fetchData(offsetDays = 0) {
  const base = getBaseDate(offsetDays);              // local midnight (NZ)
  const start = base.toISOString().split("T")[0];
  const end = new Date(base.getTime() + 24 * 3600 * 1000)
                 .toISOString().split("T")[0];

  const forecast =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation` +
    `&daily=sunrise,sunset&timezone=Pacific/Auckland&start_date=${start}&end_date=${end}&windspeed_unit=kmh`;

  const marine =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}` +
    `&hourly=wave_height,wave_period,wave_direction` +
    `&timezone=Pacific/Auckland&start_date=${start}&end_date=${end}`;

  try {
    const [fR, mR] = await Promise.allSettled([fetch(forecast), fetch(marine)]);
    const f = fR.value && fR.value.ok ? await fR.value.json() : {};
    const m = mR.value && mR.value.ok ? await mR.value.json() : {};

    const hours = Array.from({ length: 24 }, (_, i) =>
      new Date(base.getTime() + i * 3600 * 1000)
    );
    const iF = Object.fromEntries(f.hourly?.time?.map((t, i) => [t, i]) || []);
    const iM = Object.fromEntries(m.hourly?.time?.map((t, i) => [t, i]) || []);

    const data = {
      labelHours: hours,
      wind: [], gusts: [], windDir: [], rain: [],
      wave: [], waveP: [], waveD: [], tide: [],
      sunrise: f.daily?.sunrise ? new Date(f.daily.sunrise[0]) : new Date(base.setHours(7)),
      sunset:  f.daily?.sunset  ? new Date(f.daily.sunset[0])  : new Date(base.setHours(19)),
      offline: false
    };

    hours.forEach(h => {
      const iso = h.toISOString().slice(0, 13) + ":00";
      const fI = iF[iso], mI = iM[iso];
      data.wind.push(fI != null ? f.hourly.wind_speed_10m[fI] : null);
      data.gusts.push(fI != null ? f.hourly.wind_gusts_10m[fI] : null);
      data.windDir.push(fI != null ? f.hourly.wind_direction_10m[fI] : null);
      data.rain.push(fI != null ? f.hourly.precipitation[fI] : null);
      data.wave.push(mI != null ? m.hourly.wave_height[mI] : null);
      data.waveP.push(mI != null ? m.hourly.wave_period[mI] : null);
      data.waveD.push(mI != null ? m.hourly.wave_direction[mI] : null);
    });

    return data;
  } catch (err) {
    console.warn("⚠️ Falling back to offline data:", err);
    return offlineData();
  }
}




/* ---------- Build table ---------- */
function buildTable(d) {
  try {
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

    const surf = d.labelHours.map((_,i)=>score(d.wave[i], d.wind[i], d.rain[i], d.windDir[i],d.waveP[i], d.waveD[i] ));
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
  } catch (error) {
    console.error("Error building table:", error);
    document.getElementById("dataStatus").textContent = "❌ Table Error";
  }
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
function score(wave, wind, rain, dir, wavePeriod, waveDirection) {
  if (wave == null) return 0;

  // --- 1. Base size weighting (non-linear) ---
  // 0m=0, 0.5m=2, 1.0m=4, 1.5m=6, 2.0m=8, 3m=9, 4m+=10 (then capped)
  let s = Math.min(10, (Math.pow(wave / 0.6, 1.2) * 2));
  if (wave > 3) s -= (wave - 3) * 1.5; // too big penalty

  // --- 2. Cleanliness from period ---
  if (wavePeriod > 11) s += 1.0;
  else if (wavePeriod >= 8) s += 0.5;
  else if (wavePeriod <= 5) s -= 1.0;

  // --- 3. Wind alignment (offshore boost / onshore penalty) ---
  if (dir != null && waveDirection != null) {
    const diff = Math.abs(dir - waveDirection);
    const angle = Math.min(diff, 360 - diff);
    if (angle > 150) s += 1.0;        // offshore
    else if (angle < 60) s -= 1.0;    // onshore
    else if (angle >= 60 && angle <= 120) s -= 0.5; // cross-shore
  }

  // --- 4. Wind speed penalty ---
  if (wind > 15) s -= (wind - 15) / 5; // penalise breezy days
  if (wind > 25) s -= (wind - 25) / 2; // stronger penalty above 25 km/h

  // --- 5. Rain penalty ---
  if (rain > 0.5) s -= 1.5;
  if (rain > 2) s -= 2.5;

  // --- Clamp & return ---
  return Math.max(0, Math.min(10, s));
}


/* ---------- Refresh cycle ---------- */
async function refresh(){
  const base = getBaseDate(dayOffset);
  const fallback = offlineData(base);
  updateDayTitle();
  buildTable(fallback);
  const sunTimes=await fetchSunTimes(LAT,LON);
  fallback.sunrise=sunTimes.sunrise;
  fallback.sunset=sunTimes.sunset;
  updateChips(fallback);
  document.getElementById("dataStatus").textContent="⏳ loading...";
  try{
    const d = await fetchData(dayOffset);
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


/* ---------- Day navigation buttons with limits + loading ---------- */
window.addEventListener("DOMContentLoaded", () => {
  const prev = document.getElementById("prevDay");
  const next = document.getElementById("nextDay");
  const status = document.getElementById("dataStatus");

  function updateNavState() {
    prev.disabled = (dayOffset <= -MAX_PAST_DAYS);
    next.disabled = (dayOffset >=  MAX_FUTURE_DAYS);
  }

  async function loadDay() {
    status.textContent = "⏳ Loading…";
    prev.disabled = next.disabled = true;
    updateDayTitle();
    const d = await fetchData(dayOffset);
    buildTable(d);
    updateChips(d);
    status.textContent = d.offline ? "📁 Offline" : "🌐 Live";
    updateNavState();
  }

  if (prev && next) {
   prev.addEventListener("click", () => {
  dayOffset--;
  loadDay();
});

next.addEventListener("click", () => {
  dayOffset++;
  loadDay();
});


    updateNavState();
  }

  // keep this closing brace to end the first DOMContentLoaded
});
  
/* ---------- About Panel Controls ---------- */
window.addEventListener("load", () => {
  const aboutBtn = document.getElementById("aboutBtn");
  const aboutPanel = document.getElementById("aboutPanel");
  const closeAbout = document.getElementById("closeAbout");

  if (aboutBtn && aboutPanel && closeAbout) {
    // Open panel
    aboutBtn.addEventListener("click", () => {
      aboutPanel.classList.add("active");
    });

    // Close panel (button)
    closeAbout.addEventListener("click", () => {
      aboutPanel.classList.remove("active");
    });

    // Close when clicking outside content
    aboutPanel.addEventListener("click", (e) => {
      if (e.target === aboutPanel) {
        aboutPanel.classList.remove("active");
      }
    });
  }
});



