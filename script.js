// ===== v6.4.1 Table-fix build =====

const LAT = -41.327, LON = 174.794;
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0";

const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let showingSurf = true;

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
  }, 250);
});
setToggle();

// Force autoplay on load for iOS/Safari
window.addEventListener('load', () => {
  const frame = document.getElementById('liveFrame');
  // Replace the src to re-trigger autoplay with mute param
  if (frame && !frame.src.includes('autoplay=1')) {
    frame.src = SURF_EMBED;
  } else {
    // Light poke to start playback
    const temp = frame.src;
    frame.src = '';
    setTimeout(() => frame.src = temp, 300);
  }
});


document.getElementById("dateLabel").textContent =
  new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });

/* ---------- Utility helpers ---------- */
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

/* ---------- Fetch + align Open-Meteo data ---------- */
async function fetchData() {
  const forecast = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&daily=sunrise,sunset&timezone=auto&windspeed_unit=kmh`;
  const marine   = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_period,wave_direction&timezone=auto`;
  const tide     = `https://marine-api.open-meteo.com/v1/tide?latitude=${LAT}&longitude=${LON}&hourly=tide_height&timezone=auto`;

  try {
    const [fR, mR, tR] = await Promise.allSettled([
      fetch(forecast), fetch(marine), fetch(tide)
    ]);
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

/* ---------- Table building ---------- */
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

 

  // Surfability
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


function isNight(d,h){
  const hh = (h instanceof Date)? h : d.labelHours[h];
  return hh<new Date(d.sunrise)||hh>=new Date(d.sunset);
}
 /* ---------- Sunrise / Sunset + Tide Extremes Display ---------- */

function findTideExtremes(tideHeights, hours) {
  const highs = [], lows = [];
  for (let i = 1; i < tideHeights.length - 1; i++) {
    const prev = tideHeights[i - 1], curr = tideHeights[i], next = tideHeights[i + 1];
    if (curr > prev && curr > next) highs.push(hours[i]);
    if (curr < prev && curr < next) lows.push(hours[i]);
  }
  // Pick the next upcoming high/low relative to now
  return {
    nextHigh: highs.find(t => t > new Date()) || highs[0],
    nextLow:  lows.find(t => t > new Date())  || lows[0]
  };
}

function updateChips(d) {
  /* 🌅🌇 Sunrise / Sunset */
  const s = new Date(d.sunrise), e = new Date(d.sunset);
  const sunChip = document.getElementById("sunChip");
  sunChip.innerHTML = `🌅 ${s.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}  ` +
                      `🌇 ${e.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}`;

  /* 🌊 Tide High / Low */
  if (d.tide && d.labelHours) {
    const tides = findTideExtremes(d.tide, d.labelHours);
    const tideChip = document.getElementById("tideChip");
    tideChip.innerHTML = `🌊 ${tides.nextHigh.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})} ↑ / ` +
                         `${tides.nextLow.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})} ↓`;
  }
}
/* ---------- Scoring ---------- */
function score(wave,wind,rain,dir){
  if(wave==null) return 0;
  let s=10 - Math.abs(wave-1)*5;
  s -= wind>20? (wind-20)/5 : 0;
  if(rain>0.5) s-=2;
  if(dir && (dir<200||dir>340)) s+=1; // offshore bump
  return Math.max(0,Math.min(10,s));
}

/* ---------- Run loop ---------- */
async function refresh(){
  const fallback=offlineData();
  buildTable(fallback); // instant draw
  document.getElementById("dataStatus").textContent="⏳ loading...";
  try{
    const d = await fetchData();
    buildTable(d);
    updateChips(d);
    document.getElementById("dataStatus").textContent = d.offline?"📁 Offline":"🌐 Live";
  }catch(e){
    console.error(e);
  }
}
refresh();
setInterval(refresh,30*60*1000);
