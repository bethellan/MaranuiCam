// ===== v6.3 Logic: Coloured sunrise/sunset icons, combined tide chip, fixed 24h table =====

// Year
document.getElementById('year').textContent = new Date().getFullYear();

// Location: Lyall Bay approx
const LAT = -41.327, LON = 174.794;

// Camera URLs
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0";

// Switch behaviour
const frame = document.getElementById('liveFrame');
const switchBtn = document.getElementById('camSwitch');
let showingSurf = true;

function toggleCamera() {
  showingSurf = !showingSurf;
  frame.classList.add('fade');
  setTimeout(() => {
    frame.src = showingSurf ? SURF_EMBED : AIRPORT_EMBED;
    switchBtn.textContent = showingSurf ? "Surf / Airport" : "Airport / Surf";
    frame.classList.remove('fade');
  }, 300);
}

switchBtn.addEventListener('click', toggleCamera);


// Date label
function todayLabel(){
  const d = new Date();
  return d.toLocaleDateString([], {weekday:'long', day:'numeric', month:'short'});
}
document.getElementById('dateLabel').textContent = todayLabel();

// Fallback generator (if live calls fail)
function makeFallback(){
  const now = new Date(); const base = new Date(now); base.setMinutes(0,0,0);
  const hours = Array.from({length:24}, (_,i)=> new Date(base.getTime()+i*3600*1000));
  const wave = hours.map((_,i)=> +(1.0 + 0.6*Math.sin(i/3)).toFixed(1));
  const waveP= hours.map((_,i)=> 9 + Math.round(2*Math.sin(i/4)));
  const wind = hours.map((_,i)=> 12 + Math.round(8*Math.cos(i/5)));
  const gusts= wind.map(v=> v + 6);
  const windDir = hours.map((_,i)=> (300 + (i%6)*5) % 360);
  const rain = hours.map((_,i)=> (i%7===0)? +(Math.random()*1.2).toFixed(1): 0);
  const tide = hours.map((_,i)=> +(1.2 + 0.6*Math.sin(i/3)).toFixed(2));
  const sunrise = new Date(base); sunrise.setHours(7,0,0,0);
  const sunset  = new Date(base); sunset.setHours(19,0,0,0);
  const nightCols = new Set();
  hours.forEach((h, idx)=>{ if(h < sunrise || h >= sunset) nightCols.add(idx); });
  return {labelHours:hours, wave, waveP, wind, gusts, windDir, rain, tide, nightCols, sunrise, sunset, offline:true};
}

// Fetch Open-Meteo with resilience
async function fetchData(){
  const now = new Date();
  const baseHour = new Date(now); baseHour.setMinutes(0,0,0);
  const hours = Array.from({length:24}, (_,i)=> new Date(baseHour.getTime() + i*3600*1000));

  const forecastURL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&daily=sunrise,sunset&timezone=auto&windspeed_unit=kmh`;
  const marineURL   = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_period,wave_direction&timezone=auto`;
  const tideURL     = `https://marine-api.open-meteo.com/v1/tide?latitude=${LAT}&longitude=${LON}&hourly=tide_height&timezone=auto`;

  try{
    const [fRes, mRes, tRes] = await Promise.all([fetch(forecastURL), fetch(marineURL), fetch(tideURL)]);
    if(!fRes.ok || !mRes.ok || !tRes.ok) throw new Error('HTTP failure');
    const [f, m, t] = await Promise.all([fRes.json(), mRes.json(), tRes.json()]);

    if(!f?.hourly?.time?.length || !m?.hourly?.time?.length){
      throw new Error('Empty data');
    }

    const idxF = Object.fromEntries(f.hourly.time.map((t,i)=>[t,i]));
    const idxM = Object.fromEntries(m.hourly.time.map((t,i)=>[t,i]));
    const idxT = Object.fromEntries((t.hourly?.time||[]).map((tt,i)=>[tt,i]));
    const toISOhr = d => new Date(d).toISOString().slice(0,13)+":00";

    const labelHours = [], wind=[], gusts=[], windDir=[], rain=[], wave=[], waveP=[], tide=[], waveD=[];
    hours.forEach(h=>{
      const iso = toISOhr(h);
      const iF = idxF[iso], iM = idxM[iso], iT = idxT[iso];
      labelHours.push(h);
      wind.push(iF!=null? f.hourly.wind_speed_10m[iF] : null);
      gusts.push(iF!=null? f.hourly.wind_gusts_10m?.[iF] ?? null : null);
      windDir.push(iF!=null? f.hourly.wind_direction_10m[iF] : null);
      rain.push(iF!=null? f.hourly.precipitation[iF] : null);
      wave.push(iM!=null? m.hourly.wave_height[iM] : null);
      waveP.push(iM!=null? m.hourly.wave_period[iM] : null);
      waveD.push(iM!=null? m.hourly.wave_direction[iM] : null);
      tide.push(iT!=null? t.hourly?.tide_height?.[iT] ?? null : null);
    });

    const sunrise0 = new Date(f.daily.sunrise[0]);
    const sunset0  = new Date(f.daily.sunset[0]);
    const sunrise1 = f.daily.sunrise[1] ? new Date(f.daily.sunrise[1]) : null;

    const nightCols = new Set();
    labelHours.forEach((h, idx)=>{
      if(h < sunrise0 || h >= sunset0) nightCols.add(idx);
      if(sunset0 < labelHours[0] && sunrise1 && h < sunrise1) nightCols.add(idx);
    });

    return {labelHours, wind, gusts, windDir, rain, wave, waveP, waveD, tide, nightCols, sunrise:sunrise0, sunset:sunset0, offline:false};
  }catch(e){
    console.warn('Falling back to offline sample:', e);
    return makeFallback();
  }
}

