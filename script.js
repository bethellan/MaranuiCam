// Metric conditions with icons + timestamp
const lat=-41.327, lon=174.818;
const content=document.getElementById('conditionsContent');
const updated=document.getElementById('conditionsUpdated');
const kmh=ms=>Math.round(ms*3.6);
const fmtTime=d=>d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
function dirText(deg){const d=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];return d[Math.round(((deg%360)/22.5))%16];}

async function fetchConditions(){
  try{
    const meteoUrl=`https://api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period,wind_speed,wind_direction&timezone=auto`;
    const meteo=await fetch(meteoUrl).then(r=>r.json());
    const i=0;
    const wh=meteo.hourly.wave_height[i];
    const wp=Math.round(meteo.hourly.wave_period[i]);
    const ws=kmh(meteo.hourly.wind_speed[i]);
    const wd=dirText(meteo.hourly.wind_direction[i]);

    let tideStr='🌊 Tide: data unavailable';
    try{
      const t=await fetch(`https://www.worldtides.info/api/v2?heights&lat=${lat}&lon=${lon}&length=86400&key=demo`).then(r=>r.json());
      if(t&&t.heights&&t.heights.length){
        const nearest=t.heights[0];
        tideStr=`🌊 Tide: ${nearest.height.toFixed(1)} m @ ${fmtTime(new Date(nearest.dt*1000))}`;
      }
    }catch{}

    content.textContent=[
      tideStr,
      `💨 Wind: ${wd} ${ws} km/h`,
      `🌡️ Waves: ${wh.toFixed(1)} m @ ${wp} s`
    ].join('\n');
    updated.textContent='Updated: '+new Date().toLocaleString();
    localStorage.setItem('maranui-conditions-text',content.textContent);
    localStorage.setItem('maranui-conditions-updated',updated.textContent);
  }catch(e){
    content.textContent=localStorage.getItem('maranui-conditions-text')||'Offline – last data unavailable';
    updated.textContent=localStorage.getItem('maranui-conditions-updated')||'';
  }
}
fetchConditions();
setInterval(fetchConditions,30*60*1000);

if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{});});}
