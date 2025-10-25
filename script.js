// ===== v6.4.8 MaranuiCam — Restored full table + Wellington NIWA tides =====
const LAT = -41.327, LON = 174.794;
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";

const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let showingSurf = true, youtubeAPIReady = false, player, overlayAdded = false;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

/* ---------- YouTube handling ---------- */
function loadYouTubeAPI(){const t=document.createElement("script");t.src="https://www.youtube.com/iframe_api";document.getElementsByTagName("script")[0].parentNode.insertBefore(t,document.getElementsByTagName("script")[0]);}
window.onYouTubeIframeAPIReady=function(){youtubeAPIReady=!0;initPlayer()};
function initPlayer(){if(!frame||!youtubeAPIReady)return;player=new YT.Player(frame,{events:{onReady:onPlayerReady,onStateChange:onPlayerStateChange}})}
function onPlayerReady(){tryPlay();["touchstart","click"].forEach(e=>{document.addEventListener(e,()=>tryPlay(!0),{once:!0})})}
function tryPlay(e=!1){if(!player||typeof player.playVideo!="function")return;try{player.mute&&player.mute()}catch(t){}setTimeout(()=>{try{player.playVideo()}catch(t){}},e?0:300);setTimeout(()=>{isIOS&&!overlayAdded&&!isPlaying()&&addIOSOverlay()},3e3)}
function isPlaying(){try{return player&&player.getPlayerState&&player.getPlayerState()===YT.PlayerState.PLAYING}catch{return!1}}
function onPlayerStateChange(e){if(e.data===YT.PlayerState.PLAYING){const t=document.querySelector(".ios-play-overlay");t&&t.remove(),overlayAdded=!1}else(e.data===YT.PlayerState.PAUSED||e.data===YT.PlayerState.ENDED)&&setTimeout(()=>{try{player.playVideo()}catch(t){}},800)}
function addIOSOverlay(){const e=document.querySelector(".cam");if(!e||overlayAdded)return;const t=document.createElement("div");t.className="ios-play-overlay",t.textContent="▶ Tap to Play Video",t.addEventListener("click",()=>{tryPlay(!0)}),e.appendChild(t),overlayAdded=!0}
function setToggle(){camToggle.classList.toggle("toggle--surf",showingSurf),camToggle.classList.toggle("toggle--airport",!showingSurf)}
camToggle.addEventListener("click",()=>{showingSurf=!showingSurf,setToggle(),frame.style.opacity="0",setTimeout(()=>{frame.src=showingSurf?SURF_EMBED:AIRPORT_EMBED,frame.style.opacity="1",setTimeout(()=>{window.YT&&youtubeAPIReady&&initPlayer(),tryPlay()},400)},200)});
window.addEventListener("load",()=>{setToggle(),loadYouTubeAPI(),document.getElementById("dateLabel").textContent=new Date().toLocaleDateString([],{weekday:"long",day:"numeric",month:"short"}),refresh(),setInterval(refresh,18e5)});

/* ---------- Helpers ---------- */
function toHourISO(e){return new Date(e).toISOString().slice(0,13)+":00"}
function degToCompass(e){const t=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];return t[Math.round(e/22.5)%16]}
function offlineData(){const e=new Date;e.setMinutes(0,0,0);const t=Array.from({length:24},(t,a)=>new Date(e.getTime()+36e5*a)),n=(e,t)=>+(Math.random()*(t-e)+e).toFixed(1);return{labelHours:t,wave:t.map(()=>n(.8,1.6)),waveP:t.map(()=>n(7,10)),wind:t.map(()=>n(8,20)),gusts:t.map(()=>n(12,28)),windDir:t.map(()=>Math.floor(Math.random()*360)),rain:t.map(()=>Math.random()<.1?n(0,1.2):0),tide:t.map(()=>n(.6,1.4)),sunrise:new Date().setHours(7,0,0,0),sunset:new Date().setHours(19,0,0,0),offline:!0}}
async function fetchSunTimes(e,t){try{const n=await fetch(`https://api.sunrise-sunset.org/json?lat=${e}&lng=${t}&formatted=0`),a=await n.json();if(a.status==="OK")return{sunrise:new Date(a.results.sunrise),sunset:new Date(a.results.sunset)}}catch(e){console.warn("Sunrise-Sunset fetch failed:",e)}return{sunrise:new Date().setHours(7,0,0,0),sunset:new Date().setHours(19,0,0,0)}}

