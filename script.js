// ===== v6.4.5 — restore table, remove lower chips, add minutes =====
const LAT = -41.327, LON = 174.794;
const SURF_EMBED = "https://www.youtube.com/embed/c6uv1mWhWek?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";
const AIRPORT_EMBED = "https://www.youtube.com/embed/qEzB86yz_rM?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1";

const frame = document.getElementById("liveFrame");
const camToggle = document.getElementById("camToggle");
let showingSurf = true;
let youtubeAPIReady = false;
let player;
let overlayAdded = false;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// ----- YouTube autoplay handling -----
function loadYouTubeAPI() {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}
window.onYouTubeIframeAPIReady = () => { youtubeAPIReady = true; initPlayer(); };
function initPlayer() {
  if (!frame || !youtubeAPIReady) return;
  player = new YT.Player(frame, { events:{ onReady:onPlayerReady, onStateChange:onPlayerStateChange }});
}
function onPlayerReady(){ tryPlay(); document.addEventListener("click",()=>tryPlay(true),{once:true}); }
function tryPlay(fromGesture=false){
  if(!player||typeof player.playVideo!=="function")return;
  try{player.mute();}catch{}
  setTimeout(()=>{try{player.playVideo();}catch{}},fromGesture?0:300);
  setTimeout(()=>{if(isIOS&&!overlayAdded&&!isPlaying())addIOSOverlay();},3000);
}
function isPlaying(){try{return player.getPlayerState()===YT.PlayerState.PLAYING;}catch{return false;}}
function onPlayerStateChange(e){if(e.data===YT.PlayerState.PLAYING){const o=document.querySelector(".ios-play-overlay");if(o)o.remove();overlayAdded=false;}}
function addIOSOverlay(){
  const cam=document.querySelector(".cam");if(!cam||overlayAdded)return;
  const o=document.createElement("div");
  o.className="ios-play-overlay";o.textContent="▶ Tap to Play Video";
  o.addEventListener("click",()=>{tryPlay(true);o.remove();overlayAdded=false;});
  cam.appendChild(o);overlayAdded=true;
}
camToggle.addEventListener("click",()=>{
  showingSurf=!showingSurf;setToggle();
  frame.style.opacity="0";
  setTimeout(()=>{
    frame.src=showingSurf?SURF_EMBED:AIRPORT_EMBED;
    frame.style.opacity="1";
    setTimeout(()=>{if(window.YT&&youtubeAPIReady)initPlayer();tryPlay();},400);
  },200);
});
function setToggle(){
  camToggle.classList.toggle("toggle--surf",showingSurf);
  camToggle.classList.toggle("toggle--airport",!showingSurf);
}

// ----- Data + UI -----
window.addEventListener("load",()=>{
  setToggle();loadYouTubeAPI();
  document.getElementById("dateLabel")?.textContent=
    new Date().toLocaleDateString([],{weekday:"long",day:"numeric",month:"short"});
  refresh();setInterval(refresh,30*60*1000);
});

function toHourISO(d){return new Date(d).toISOString().slice(0,13)+":00";}
function degToCompass(num){
  const arr=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return arr[Math.round(num/22.5)%16];
}

// ----- Offline placeholder -----
function offlineData(){
  const base=new Date();base.setMinutes(0,0,0);
  const hours=Array.from({length:24},(_,i)=>new Date(base.getTime()+i*3600*1000));
  const f=(a,b)=>+(Math.random()*(b-a)+a).toFixed(1);
  return{labelHours:hours,wave:hours.map(()=>f(0.8,1.6)),waveP:hours.map(()=>f(7,10)),
    wind:hours.map(()=>f(8,20)),gusts:hours.map(()=>f(12,28)),windDir:hours.map(()=>Math.floor(Math.random()*360)),
    rain:hours.map(()=>Math.random()<0.1?f(0,1.2):0),tide:hours.map(()=>f(0.6,1.4)),
    sunrise:new Date().setHours(7,12,0,0),sunset:new Date().setHours(19,8,0,0),offline:true};
}

// ----- Fetch + build -----
async function fetchData(){
  const forecast=`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation&daily=sunrise,sunset&timezone=auto&windspeed_unit=kmh`;
  const marine=`https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_period,wave_direction&timezone=auto`;
  const tide=`https://marine-api.open-meteo.com/v1/tide?latitude=${LAT}&longitude=${LON}&hourly=tide_height&timezone=auto`;
  try{
    const [fR,mR,tR]=await Promise.allSettled([fetch(forecast),fetch(marine),fetch(tide)]);
    const f=fR.value&&fR.value.ok?await fR.value.json():{};
    const m=mR.value&&mR.value.ok?await mR.value.json():{};
    const t=tR.value&&tR.value.ok?await tR.value.json():{};
    const base=new Date();base.setMinutes(0,0,0);
    const hours=Array.from({length:24},(_,i)=>new Date(base.getTime()+i*3600*1000));
    const idx=a=>a?Object.fromEntries(a.time.map((v,i)=>[v,i])):{};
    const iF=idx(f.hourly||{}),iM=idx(m.hourly||{}),iT=idx(t.hourly||{});
    const d={labelHours:hours,wind:[],gusts:[],windDir:[],rain:[],wave:[],waveP:[],waveD:[],tide:[],
      sunrise:f.daily?.sunrise?new Date(f.daily.sunrise[0]):new Date().setHours(7,12),
      sunset:f.daily?.sunset?new Date(f.daily.sunset[0]):new Date().setHours(19,8),
      offline:false};
    hours.forEach(h=>{
      const iso=toHourISO(h);
      const fI=iF[iso],mI=iM[iso],tI=iT[iso];
      d.wind.push(fI!=null?f.hourly.wind_speed_10m[fI]:null);
      d.gusts.push(fI!=null?f.hourly.wind_gusts_10m[fI]:null);
      d.windDir.push(fI!=null?f.hourly.wind_direction_10m[fI]:null);
      d.rain.push(fI!=null?f.hourly.precipitation[fI]:null);
      d.wave.push(mI!=null?m.hourly.wave_height[mI]:null);
      d.waveP.push(mI!=null?m.hourly.wave_period[mI]:null);
      d.waveD.push(mI!=null?m.hourly.wave_direction[mI]:null);
      d.tide.push(tI!=null?t.hourly.tide_height[tI]:null);
    });
    return d;
  }catch{return offlineData();}
}

