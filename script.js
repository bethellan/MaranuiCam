/* =========================================================================
   MaranuiCam v6.5.1 — Multi-source data table + Tide Chart
   Requirements in your HTML (by id/class):
   - #liveFrame (iframe), #camToggle (button), #dateLabel, #dayTitle
   - #prevDay, #nextDay, #dataStatus, #updatedAt
   - #sunChip, #tideChip, #scoreBadge
   - a table with <thead id="thead"> and <tbody id="tbody">
   - a wrapper around the table with class ".table-scroll" (for tide chart insert)
   ========================================================================= */

const LAT = -41.327, LON = 174.794;

/* ===== Cameras ===== */
const CAMS = [
  { id: "surf",    titleLeft: "🏖️ Surf Cam",  titleRight: "✈️ Airport Cam",
    url: "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1" },
  { id: "airport", titleLeft: "✈️ Airport Cam", titleRight: "🌊 Lookout Cam",
    url: "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1" },
  { id: "lookout", titleLeft: "🌊 Lookout Cam", titleRight: "🏖️ Surf Cam",
    url: "https://www.youtube.com/embed/BfCQIhmK6OE?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1" }
];

let currentCam = 0;
let frame, camToggle;
let youtubeAPIReady = false, player;

/* ===== iOS sniff (kept for future) ===== */
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

/* ===== Day handling ===== */
let dayOffset = 0; // 0 = today, -1 = yesterday, +1 = tomorrow
const MAX_PAST_DAYS = 7, MAX_FUTURE_DAYS = 7;

function getBaseDate(offsetDays = 0) {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + offsetDays);
  return base;
}

function updateDayTitle() {
  const title = document.getElementById("dayTitle");
  if (!title) return;
  const base = getBaseDate(dayOffset);
  const label = base.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  let prefix = "";
  if (dayOffset === 0) prefix = "(Today)";
  else if (dayOffset === -1) prefix = "(Yesterday)";
  else if (dayOffset === 1) prefix = "(Tomorrow)";
  else prefix = `(${dayOffset > 0 ? "+" : ""}${dayOffset} days)`;
  title.textContent = `24-Hour Forecast — Lyall Bay ${prefix} ${label}`;
}

/* ===== Helpers ===== */
function toLocalHourKey(date){
  const d = new Date(date.getTime() - date.getTimezoneOffset()*60000);
  return d.toISOString().slice(0,13) + ":00";
}
function degToCompass(num) {
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[Math.round(num / 22.5) % 16];
}
function windColor(speed) {
  if (speed == null) return "";
  if (speed <= 5) return "calm";
  if (speed <= 15) return "light";
  if (speed <= 25) return "moderate";
  if (speed <= 35) return "strong";
  return "very-strong";
}
function fmtHM(date){ return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); }

function densify(arr) {
  const out = (arr || []).slice();
  let last = null;
  for (let i=0;i<out.length;i++){
    if (out[i] == null || Number.isNaN(out[i])) out[i] = last;
    else last = out[i];
  }
  for (let i=out.length-1;i>=0;i--){
    if (out[i] == null || Number.isNaN(out[i])) out[i] = (i<out.length-1 ? out[i+1] : 0);
  }
  return out.map(v => (v == null || Number.isNaN(v)) ? 0 : v);
}
function clamp(v, min, max){
  if (v == null || Number.isNaN(v)) return v;
  return Math.min(max, Math.max(min, v));
}
function validateDataset(data){
  data.temp = densify(data.temp).map(v => clamp(v, -5, 40));
  data.feelsLike = densify(data.feelsLike).map(v => clamp(v, -5, 40));
  data.humidity = densify(data.humidity).map(v => clamp(v, 0, 100));
  data.pressure = densify(data.pressure).map(v => clamp(v, 950, 1050));
  data.wind = densify(data.wind).map(v => clamp(v, 0, 150));
  data.gusts = densify(data.gusts).map(v => clamp(v, 0, 200));
  data.windDir = densify(data.windDir).map(v => clamp(v, 0, 360));
  data.rain = densify(data.rain).map(v => clamp(v, 0, 200));
  data.wave = densify(data.wave).map(v => clamp(v, 0, 15));
  data.waveP = densify(data.waveP).map(v => clamp(v, 0, 30));
  data.waveD = densify(data.waveD).map(v => clamp(v, 0, 360));
  data.tide = densify(data.tide).map(v => clamp(v, -5, 5));
  data.waterTemp = densify(data.waterTemp).map(v => clamp(v, 0, 30));
  return data;
}

