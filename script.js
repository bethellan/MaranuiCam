// ===== v5 Logic: Surf/Airport switch, animated bars, charts, gusts, directions, tides =====

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Location: Lyall Bay approx
const LAT = -41.327, LON = 174.794;

// Camera URLs
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0"; // from your link

// Switch behaviour
const frame = document.getElementById('liveFrame');
const switchBtn = document.getElementById('camSwitch');
let showingSurf = true;
switchBtn.addEventListener('click', ()=>{
  showingSurf = !showingSurf;
  // fade
  frame.style.opacity = '0';
  setTimeout(()=>{
    frame.src = showingSurf ? SURF_EMBED : AIRPORT_EMBED;
    switchBtn.classList.toggle('switch--surf', showingSurf);
    switchBtn.classList.toggle('switch--airport', !showingSurf);
    switchBtn.setAttribute('aria-pressed', String(showingSurf));
    switchBtn.innerHTML = showingSurf ? "Surf <span class='divider'>/</span> <span class='alt'>Airport</span>" : "Airport <span class='divider'>/</span> <span class='alt'>Surf</span>";
    frame.style.opacity = '1';
  }, 200);
});

// Date label
function todayLabel(){
  const d = new Date();
  return d.toLocaleDateString([], {weekday:'long', day:'numeric', month:'short'});
}
document.getElementById('dateLabel').textContent = todayLabel();

// Night shading plugin
const NightShade = (ranges)=>({
  id: 'nightShade',
  beforeDraw(chart,args,opts){
    const {ctx, chartArea:{top,bottom}, scales:{x}} = chart;
    if(!x) return;
    ctx.save();
    ctx.fillStyle = 'rgba(6,7,20,0.15)';
    ranges.forEach(r=>{
      const xStart = x.getPixelForValue(r.start);
      const xEnd = x.getPixelForValue(r.end);
      ctx.fillRect(xStart, top, xEnd - xStart, bottom - top);
    });
    ctx.restore();
  }
});

// Data fetch (Open-Meteo Forecast + Marine)
async function getData(){
  const now = new Date();
  const baseHour = new Date(now); baseHour.setMinutes(0,0,0);

  const hours = Array.from({length:24}, (_,i)=> new Date(baseHour.getTime() + i*3600*1000));

  const forecastURL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&daily=sunrise,sunset&timezone=auto&windspeed_unit=kmh`;
  const marineURL   = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_period,wave_direction&timezone=auto`;

  const [fRes, mRes] = await Promise.all([fetch(forecastURL), fetch(marineURL)]);
  const [f, m] = await Promise.all([fRes.json(), mRes.json()]);

  const idxF = Object.fromEntries((f.hourly.time||[]).map((t,i)=>[t,i]));
  const idxM = Object.fromEntries((m.hourly.time||[]).map((t,i)=>[t,i]));
  const toISOhr = d => new Date(d).toISOString().slice(0,13)+":00";

  const labels = [], wind=[], gusts=[], windDir=[], rain=[], wave=[], wavePeriod=[], waveDir=[];
  hours.forEach(h=>{
    const iso = toISOhr(h);
    const iF = idxF[iso]; const iM = idxM[iso];
    labels.push(h);
    wind.push(iF!=null ? f.hourly.wind_speed_10m[iF] : null);
    gusts.push(iF!=null ? f.hourly.wind_gusts_10m?.[iF] ?? null : null);
    windDir.push(iF!=null ? f.hourly.wind_direction_10m[iF] : null);
    rain.push(iF!=null ? f.hourly.precipitation[iF] : null);
    wave.push(iM!=null ? m.hourly.wave_height[iM] : null);
    wavePeriod.push(iM!=null ? m.hourly.wave_period[iM] : null);
    waveDir.push(iM!=null ? m.hourly.wave_direction[iM] : null);
  });

  // Sunrise/sunset for night shading
  const sunrise0 = new Date(f.daily.sunrise[0]);
  const sunset0  = new Date(f.daily.sunset[0]);
  const sunrise1 = f.daily.sunrise[1] ? new Date(f.daily.sunrise[1]) : null;

  const start = hours[0], end = hours[hours.length-1];
  const ranges = [];
  if(start < sunrise0) ranges.push({start, end: sunrise0});
  if(sunset0 < end){
    ranges.push({start: sunset0, end: sunrise1 && sunrise1 < end ? sunrise1 : end});
  }

  document.getElementById('sunriseLabel').textContent = '☀️ Sunrise: ' + sunrise0.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  document.getElementById('sunsetLabel').textContent  = '🌇 Sunset: '  + sunset0.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  return {labels, wind, gusts, windDir, rain, wave, wavePeriod, waveDir, ranges};
}

// Charts
let waveChart, windChart, rainChart;

