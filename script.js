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
  updateDayTitle();
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
/* ---------- Scoring ---------- */
function score(wave, wind, rain, dir, wavePeriod, waveDirection) {
  if(wave == null) return 0;
  
  let s;
  if (wave < 0.5) s = 3;
  else if (wave <= 1.5) s = 5 + (wave-0.5);
  else if (wave <= 2.5) s = 7 + (wave-1.5);  
  else s = 9;

  // Wave cleanliness factor (using wave period)
  let cleanliness = 1.0;
  if (wavePeriod > 10) cleanliness += 0.5;    // Long period = cleaner waves
  else if (wavePeriod > 7) cleanliness += 0.2; // Medium period = decent
  else if (wavePeriod < 5) cleanliness -= 0.3; // Short period = choppy
  
  // Wind-wave alignment (offshore bonus) - ONLY if both directions exist
  if (dir != null && waveDirection != null) {
    const diff = Math.abs(dir - waveDirection);
    const offshoreAngle = Math.min(diff, 360 - diff);
    if (offshoreAngle < 45) cleanliness += 0.3; // Offshore winds
    else if (offshoreAngle > 135) cleanliness -= 0.3; // Onshore winds
  }
  
  s *= cleanliness; // Apply cleanliness multiplier
  
  // Traditional penalties
  s -= wind > 20 ? (wind-20)/5 : 0;
  if(rain > 0.5) s -= 2;
  if(dir && (dir < 200 || dir > 340)) s += 1;
  
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
    prev.addEventListener("click", async () => {
      if (dayOffset > -MAX_PAST_DAYS) {
        dayOffset -= 1;
        await loadDay();
      }
    });

    next.addEventListener("click", async () => {
      if (dayOffset < MAX_FUTURE_DAYS) {
        dayOffset += 1;
        await loadDay();
      }
    });

    updateNavState();
  }
});


/* ---------- Day navigation buttons ---------- */
window.addEventListener("DOMContentLoaded", () => {
  const prev = document.getElementById("prevDay");
  const next = document.getElementById("nextDay");

  if (prev && next) {
    prev.addEventListener("click", async () => {
      dayOffset -= 1;
      document.getElementById("dataStatus").textContent = "⏳ Loading…";
      updateDayTitle();
      const d = await fetchData(dayOffset);
      buildTable(d);
      updateChips(d);
      document.getElementById("dataStatus").textContent =
        d.offline ? "📁 Offline" : "🌐 Live";
    });

    next.addEventListener("click", async () => {
      dayOffset += 1;
      document.getElementById("dataStatus").textContent = "⏳ Loading…";
      updateDayTitle();
      const d = await fetchData(dayOffset);
      buildTable(d);
      updateChips(d);
      document.getElementById("dataStatus").textContent =
        d.offline ? "📁 Offline" : "🌐 Live";
    });
  }
});