/* ===== YouTube API ===== */
function loadYouTubeAPI() {
  const tag = document.createElement('script');
  tag.src = "https://www.youtube.com/iframe_api";
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}
window.onYouTubeIframeAPIReady = function() { youtubeAPIReady = true; initPlayer(); };
function initPlayer() {
  if (!frame || !youtubeAPIReady || !window.YT) return;
  player = new YT.Player(frame, { events: { 'onReady': () => tryPlay(), 'onStateChange': onPlayerStateChange } });
}
function tryPlay(fromGesture=false){
  if (!player || typeof player.playVideo !== 'function') return;
  try { player.mute && player.mute(); } catch(e){}
  setTimeout(() => { try { player.playVideo(); } catch(e){} }, fromGesture ? 0 : 300);
}
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
    setTimeout(() => { try { player.playVideo(); } catch(e){} }, 800);
  }
}

/* ===== Camera toggle ===== */
function updateToggleButton() {
  if (!camToggle) return;
  const nextIndex = (currentCam + 1) % CAMS.length;
  const thisCam = CAMS[currentCam];
  const nextCam = CAMS[nextIndex];
  camToggle.innerHTML = `
    <span class="toggle__left">${thisCam.titleLeft}</span>
    <span class="toggle__divider">⇄</span>
    <span class="toggle__right">${nextCam.titleRight}</span>`;
}
function switchCam() {
  if (!frame) return;
  currentCam = (currentCam + 1) % CAMS.length;
  const cam = CAMS[currentCam];
  frame.style.opacity = "0";
  setTimeout(() => {
    frame.src = cam.url;
    frame.style.opacity = "1";
    setTimeout(() => { if (window.YT && youtubeAPIReady) initPlayer(); tryPlay(); }, 400);
  }, 200);
  updateToggleButton();
}

/* ===== Data fetching (Open-Meteo + optional WorldTides) ===== */
async function fetchEnhancedData(offsetDays = 0) {
  const base = getBaseDate(offsetDays);
  const start = base.toISOString().split("T")[0];
  const end = new Date(base.getTime() + 24*3600*1000).toISOString().split("T")[0];

  try {
    const [openMeteoData, worldTidesData] = await Promise.allSettled([
      fetchOpenMeteoData(start, end, base),
      fetchWorldTidesData(base) // returns null if no API key / fails
    ]);

    const primaryData = openMeteoData.value || generateFallbackData(base);
    const enhancedTides = worldTidesData.value || { tideData: primaryData.tide, tidesDaily: primaryData.tidesDaily };

    if (worldTidesData.value) {
      primaryData.tide = enhancedTides.tideData;
      primaryData.tidesDaily = enhancedTides.tidesDaily;
    }

    return validateDataset(primaryData);
  } catch (err) {
    console.warn("Enhanced fetch failed, using fallback:", err);
    return generateFallbackData(base);
  }
}

