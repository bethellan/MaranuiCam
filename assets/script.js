// Tabs
const buttons = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');
buttons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    buttons.forEach(b=>b.classList.remove('active'));
    contents.forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// === Conditions Panel (Open-Meteo) ===
// Lyall Bay approx coordinates
const LAT = -41.327; 
const LON = 174.794;

// Wind (Open-Meteo forecast endpoint) - hourly wind
async function fetchWind(){
  try{
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_direction_10m&windspeed_unit=kmh&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const idx = nearestHourIndex(j.hourly.time);
    const speed = j.hourly.wind_speed_10m?.[idx];
    const dir = j.hourly.wind_direction_10m?.[idx];
    document.getElementById('windSpeed').textContent = speed != null ? Math.round(speed) : '–';
    document.getElementById('windDirText').textContent = dir != null ? `(${degToCompass(dir)})` : '';
  }catch(e){
    console.warn('Wind fetch error', e);
  }
}

// Waves (Open-Meteo marine endpoint) - hourly waves
async function fetchWaves(){
  try{
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height&timezone=auto`;
    const r = await fetch(url);
    const j = await r.json();
    const idx = nearestHourIndex(j.hourly.time);
    const h = j.hourly.wave_height?.[idx];
    document.getElementById('waveHeight').textContent = h != null ? h.toFixed(1) : '–';
  }catch(e){
    console.warn('Waves fetch error', e);
  }
}

function nearestHourIndex(times){
  if(!times || !times.length) return 0;
  const now = new Date();
  let bestIdx = 0, bestDiff = Infinity;
  for (let i=0;i<times.length;i++){
    const d = new Date(times[i]);
    const diff = Math.abs(d - now);
    if(diff < bestDiff){ bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

function degToCompass(num){
  const val = Math.floor((num/22.5)+0.5);
  const arr = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[(val % 16)];
}

function updateAll(){
  fetchWind();
  fetchWaves();
}
updateAll();
setInterval(updateAll, 30 * 60 * 1000); // every 30 minutes