/* ---------- Fetch Open-Meteo ---------- */
async function fetchData(){const e=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&daily=sunrise,sunset&timezone=auto&windspeed_unit=kmh`,t=`https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_period,wave_direction&timezone=auto`;try{const[a,r]=await Promise.allSettled([fetch(e),fetch(t)]),o=a.value&&a.value.ok?await a.value.json():{},s=r.value&&r.value.ok?await r.value.json():{},c=new Date;c.setMinutes(0,0,0);const d=Array.from({length:24},(e,t)=>new Date(c.getTime()+36e5*t)),u=e=>e?Object.fromEntries(e.time.map((e,t)=>[e,t])):{},m=u(o.hourly||{}),h=u(s.hourly||{}),p={labelHours:d,wind:[],gusts:[],windDir:[],rain:[],wave:[],waveP:[],waveD:[],sunrise:o.daily?.sunrise?new Date(o.daily.sunrise[0]):new Date().setHours(7,0),sunset:o.daily?.sunset?new Date(o.daily.sunset[0]):new Date().setHours(19,0),offline:!1};return d.forEach(e=>{const t=toHourISO(e),n=m[t],a=h[t];p.wind.push(n!=null?o.hourly.wind_speed_10m[n]:null),p.gusts.push(n!=null?o.hourly.wind_gusts_10m[n]:null),p.windDir.push(n!=null?o.hourly.wind_direction_10m[n]:null),p.rain.push(n!=null?o.hourly.precipitation[n]:null),p.wave.push(a!=null?s.hourly.wave_height[a]:null),p.waveP.push(a!=null?s.hourly.wave_period[a]:null),p.waveD.push(a!=null?s.hourly.wave_direction[a]:null)}),p}catch(e){return console.warn("Falling back:",e),offlineData()}}

/* ---------- Table builder ---------- */
function buildTable(e){const t=document.getElementById("thead"),n=document.getElementById("tbody");t.innerHTML=n.innerHTML="";const a=document.createElement("tr");a.innerHTML="<th>Metric</th>"+e.labelHours.map(t=>`<th${isNight(e,t)?' class="night"':''}>${t.toLocaleTimeString([],{hour:"2-digit"})}</th>`).join(""),t.appendChild(a);const r=[["Wave (m)",e.wave,t=>t?.toFixed(1)??"—"],["Period (s)",e.waveP,t=>t?.toFixed(0)??"—"],["Wind (km/h)",e.wind,t=>t?.toFixed(0)??"—"],["Gusts (km/h)",e.gusts,t=>t?.toFixed(0)??"—"],["Direction",e.windDir,t=>t!=null?`${degToCompass(t)} <span style='transform:rotate(${t}deg)' class='dir-arrow'>➤</span>`:"—"],["Rain (mm/hr)",e.rain,t=>t?.toFixed(1)??"—"],["Tide (m)",e.tide,t=>t?.toFixed(2)??"—"]];r.forEach(([t,a,r])=>{const i=document.createElement("tr");i.innerHTML="<th>"+t+"</th>"+a.map((t,n)=>`<td${isNight(e,n)?' class="night"':''}>${r(t)}</td>`).join(""),n.appendChild(i)});const i=e.labelHours.map((t,n)=>score(e.wave[n],e.wind[n],e.rain[n],e.windDir[n])),o=document.createElement("tr");o.innerHTML="<th>Surfability (1–10)</th>"+i.map((t,n)=>{const a=t>=8?"good":t>=5?"fair":"poor";return`<td class="scale-surf ${a}${isNight(e,n)?' night':''}">${t.toFixed(1)}</td>`}).join(""),n.appendChild(o);const s=i[0],l=document.getElementById("scoreBadge");l.textContent=`Surfability ${s.toFixed(1)}`;l.className="chip score "+(s>=8?"good":s>=5?"fair":"poor")}
function isNight(e,t){const n=t instanceof Date?t:e.labelHours[t];return n<new Date(e.sunrise)||n>=new Date(e.sunset)}

/* ---------- NIWA Tide Predictions ---------- */
async function fetchTidePredictionsNIWA(){try{const url="https://api.niwa.co.nz/tides/data?station=Wellington&format=json";const resp=await fetch(url);if(!resp.ok)throw new Error("NIWA request failed");const data=await resp.json();return{highs:data.highs||[],lows:data.lows||[],offline:!1}}catch(err){console.warn("NIWA tide fetch failed, falling back:",err);return{highs:[],lows:[],offline:!0}}}

/* ---------- Update chips ---------- */
function updateChips(d){const fmt=t=>new Date(t).toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit",hour12:!1,timeZone:"Pacific/Auckland"});
const sunChip=document.getElementById("sunChip");if(sunChip&&d.sunrise&&d.sunset){sunChip.innerHTML=`🌅 ${fmt(d.sunrise)}  🌇 ${fmt(d.sunset)}`}
const tideChip=document.getElementById("tideChip");if(tideChip){if(d.tideTimes&&d.tideTimes.highs?.length&&d.tideTimes.lows?.length){const highs=d.tideTimes.highs.map(e=>({t:new Date(e.time),h:e.height}));const lows=d.tideTimes.lows.map(e=>({t:new Date(e.time),h:e.height}));const highStr=highs.map(e=>`${fmt(e.t)} (${e.h.toFixed(2)} m)`).join("  ");const lowStr=lows.map(e=>`${fmt(e.t)} (${e.h.toFixed(2)} m)`).join("  ");tideChip.innerHTML=`🌊 HIGH: ${highStr}  LOW: ${lowStr}`}else{tideChip.innerHTML="🌊 Tide data unavailable"}}}

/* ---------- Scoring ---------- */
function score(e,t,n,a){if(e==null)return 0;let r=10-Math.abs(e-1)*5;return r-=t>20?(t-20)/5:0,n>.5&&(r-=2),a&&(a<200||a>340)&&(r+=1),Math.max(0,Math.min(10,r))}

/* ---------- Refresh ---------- */
async function refresh(){document.getElementById("dataStatus").textContent="⏳ loading...";const offline=offlineData();buildTable(offline);const sun=await fetchSunTimes(LAT,LON);offline.sunrise=sun.sunrise;offline.sunset=sun.sunset;updateChips(offline);try{const[marine,sun2,niwa]=await Promise.all([fetchData(),fetchSunTimes(LAT,LON),fetchTidePredictionsNIWA()]);marine.sunrise=sun2.sunrise;marine.sunset=sun2.sunset;marine.tideTimes=niwa;buildTable(marine);updateChips(marine);document.getElementById("dataStatus").textContent=niwa.offline?"🌐 Live (no NIWA)":"🌐 Live";document.getElementById("updatedAt").textContent=new Date().toLocaleTimeString("en-NZ",{hour:"2-digit",minute:"2-digit",hour12:!1,timeZone:"Pacific/Auckland"})}catch(err){console.error("Refresh failed:",err);document.getElementById("dataStatus").textContent="❌ Error"}}