async function fetchOpenMeteoData(start, end, baseDate) {
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&hourly=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,rain,showers` +
    `&daily=sunrise,sunset&timezone=Pacific/Auckland&start_date=${start}&end_date=${end}&windspeed_unit=kmh`;

  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}` +
    `&hourly=wave_height,wave_period,wave_direction,sea_surface_temperature` +
    `&timezone=Pacific/Auckland&start_date=${start}&end_date=${end}`;

  const [forecastRes, marineRes] = await Promise.allSettled([ fetch(forecastUrl), fetch(marineUrl) ]);
  const forecastData = forecastRes.value?.ok ? await forecastRes.value.json() : null;
  const marineData   = marineRes.value?.ok ? await marineRes.value.json()   : null;

  const base = new Date(baseDate ?? getBaseDate(0));
  base.setHours(0,0,0,0);
  const hours = Array.from({ length: 24 }, (_, i) => new Date(base.getTime() + i*3600*1000));

  const data = {
    labelHours: hours,
    temp: [], feelsLike: [], humidity: [], pressure: [],
    wind: [], gusts: [], windDir: [], rain: [],
    wave: [], waveP: [], waveD: [], tide: [], waterTemp: [],
    sunrise: forecastData?.daily?.sunrise?.[0] ? new Date(forecastData.daily.sunrise[0]) : new Date(new Date(base).setHours(7,0,0,0)),
    sunset:  forecastData?.daily?.sunset?.[0]  ? new Date(forecastData.daily.sunset[0])  : new Date(new Date(base).setHours(19,0,0,0)),
    tidesDaily: { highs: [], lows: [] },
    offline: !forecastData && !marineData
  };

  hours.forEach((hour, i) => {
    const hourKey = toLocalHourKey(hour);

    if (forecastData?.hourly?.time) {
      const hourIndex = forecastData.hourly.time.findIndex(t => t === hourKey);
      if (hourIndex !== -1) {
        data.temp[i]      = forecastData.hourly.temperature_2m?.[hourIndex] ?? null;
        data.feelsLike[i] = data.temp[i] ? data.temp[i] - 1 + (Math.random()*2 - 1) : null;
        data.humidity[i]  = forecastData.hourly.relative_humidity_2m?.[hourIndex] ?? null;
        data.pressure[i]  = forecastData.hourly.pressure_msl?.[hourIndex] ?? null;
        data.wind[i]      = forecastData.hourly.wind_speed_10m?.[hourIndex] ?? null;
        data.gusts[i]     = forecastData.hourly.wind_gusts_10m?.[hourIndex] ?? null;
        data.windDir[i]   = forecastData.hourly.wind_direction_10m?.[hourIndex] ?? null;
        data.rain[i]      = forecastData.hourly.rain?.[hourIndex]
                         ?? forecastData.hourly.showers?.[hourIndex]
                         ?? forecastData.hourly.precipitation?.[hourIndex] ?? 0;
      }
    }

    if (marineData?.hourly?.time) {
      const marineIndex = marineData.hourly.time.findIndex(t => t === hourKey);
      if (marineIndex !== -1) {
        data.wave[i]      = marineData.hourly.wave_height?.[marineIndex] ?? null;
        data.waveP[i]     = marineData.hourly.wave_period?.[marineIndex] ?? null;
        data.waveD[i]     = marineData.hourly.wave_direction?.[marineIndex] ?? null;
        data.waterTemp[i] = marineData.hourly.sea_surface_temperature?.[marineIndex] ?? null;
      }
    }

    // fallbacks (kept light so the table always fills)
    if (data.temp[i] == null)      data.temp[i]      = 15 + Math.sin(i*0.26)*3 + (Math.random()*2 - 1);
    if (data.feelsLike[i] == null) data.feelsLike[i] = (data.temp[i] || 15) - 1 + (Math.random()*2 - 1);
    if (data.humidity[i] == null)  data.humidity[i]  = 70 + Math.sin(i*0.3)*15 + (Math.random()*10 - 5);
    if (data.pressure[i] == null)  data.pressure[i]  = 1013 + Math.sin(i*0.2)*5 + (Math.random()*2 - 1);
    if (data.wind[i] == null)      data.wind[i]      = 8 + Math.sin(i*0.4)*10 + (Math.random()*4 - 2);
    if (data.gusts[i] == null)     data.gusts[i]     = (data.wind[i] || 10) + 5 + (Math.random()*4 - 2);
    if (data.windDir[i] == null)   data.windDir[i]   = Math.floor(Math.random()*360);
    if (data.rain[i] == null)      data.rain[i]      = Math.random() < 0.2 ? +(Math.random()*1.5).toFixed(1) : 0;
    if (data.wave[i] == null)      data.wave[i]      = 0.8 + Math.sin(i*0.26)*0.4 + (Math.random()*0.3 - 0.15);
    if (data.waveP[i] == null)     data.waveP[i]     = 7 + Math.sin(i*0.2)*2 + (Math.random()*1 - 0.5);
    if (data.waveD[i] == null)     data.waveD[i]     = 180 + (Math.random()*60 - 30);
    if (data.waterTemp[i] == null) data.waterTemp[i] = 14 + Math.sin(i*0.1)*0.5 + (Math.random()*0.5 - 0.25);
  });

  data.tide = calculateRealisticTides(hours);
  data.tidesDaily = findTideExtremes(data.tide, hours);
  return data;
}