function buildTable(d){
  const thead=document.getElementById("thead"),tbody=document.getElementById("tbody");
  thead.innerHTML=tbody.innerHTML="";
  const trH=document.createElement("tr");
  trH.innerHTML="<th>Metric</th>"+
    d.labelHours.map(h=>`<th${isNight(d,h)?' class="night"':''}>${h.toLocaleTimeString([], {hour:'2-digit'})}</th>`).join("");
  thead.appendChild(trH);
  const rows=[
    ["Wave (m)",d.wave,v=>v?.toFixed(1)??"—"],
    ["Period (s)",d.waveP,v=>v?.toFixed(0)??"—"],
    ["Wind (km/h)",d.wind,v=>v?.toFixed(0)??"—"],
    ["Gusts (km/h)",d.gusts,v=>v?.toFixed(0)??"—"],
    ["Direction",d.windDir,v=>v!=null?`${degToCompass(v)} <span style='transform:rotate(${v}deg)' class='dir-arrow'>➤</span>`:"—"],
    ["Rain (mm/hr)",d.rain,v=>v?.toFixed(1)??"—"],
    ["Tide (m)",d.tide,v=>v?.toFixed(2)??"—"]
  ];
  rows.forEach(([label,arr,fmt])=>{
    const tr=document.createElement("tr");
    tr.innerHTML="<th>"+label+"</th>"+arr.map((v,i)=>`<td${isNight(d,i)?' class="night"':''}>${fmt(v)}</td>`).join("");
    tbody.appendChild(tr);
  });
  const surf=d.labelHours.map((_,i)=>score(d.wave[i],d.wind[i],d.rain[i],d.windDir[i]));
  const tr=document.createElement("tr");
  tr.innerHTML="<th>Surfability (1–10)</th>"+
    surf.map((v,i)=>`<td class="scale-surf ${v>=8?"good":v>=5?"fair":"poor"}${isNight(d,i)?' night':''}">${v.toFixed(1)}</td>`).join("");
  tbody.appendChild(tr);
}
function isNight(d,h){const hh=h instanceof Date?h:d.labelHours[h];return hh<new Date(d.sunrise)||hh>=new Date(d.sunset);}

function findTideExtremes(tide,hours){
  const highs=[],lows=[];
  for(let i=1;i<tide.length-1;i++){
    const p=tide[i-1],c=tide[i],n=tide[i+1];
    if(c>p&&c>n)highs.push({time:hours[i]});
    if(c<p&&c<n)lows.push({time:hours[i]});
  }
  const now=new Date();
  return{nextHigh:(highs.find(t=>t.time>now)||highs[0])?.time||now,
         nextLow:(lows.find(t=>t.time>now)||lows[0])?.time||now};
}
function updateChips(d){
  const sun=new Date(d.sunrise),set=new Date(d.sunset);
  document.getElementById("sunChip").innerHTML=`🌅 ${sun.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}  🌇 ${set.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  const tideChip=document.getElementById("tideChip");
  if(d.tide&&d.labelHours&&d.tide.length>0){
    const t=findTideExtremes(d.tide,d.labelHours);
    tideChip.innerHTML=`🌊 High: ${t.nextHigh.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})} | Low: ${t.nextLow.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  }else{tideChip.innerHTML="🌊 Tide data loading...";}
}
function score(w,wnd,r,d){if(w==null)return 0;let s=10-Math.abs(w-1)*5;s-=wnd>20?(wnd-20)/5:0;if(r>0.5)s-=2;if(d&&(d<200||d>340))s+=1;return Math.max(0,Math.min(10,s));}
async function refresh(){
  const fallback=offlineData();buildTable(fallback);updateChips(fallback);
  document.getElementById("dataStatus").textContent="⏳ loading...";
  try{const d=await fetchData();buildTable(d);updateChips(d);
    document.getElementById("dataStatus").textContent=d.offline?"📁 Offline":"🌐 Live";
    document.getElementById("updatedAt").textContent=new Date().toLocaleTimeString();
  }catch{document.getElementById("dataStatus").textContent="
