// Maranui Webcam v4 – autoplay, bigger overlays with repeating winged M, hourly forecast table
const lat=-41.327, lon=174.818;
const snapshot=document.getElementById('snapshot');
const tideExtras=document.getElementById('tideExtras');
const updated=document.getElementById('updated');
const tbody=document.querySelector('#hourlyTable tbody');

const kmh=ms=>Math.round(ms*3.6);
const fmtTime=d=>d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
function dirText(deg){const d=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];return d[Math.round(((deg%360)/22.5))%16];}

async function fetchAll(){
  try{
    const meteoUrl=`https://api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,wind_speed,wind_direction&timezone=auto`;
    const meteo=await fetch(meteoUrl).then(r=>r.json());

    const ht=await fetch(`https://www.worldtides.info/api/v2?heights&lat=${lat}&lon=${lon}&length=86400&key=demo`).then(r=>r.json()).catch(()=>({heights:[]}));
    const ex=await fetch(`https://www.worldtides.info/api/v2?extremes&lat=${lat}&lon=${lon}&length=86400&key=demo`).then(r=>r.json()).catch(()=>({extremes:[]}));

    buildSnapshot(meteo, ht, ex);
    buildTable(meteo, ht);
    updated.textContent='Updated: '+new Date().toLocaleString();
    localStorage.setItem('v4-snapshot', snapshot.textContent);
    localStorage.setItem('v4-tideExtras', tideExtras.textContent);
    localStorage.setItem('v4-updated', updated.textContent);
  }catch(e){
    snapshot.textContent=localStorage.getItem('v4-snapshot')||'Offline – last data unavailable';
    tideExtras.textContent=localStorage.getItem('v4-tideExtras')||'';
    updated.textContent=localStorage.getItem('v4-updated')||'';
  }
}

function buildSnapshot(meteo, ht, ex){
  const i=0;
  const wh=meteo.hourly.wave_height[i];
  const wp=Math.round(meteo.hourly.wave_period[i]);
  const ws=kmh(meteo.hourly.wind_speed[i]);
  const wd=dirText(meteo.hourly.wind_direction[i]);

  let phase='unknown'; let nextHigh='?', nextLow='?';
  if(ht.heights && ht.heights.length>2){
    const nowH=ht.heights[0].height, nextH=ht.heights[1].height;
    phase = nextH>nowH ? 'Rising ↑' : 'Falling ↓';
  }
  if(ex.extremes && ex.extremes.length){
    const highs=ex.extremes.filter(x=>x.type==='High');
    const lows=ex.extremes.filter(x=>x.type==='Low');
    const nextHighObj=highs[0], nextLowObj=lows[0];
    if(nextHighObj) nextHigh = `High: ${Number(nextHighObj.height||0).toFixed(1)} m @ ${fmtTime(new Date(nextHighObj.dt*1000))}`;
    if(nextLowObj)  nextLow  = `Low:  ${Number(nextLowObj.height||0).toFixed(1)} m @ ${fmtTime(new Date(nextLowObj.dt*1000))}`;
  }
  snapshot.textContent=`🌊 Tide: ${phase}\n💨 Wind: ${wd} ${ws} km/h\n🌡️ Waves: ${wh.toFixed(1)} m @ ${wp} s`;
  tideExtras.textContent=`${nextHigh} | ${nextLow}`;
}

function buildTable(meteo, ht){
  tbody.innerHTML='';
  const hours=meteo.hourly.time.length;
  const tides=ht.heights||[];
  const byHourHeight={};
  tides.forEach(t=>{const H=new Date(t.dt*1000);byHourHeight[H.getHours()]=t.height;});
  for(let i=0;i<Math.min(24,hours);i++){
    const t=new Date(meteo.hourly.time[i]);
    const timeStr=fmtTime(t);
    const wh=meteo.hourly.wave_height[i];
    const wp=Math.round(meteo.hourly.wave_period[i]);
    const ws=kmh(meteo.hourly.wind_speed[i]);
    const wd=dirText(meteo.hourly.wind_direction[i]);
    const tideH=(byHourHeight[t.getHours()] ?? NaN);
    let arrow='?';
    if(i+1<hours){
      const nextH=(byHourHeight[(new Date(meteo.hourly.time[i+1])).getHours()] ?? tideH);
      arrow=nextH>tideH ? '↑' : (nextH<tideH ? '↓' : '→');
    }
    const optimal=(wh>=1 && wh<=2) && (wp>=7) && (ws<20);
    const tr=document.createElement('tr'); if(optimal) tr.classList.add('ok');
    tr.innerHTML=`<td>${timeStr}</td><td>${arrow}</td><td>${tideH===tideH?tideH.toFixed(1):'-'}</td><td>${ws}</td><td>${wd}</td><td>${wh.toFixed(1)}</td><td>${wp}</td><td>${optimal?'✅':''}</td>`;
    tbody.appendChild(tr);
  }
}

fetchAll();
setInterval(fetchAll, 30*60*1000);

if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