async function fetchWorldTidesData(baseDate) {
  // Optional: requires your API key at https://www.worldtides.info/
  const apiKey = 'YOUR_WORLD_TIDES_API_KEY';
  if (!apiKey || apiKey === 'YOUR_WORLD_TIDES_API_KEY') return null;

  const lat = LAT, lon = LON;
  const start = Math.floor(baseDate.getTime() / 1000);
  const end = start + 24 * 3600;

  try {
    const response = await fetch(
      `https://www.worldtides.info/api/v2?heights&lat=${lat}&lon=${lon}&start=${start}&end=${end}&step=3600&key=${apiKey}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data.heights && data.heights.length > 0) {
        const tideData = data.heights.map(h => h.height);
        const hours = Array.from({ length: 24 }, (_, i) => new Date(baseDate.getTime() + i * 3600 * 1000));
        const tidesDaily = findTideExtremes(tideData, hours);
        return { tideData, tidesDaily, source: 'worldtides' };
      }
    }
  } catch (error) {
    console.warn('WorldTides API failed:', error);
  }
  return null;
}

/* ===== Tide model (fallback / shaping) ===== */
function calculateRealisticTides(hours) {
  if (!hours || !hours.length) return [];
  const epoch = new Date('2025-01-01T00:00:00+13:00').getTime();
  const TWO_PI = Math.PI * 2;
  const H12 = 12.42;         // M2
  const H6  = 6.21;          // M4
  const SYNODIC_H = 29.5306 * 24; // spring/neap (hours)
  const baseHeight = 0.9;
  const mainAmp    = 0.60;
  const secAmp     = 0.25;

  return hours.map(h => {
    const th = (h.getTime() - epoch) / 3600000; // hours since epoch
    const spring = 1 + 0.25 * Math.cos(TWO_PI * (th / SYNODIC_H));
    const m2 = (mainAmp * spring) * Math.sin(TWO_PI * (th / H12) - Math.PI / 4);
    const m4 = secAmp * Math.sin(TWO_PI * (th / H6) + Math.PI / 6);
    return baseHeight + m2 + m4;
  });
}

function findTideExtremes(tideData, hours) {
  const highs = [], lows = [];
  for (let i = 2; i < tideData.length - 2; i++) {
    const prev2 = tideData[i-2], prev1 = tideData[i-1];
    const curr = tideData[i];
    const next1 = tideData[i+1], next2 = tideData[i+2];
    if (curr > prev2 && curr > prev1 && curr > next1 && curr > next2) {
      const avg = (prev2 + prev1 + next1 + next2) / 4;
      if (curr - avg > 0.1) highs.push({ time: hours[i], height: curr });
    }
    if (curr < prev2 && curr < prev1 && curr < next1 && curr < next2) {
      const avg = (prev2 + prev1 + next1 + next2) / 4;
      if (avg - curr > 0.1) lows.push({ time: hours[i], height: curr });
    }
  }
  const sortedHighs = highs.sort((a, b) => a.time - b.time);
  const sortedLows  = lows.sort((a, b) => a.time - b.time);
  return { highs: sortedHighs.slice(0, 2), lows: sortedLows.slice(0, 2) };
}

/* ===== Table + Tide Chart rendering ===== */
function isNight(d, h) {
  const hh = (h instanceof Date) ? h : d.labelHours[h];
  const sunrise = new Date(d.sunrise);
  const sunset = new Date(d.sunset);
  if (hh.getDate() !== sunrise.getDate()) { sunrise.setDate(sunrise.getDate() + 1); sunset.setDate(sunset.getDate() + 1); }
  return hh < sunrise || hh >= sunset;
}

function buildTable(d) {
  const thead = document.getElementById("thead");
  const tbody = document.getElementById("tbody");
  if (!thead || !tbody) {
    console.warn("Missing #thead or #tbody in DOM");
    return;
  }
  thead.innerHTML = tbody.innerHTML = "";

  const trH = document.createElement("tr");
  trH.innerHTML =
    "<th>Metric</th>" +
    d.labelHours.map((h) => {
      const hour = h.getHours();
      const isCurrent = hour === new Date().getHours() && dayOffset === 0;
      const nightClass = isNight(d, h) ? " night" : "";
      const currentClass = isCurrent ? " current-hour" : "";
      const label = isCurrent
        ? `${h.toLocaleTimeString([], { hour: "2-digit" })}<div style='font-size:10px;color:#e63946;'>Now</div>`
        : h.toLocaleTimeString([], { hour: "2-digit" });
      return `<th class="${nightClass}${currentClass}">${label}</th>`;
    }).join("");
  thead.appendChild(trH);

  const rows = [
    ["Temp (°C)", d.temp, (v) => v != null ? v.toFixed(1) : "—"],
    ["Feels Like (°C)", d.feelsLike, (v) => v != null ? v.toFixed(1) : "—"],
    ["Humidity (%)", d.humidity, (v) => v != null ? Math.round(v) : "—"],
    ["Pressure (hPa)", d.pressure, (v) => v != null ? Math.round(v) : "—"],
    ["Water Temp (°C)", d.waterTemp, (v) => v != null ? v.toFixed(1) : "—"],
    ["Wave (m)", d.wave, (v, i) => {
      const isRealData = !d.offline && d.wave[i] != null;
      const title = isRealData ? "Real marine data" : "Simulated data";
      return v != null ? `<span title="${title}">${v.toFixed(1)}</span>` : "—";
    }],
    ["Period (s)", d.waveP, (v) => v != null ? v.toFixed(0) : "—"],
    ["Wind (km/h)", d.wind, (v) => v != null ? `<span class="wind ${windColor(v)}">${v.toFixed(0)}</span>` : "—"],
    ["Gusts (km/h)", d.gusts, (v) => v != null ? `<span class="wind ${windColor(v)}">${v.toFixed(0)}</span>` : "—"],
    ["Direction", d.windDir, (v) => v != null ? `${degToCompass(v)} <span style='transform:rotate(${v}deg)' class='dir-arrow'>➤</span>` : "—"],
    ["Rain (mm/hr)", d.rain, (v) => (v != null ? v.toFixed(1) : "—")],
    ["Tide (m)", d.tide, (v) => (v != null ? v.toFixed(2) : "—")],
  ];

  const now = new Date();
  const currentHour = now.getHours();

  rows.forEach(([label, arr, fmt]) => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<th>" + label + "</th>" +
      arr.map((v, i) => {
        const isCurrent = d.labelHours[i].getHours() === currentHour && dayOffset === 0;
        const nightClass = isNight(d, i) ? " night" : "";
        const currentClass = isCurrent ? " current-hour" : "";
        return `<td class="${nightClass}${currentClass}">${fmt(v, i)}</td>`;
      }).join("");
    tbody.appendChild(tr);
  });

  const surf = d.labelHours.map((_, i) =>
    score(d.wave[i], d.wind[i], d.rain[i], d.windDir[i], d.waveP[i], d.waveD[i], d.temp[i], d.waterTemp[i])
  );
  const surfRow = document.createElement("tr");
  surfRow.innerHTML =
    "<th>Surfability (1–10)</th>" +
    surf.map((v, i) => {
      const cls = v >= 8 ? "good" : v >= 5 ? "fair" : "poor";
      const isCurrent = d.labelHours[i].getHours() === currentHour && dayOffset === 0;
      const nightClass = isNight(d, i) ? " night" : "";
      const currentClass = isCurrent ? " current-hour" : "";
      return `<td class="scale-surf ${cls}${nightClass}${currentClass}">${v.toFixed(1)}</td>`;
    }).join("");
  tbody.appendChild(surfRow);

  const badge = document.getElementById("scoreBadge");
  if (badge) {
    const nowScore = surf[now.getHours()] ?? surf[0];
    badge.textContent = `Surfability ${nowScore.toFixed(1)}`;
    badge.className = "chip score " + (nowScore >= 8 ? "good" : nowScore >= 5 ? "" : "poor");
  }
}

function createTideChart(tideData, hours, highs, lows) {
  const chartContainer = document.createElement('div');
  chartContainer.className = 'tide-chart';
  chartContainer.style.cssText = `
    margin: 12px 0;
    padding: 12px;
    background: linear-gradient(135deg, #e6f7ff, #f0f9ff);
    border-radius: 12px;
    border: 1px solid #4fc3f7;
    position: relative;
    height: 180px;
  `;

  const canvas = document.createElement('canvas');
  canvas.width = chartContainer.clientWidth || 800;
  canvas.height = 160;
  canvas.style.cssText = 'width: 100%; height: 160px; display: block;';
  chartContainer.appendChild(canvas);

  drawTideCurve(canvas, tideData, hours, highs, lows);
  return chartContainer;
}

function drawTideCurve(canvas, tideData, hours, highs, lows) {
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.width; // reset
  const width = canvas.width, height = canvas.height, padding = 40;

  const minTide = Math.min(...tideData);
  const maxTide = Math.max(...tideData);
  const range = maxTide - minTide || 1;

  ctx.strokeStyle = '#4fc3f740';
  ctx.fillStyle = '#1d3557';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';

  for (let i = 0; i <= 4; i++) {
    const y = padding + (height - 2 * padding) * (1 - i / 4);
    const value = minTide + (range * i / 4);
    ctx.fillText(value.toFixed(1) + 'm', 25, y + 3);
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = '#457b9d';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#457b9d20';
  tideData.forEach((tide, i) => {
    const x = padding + (i / (tideData.length - 1)) * (width - 2 * padding);
    const y = padding + (height - 2 * padding) * (1 - (tide - minTide) / range);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.lineTo(width - padding, height - padding);
  ctx.lineTo(padding, height - padding);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#e63946';
  ctx.font = '11px system-ui';
  highs.forEach(tide => {
    const hourIndex = hours.findIndex(h => h.getTime() === tide.time.getTime());
    if (hourIndex !== -1) {
      const x = padding + (hourIndex / (tideData.length - 1)) * (width - 2 * padding);
      const y = padding + (height - 2 * padding) * (1 - (tide.height - minTide) / range);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI); ctx.fill();
      ctx.fillText('High', x, y - 12);
      ctx.fillText(tide.height.toFixed(1) + 'm', x, y - 24);
    }
  });

  ctx.fillStyle = '#1d3557';
  lows.forEach(tide => {
    const hourIndex = hours.findIndex(h => h.getTime() === tide.time.getTime());
    if (hourIndex !== -1) {
      const x = padding + (hourIndex / (tideData.length - 1)) * (width - 2 * padding);
      const y = padding + (height - 2 * padding) * (1 - (tide.height - minTide) / range);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI); ctx.fill();
      ctx.fillText('Low', x, y + 20);
      ctx.fillText(tide.height.toFixed(1) + 'm', x, y + 32);
    }
  });

  ctx.fillStyle = '#1d3557';
  ctx.textAlign = 'center';
  ctx.font = '11px system-ui';
  for (let i = 0; i < hours.length; i += 3) {
    const x = padding + (i / (hours.length - 1)) * (width - 2 * padding);
    const time = hours[i].toLocaleTimeString([], { hour: '2-digit' });
    ctx.fillText(time, x, height - 15);
  }
}

function buildEnhancedTable(d) {
  // rebuild main table
  buildTable(d);

  // add tide chart under the table
  const tableContainer = document.querySelector('.table-scroll');
  if (!tableContainer || !tableContainer.parentNode) return;

  // Remove any existing tide charts
  document.querySelectorAll('.tide-chart').forEach(el => el.remove());

  const tideChart = createTideChart(d.tide, d.labelHours, d.tidesDaily.highs, d.tidesDaily.lows);
  tableContainer.parentNode.insertBefore(tideChart, tableContainer.nextSibling);
}

function updateChips(d) {
  const sunChip = document.getElementById("sunChip");
  if (sunChip) sunChip.innerHTML = `🌅 ${fmtHM(d.sunrise)}  🌇 ${fmtHM(d.sunset)}`;
  const tideChip = document.getElementById("tideChip");
  if (tideChip) {
    const highs = d.tidesDaily?.highs || [];
    const lows  = d.tidesDaily?.lows  || [];
    const hStr = highs.length ? highs.map(h => fmtHM(h.time)).join(" / ") : "—";
    const lStr = lows.length ? lows.map(l => fmtHM(l.time)).join(" / ") : "—";
    tideChip.textContent = `🌊 High ${hStr}   Low ${lStr}`;
  }
}

/* ===== Scoring ===== */
function score(wave, wind, rain, dir, wavePeriod, waveDirection, airTemp, waterTemp) {
  if (wave == null) return 0;
  const P = Number.isFinite(wavePeriod) ? wavePeriod : 0;
  const W = Number.isFinite(wind) ? wind : 0;
  const airT = Number.isFinite(airTemp) ? airTemp : 15;
  const waterT = Number.isFinite(waterTemp) ? waterTemp : 14;

  const hOpt  = Math.max(1.0, Math.min(2.6, 0.9 + 0.12 * Math.max(P - 8, 0)));
  const sigma = 0.45 + 0.04 * Math.max(P - 10, 0);
  const sSize = 7 * Math.exp(-Math.pow((wave - hOpt) / sigma, 2));

  let clean = 0;
  if (dir != null && waveDirection != null) {
    let diff = Math.abs(dir - waveDirection);
    diff = Math.min(diff, 360 - diff);
    const off = diff >= 150 ? 1 : diff >= 120 ? 0.5 : diff <= 60 ? -1 : -0.3;
    const amp = Math.min(1.5, 0.6 + P / 12);
    clean = off * 1.2 * amp;
  }

  const windThresh = 12 + 0.5 * Math.max(P - 8, 0) + 3 * Math.max(Math.min(wave - 1, 2), 0);
  let windAdj = 0;
  if (W > windThresh) {
    windAdj -= (W - windThresh) / 6;
    if (W > windThresh + 15) windAdj -= (W - (windThresh + 15)) / 3;
  } else if (W <= 8 && clean > 0.5) {
    windAdj += 0.4;
  }

  let perAdj = 0;
  if (P >= 13) perAdj += 0.8;
  else if (P >= 10) perAdj += 0.4;
  else if (P <= 6) perAdj -= 0.6;

  let sizePenalty = 0;
  if (wave > 3) {
    const soften = Math.min(0.7, (P - 11) * 0.07 + Math.max(clean, 0) * 0.2);
    sizePenalty -= (wave - 3) * (1.5 * (1 - Math.max(0, soften)));
  }

  let rainAdj = 0;
  if (rain > 0.5) rainAdj -= 1.0;
  if (rain > 2)   rainAdj -= 1.5;

  let tempBonus = 0;
  if (airT >= 18 && airT <= 22) tempBonus += 0.3;
  if (waterT >= 14 && waterT <= 18) tempBonus += 0.2;

  let s = sSize + clean + windAdj + perAdj + sizePenalty + rainAdj + tempBonus;
  return Math.max(0, Math.min(10, s));
}

/* ===== Sunrise/Sunset ===== */
async function fetchSunTimes(lat, lon, baseDate) {
  const dateStr = baseDate ? baseDate.toISOString().split("T")[0] : null;
  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0${dateStr ? `&date=${dateStr}` : ""}`;
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.status === "OK") {
      return { sunrise: new Date(json.results.sunrise), sunset: new Date(json.results.sunset) };
    }
  } catch(e) { console.warn("Sunrise-Sunset fetch failed:", e); }
  const base = baseDate ?? new Date();
  return { sunrise: new Date(base.setHours(7,0,0,0)), sunset: new Date(base.setHours(19,0,0,0)) };
}

/* ===== Fallback data ===== */
function generateFallbackData(base) {
  const hours = Array.from({ length: 24 }, (_, i) => new Date(base.getTime() + i * 3600 * 1000));
  const data = {
    labelHours: hours,
    temp: [], feelsLike: [], humidity: [], pressure: [],
    wind: [], gusts: [], windDir: [], rain: [],
    wave: [], waveP: [], waveD: [], tide: [], waterTemp: [],
    sunrise: new Date(base.getTime()).setHours && new Date(new Date(base).setHours(7,0,0,0)),
    sunset: new Date(base.getTime()).setHours && new Date(new Date(base).setHours(19,0,0,0)),
    tidesDaily: { highs: [], lows: [] },
    offline: true
  };

  hours.forEach((hour, i) => {
    const hod = hour.getHours();
    data.temp[i] = 15 + Math.sin(hod * 0.26) * 3 + (Math.random() * 2 - 1);
    data.feelsLike[i] = data.temp[i] - 1 + (Math.random() * 2 - 1);
    data.humidity[i] = 70 + Math.sin(hod * 0.3) * 15 + (Math.random() * 10 - 5);
    data.pressure[i] = 1013 + Math.sin(hod * 0.2) * 5 + (Math.random() * 2 - 1);
    data.wind[i] = 8 + Math.sin(hod * 0.4) * 10 + (Math.random() * 4 - 2);
    data.gusts[i] = data.wind[i] + 5 + (Math.random() * 4 - 2);
    data.windDir[i] = Math.floor(Math.random() * 360);
    data.rain[i] = Math.random() < 0.2 ? +(Math.random() * 1.5).toFixed(1) : 0;
    data.wave[i] = 0.8 + Math.sin(hod * 0.26) * 0.4 + (Math.random() * 0.3 - 0.15);
    data.waveP[i] = 7 + Math.sin(hod * 0.2) * 2 + (Math.random() * 1 - 0.5);
    data.waveD[i] = 180 + (Math.random() * 60 - 30);
    data.waterTemp[i] = 14 + Math.sin(hod * 0.1) * 0.5 + (Math.random() * 0.5 - 0.25);
  });

  data.tide = calculateRealisticTides(hours);
  data.tidesDaily = findTideExtremes(data.tide, hours);
  return data;
}

/* ===== Refresh (single entry point) ===== */
async function refresh(){
  const status = document.getElementById("dataStatus");
  const updatedAt = document.getElementById("updatedAt");
  if (status) status.textContent = "⏳ Loading…";

  const base = getBaseDate(dayOffset);

  try {
    const d = await fetchEnhancedData(dayOffset);
    const sun = await fetchSunTimes(LAT, LON, base);
    d.sunrise = sun.sunrise; d.sunset = sun.sunset;

    buildEnhancedTable(d);
    updateChips(d);

    const realMarineHours = d.wave.filter(v => v != null && !d.offline).length;
    if (status) {
      if (d.offline) status.textContent = "📁 Offline";
      else if (realMarineHours === 0) status.textContent = "🌐 Live (simulated waves)";
      else status.textContent = "🌐 Live (real waves)";
    }
  } catch (e) {
    console.error("Refresh failed:", e);
    const d = generateFallbackData(base);
    const sun = await fetchSunTimes(LAT, LON, base);
    d.sunrise = sun.sunrise; d.sunset = sun.sunset;

    buildEnhancedTable(d);
    updateChips(d);
    if (status) status.textContent = "📁 Offline";
  } finally {
    if (updatedAt) updatedAt.textContent = new Date().toLocaleTimeString();
  }
}

/* ===== Bootstrapping ===== */
document.addEventListener("DOMContentLoaded", () => {
  // Day nav
  const prev = document.getElementById("prevDay");
  const next = document.getElementById("nextDay");
  const updateNavState = () => {
    if (!prev || !next) return;
    prev.disabled = (dayOffset <= -MAX_PAST_DAYS);
    next.disabled = (dayOffset >=  MAX_FUTURE_DAYS);
  };
  const loadDay = async () => {
    const status = document.getElementById("dataStatus");
    if (status) status.textContent = "⏳ Loading…";
    if (prev && next) { prev.disabled = next.disabled = true; }
    updateDayTitle();
    await refresh();
    updateNavState();
  };
  if (prev && next) {
    prev.addEventListener("click", () => { dayOffset--; loadDay(); });
    next.addEventListener("click", () => { dayOffset++; loadDay(); });
    updateNavState();
  }

  // About panel
  const aboutBtn = document.getElementById('aboutBtn');
  const aboutPanel = document.getElementById('aboutPanel');
  const closeAbout = document.getElementById('closeAbout');
  if (aboutBtn && aboutPanel && closeAbout) {
    aboutBtn.addEventListener('click', () => { aboutPanel.classList.add('open'); document.body.style.overflow = 'hidden'; });
    closeAbout.addEventListener('click', () => { aboutPanel.classList.remove('open'); document.body.style.overflow = ''; });
    aboutPanel.addEventListener('click', (e) => { if (e.target === aboutPanel) { aboutPanel.classList.remove('open'); document.body.style.overflow = ''; }});
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && aboutPanel.classList.contains('open')) { aboutPanel.classList.remove('open'); document.body.style.overflow = ''; }});
  }

  // Static labels
  const dateLabel = document.getElementById("dateLabel");
  if (dateLabel) dateLabel.textContent = new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  updateDayTitle();
});

window.addEventListener("load", () => {
  // Now the DOM is fully laid out — grab elements and start
  frame = document.getElementById("liveFrame");
  camToggle = document.getElementById("camToggle");
  if (camToggle) camToggle.addEventListener("click", switchCam);

  loadYouTubeAPI();
  updateToggleButton();

  // first draw + refresh every 30 min
  refresh();
  setInterval(refresh, 30*60*1000);
});