// Helpers
function degToCompass(num){
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[Math.round(num/22.5) % 16];
}

// Surfability score (per-hour)
function hourlyScore(wave, wind, rain, dir){
  let s=0;
  if(wave!=null){
    const diff = Math.abs(wave - 1.15);
    s += Math.max(0, Math.min(4, 4 - (diff/0.35)*4));
  }
  if(wind!=null){
    s += wind<=10?3:wind<=18?2.5:wind<=25?2:wind<=35?1:0;
  }
  if(rain!=null){
    s += rain<0.2?2:rain<1?1:0;
  }
  if(typeof dir==='number'){
    if(dir>=285&&dir<=325) s+=1; else if((dir>=260&&dir<285)||(dir>325&&dir<=340)) s+=0.5;
  }
  return Math.max(0, Math.min(10, +s.toFixed(1)));
}

// Build table
function buildTable(d){
  const thead = document.getElementById('thead');
  const tbody = document.getElementById('tbody');
  thead.innerHTML = ''; tbody.innerHTML='';

  const trH = document.createElement('tr');
  const th0 = document.createElement('th'); th0.textContent = 'Metric'; trH.appendChild(th0);
  d.labelHours.forEach((h, idx)=>{
    const th = document.createElement('th');
    th.textContent = h.toLocaleTimeString([], {hour:'2-digit'});
    if(d.nightCols.has(idx)) th.classList.add('night');
    trH.appendChild(th);
  });
  thead.appendChild(trH);

  function addRow(label, values, formatter, scaleClassFn){
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.textContent = label; tr.appendChild(th);
    values.forEach((v, idx)=>{
      const td = document.createElement('td');
      let txt = (formatter? formatter(v, idx): (v==null?'—':v));
      if (typeof txt === 'string') td.innerHTML = txt; else td.textContent = txt;
      if(d.nightCols.has(idx)) td.classList.add('night');
      if(scaleClassFn){ const cls = scaleClassFn(v); if(cls) td.classList.add(cls); }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  addRow('Wave (m)', d.wave, (v)=> v==null?'—':v.toFixed(1), (v)=>{
    if(v==null) return '';
    if(v<0.8) return 'scale-wave low';
    if(v<1.8) return 'scale-wave ok';
    if(v<2.5) return 'scale-wave high';
    return 'scale-wave very';
  });

  addRow('Period (s)', d.waveP, (v)=> v==null?'—':v.toFixed(0));

  addRow('Wind (km/h)', d.wind, (v)=> v==null?'—':Math.round(v), (v)=>{
    if(v==null) return '';
    if(v<15) return 'scale-wind low';
    if(v<=25) return 'scale-wind med';
    return 'scale-wind high';
  });

  addRow('Gusts (km/h)', d.gusts, (v)=> v==null?'—':Math.round(v));

  addRow('Direction', d.windDir, (v)=> {
    if(v==null) return '—';
    const comp = degToCompass(v);
    return comp + ' <span class="dir-arrow" style="transform:rotate(' + v + 'deg)">➤</span>';
  });

  addRow('Rain (mm/hr)', d.rain, (v)=> v==null?'—':v.toFixed(1));

  addRow('Tide (m)', d.tide, (v)=> v==null?'—':v.toFixed(2));

  const scores = d.labelHours.map((_,i)=> hourlyScore(d.wave[i], d.wind[i], d.rain[i], d.windDir[i]));
  addRow('Surfability (1–10)', scores, (v)=> v==null?'—':v.toFixed(1), (v)=>{
    if(v==null) return '';
    if(v>=8) return 'scale-surf good';
    if(v>=5) return 'scale-surf fair';
    return 'scale-surf poor';
  });

  const nowScore = scores[0];
  const badge = document.getElementById('scoreBadge');
  badge.textContent = `Surfability ${nowScore!=null? nowScore.toFixed(1):'—'}`;
  badge.classList.remove('good','poor');
  if(nowScore!=null){
    if(nowScore>=8) badge.classList.add('good');
    else if(nowScore<5) badge.classList.add('poor');
  }
}

// Update status chips
function updateStatus(off){
  const chip = document.getElementById('dataStatus');
  chip.textContent = off ? "📁 Offline sample" : "🌐 Live data";
  chip.classList.toggle('offline', off);
  chip.classList.toggle('live', !off);
  const ts = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  document.getElementById('updatedAt').textContent = "Updated " + ts;
}

// Tide highs/lows from tide series (best effort)
function computeNextTides(times, heights){
  try{
    const now = new Date();
    let nextHigh = null, nextLow = null;
    for(let i=1; i<heights.length-1; i++){
      const prev = heights[i-1], cur = heights[i], nxt = heights[i+1];
      const tt = new Date(times[i]);
      if(tt <= now) continue;
      if(cur>prev && cur>nxt && !nextHigh) nextHigh = tt;
      if(cur<prev && cur<nxt && !nextLow) nextLow = tt;
      if(nextHigh && nextLow) break;
    }
    return {nextHigh, nextLow};
  }catch(e){ return {nextHigh:null, nextLow:null}; }
}

// Main refresh
async function refresh(){
  try{
    const d = await fetchData();
    // Labels for sunrise/sunset
    document.getElementById('sunriseLabel').textContent = d.sunrise ? d.sunrise.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—';
    document.getElementById('sunsetLabel').textContent  = d.sunset  ? d.sunset.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})  : '—';

    // Next tides if live data and tide array exists
    if(!d.offline){
      try{
        const tideURL = `https://marine-api.open-meteo.com/v1/tide?latitude=${LAT}&longitude=${LON}&hourly=tide_height&timezone=auto`;
        const tRes = await fetch(tideURL);
        const t = await tRes.json();
        const times = t.hourly?.time || [];
        const heights = t.hourly?.tide_height || [];
        const {{nextHigh, nextLow}} = computeNextTides(times, heights);
        document.getElementById('tideHigh').textContent = nextHigh ? nextHigh.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—';
        document.getElementById('tideLow').textContent  = nextLow  ? nextLow.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})  : '—';
      }catch(e){
        document.getElementById('tideHigh').textContent = '—';
        document.getElementById('tideLow').textContent  = '—';
      }
    }else{
      document.getElementById('tideHigh').textContent = '—';
      document.getElementById('tideLow').textContent  = '—';
    }

    buildTable(d);
    updateStatus(d.offline);
  }catch(e){
    const d = makeFallback();
    document.getElementById('sunriseLabel').textContent = d.sunrise.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    document.getElementById('sunsetLabel').textContent  = d.sunset.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    document.getElementById('tideHigh').textContent = '—';
    document.getElementById('tideLow').textContent  = '—';
    buildTable(d);
    updateStatus(true);
  }
}
refresh();
setInterval(refresh, 30*60*1000);