function buildCharts(d){
  const {labels, wave, wind, rain, ranges, gusts} = d;
  const common = {
    type:'line',
    options:{
      responsive:true,
      maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      scales:{ x:{type:'time', time:{unit:'hour', displayFormats:{hour:'HH:mm'}}}, y:{beginAtZero:true}},
      plugins:{ legend:{display:true}, tooltip:{ callbacks:{ title:(items)=> items[0]?.label ? new Date(items[0].label).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '' } } }
    },
    plugins:[NightShade(ranges)]
  };

  // Wave
  const waveCfg = JSON.parse(JSON.stringify(common));
  waveCfg.data = { labels, datasets:[{label:'Wave Height (m)', data:wave, tension:.3, borderWidth:2}] };
  waveChart = new Chart(document.getElementById('waveChart').getContext('2d'), waveCfg);

  // Wind (with gusts)
  const windCfg = JSON.parse(JSON.stringify(common));
  windCfg.data = { labels, datasets:[
    {label:'Wind Speed (km/h)', data:wind, tension:.3, borderWidth:2},
    {label:'Gusts (km/h)', data:gusts, tension:.3, borderWidth:2, borderDash:[6,4]}
  ]};
  windChart = new Chart(document.getElementById('windChart').getContext('2d'), windCfg);

  // Rain
  const rainCfg = JSON.parse(JSON.stringify(common));
  rainCfg.data = { labels, datasets:[{label:'Rain (mm/hr)', data:rain, stepped:true, borderWidth:2, tension:.3}] };
  rainChart = new Chart(document.getElementById('rainChart').getContext('2d'), rainCfg);
}

function updateCharts(d){
  [waveChart, windChart, rainChart].forEach(c=>{ c.data.labels = d.labels; });
  waveChart.data.datasets[0].data = d.wave;
  windChart.data.datasets[0].data = d.wind;
  windChart.data.datasets[1].data = d.gusts;
  rainChart.data.datasets[0].data = d.rain;
  waveChart.config.plugins = [NightShade(d.ranges)];
  windChart.config.plugins = [NightShade(d.ranges)];
  rainChart.config.plugins = [NightShade(d.ranges)];
  waveChart.update(); windChart.update(); rainChart.update();
}

// Helpers
function degToCompass(num){
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[Math.round(num/22.5) % 16];
}

// Surfability score 1–10
function computeScore(d){
  const n=12;
  const avg = (arr)=>{ const s=arr.slice(0,n).filter(v=>v!=null); return s.length? s.reduce((a,b)=>a+b,0)/s.length : null; };
  const avgWave=avg(d.wave), avgWind=avg(d.wind), avgRain=avg(d.rain);
  let score=0;
  if(avgWave!=null){ const diff=Math.abs(avgWave-1.15); score += Math.max(0, Math.min(4, 4-(diff/0.35)*4)); }
  if(avgWind!=null){ score += avgWind<=10?3:avgWind<=18?2.5:avgWind<=25?2:avgWind<=35?1:0; }
  if(avgRain!=null){ score += avgRain<0.2?2:avgRain<1?1:0; }
  const d0=d.windDir?.[0]; if(typeof d0==='number'){ if(d0>=285&&d0<=325) score+=1; else if((d0>=260&&d0<285)||(d0>325&&d0<=340)) score+=0.5; }
  return Math.max(0, Math.min(10, +score.toFixed(1)));
}

function applyScore(score){
  const badge = document.getElementById('scoreBadge');
  const detail = document.getElementById('scoreDetail');
  let cls='--fair', label='FAIR', emoji='🟡';
  if(score>=8){cls='--good'; label='GOOD'; emoji='🟢';}
  else if(score<5){cls='--poor'; label='POOR'; emoji='🔴';}
  badge.textContent = `${emoji} ${label} ${score}/10`;
  badge.className = 'score-badge ' + cls;
  detail.textContent = `Surfability today: ${label}.`;
}
const style = document.createElement('style');
style.textContent = `.score-badge.--good{background:var(--good)} .score-badge.--fair{background:var(--fair)} .score-badge.--poor{background:var(--poor)}`;
document.head.appendChild(style);

// Update meta lines (wave period/direction, wind direction + arrow)
function updateMeta(d){
  const wP = d.wavePeriod?.[0], wD = d.waveDir?.[0];
  const txt = `Period ${wP!=null? wP.toFixed(0):'—'} s · Dir ${wD!=null? degToCompass(wD):'—'}`;
  document.getElementById('waveMeta').textContent = txt;

  const dir = d.windDir?.[0];
  if(typeof dir==='number'){
    document.getElementById('windDirText').textContent = degToCompass(dir);
    document.getElementById('windArrow').style.transform = `rotate(${dir}deg)`;
  }
}

// Tides best-effort via Open-Meteo tide (fallback is link)
async function updateTides(){
  try{
    const url = `https://marine-api.open-meteo.com/v1/tide?latitude=${LAT}&longitude=${LON}&hourly=tide_height&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const times = j?.hourly?.time || [];
    const heights = j?.hourly?.tide_height || [];
    if(!times.length) return;
    const now = new Date();
    let nextHigh=null, nextLow=null;
    for(let i=1;i<heights.length-1;i++){
      const prev=heights[i-1], cur=heights[i], nxt=heights[i+1];
      const t=new Date(times[i]);
      if(t<=now) continue;
      if(cur>prev && cur>nxt && !nextHigh){ nextHigh=t; }
      if(cur<prev && cur<nxt && !nextLow){ nextLow=t; }
      if(nextHigh && nextLow) break;
    }
    if(nextHigh) document.getElementById('tideHigh').textContent = nextHigh.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if(nextLow)  document.getElementById('tideLow').textContent  = nextLow.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  }catch(e){/* ignore */}
}

// Main updater
async function updateAll(){
  try{
    const d = await getData();
    if(!window._chartsBuilt){ buildCharts(d); window._chartsBuilt=true; } else { updateCharts(d); }
    applyScore(computeScore(d));
    updateMeta(d);
  }catch(e){
    document.getElementById('scoreDetail').textContent = 'Could not fetch conditions. Check connection.';
  }
  updateTides();
}

updateAll();
setInterval(updateAll, 30*60*1000);
