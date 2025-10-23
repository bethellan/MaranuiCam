/* Basic YouTube embed controller + PWA service worker registration */
const VIDEO_ID = "c6uv1mWhWek"; // Provided live stream ID
const iframe = document.getElementById('ytFrame');
const poster = document.getElementById('poster');
const playBtn = document.getElementById('btn-play');
const openBtn = document.getElementById('btn-open');
const fullBtn = document.getElementById('btn-full');

function playStream(){
  // Switch to autoplay now that we have user gesture
  const url = new URL(iframe.src);
  url.searchParams.set('autoplay','1');
  url.searchParams.set('mute','0');     // unmute after gesture
  url.searchParams.set('playsinline','1');
  iframe.src = url.toString();
  poster.style.display = 'none';
}
poster?.addEventListener('click', playStream);
poster?.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); playStream(); }});
playBtn?.addEventListener('click', playStream);

openBtn?.addEventListener('click', ()=>{
  const y = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
  window.open(y, '_blank');
});

function toggleFullscreen(){
  const wrap = document.getElementById('playerWrap');
  if(!document.fullscreenElement){
    (wrap.requestFullscreen?.bind(wrap) || wrap.webkitRequestFullscreen?.bind(wrap) || wrap.msRequestFullscreen?.bind(wrap) || wrap.mozRequestFullScreen?.bind(wrap))?.();
    document.body.classList.add('fullscreen');
  }else{
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || document.mozCancelFullScreen).call(document);
    document.body.classList.remove('fullscreen');
  }
}
fullBtn?.addEventListener('click', toggleFullscreen);

// Register SW for offline shell cache (stream requires network)
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  });
}
