Maranui Webcam — v6.2 (Solid Red Wing Bars + 24‑Hour Table)
================================================================

Overview
--------
Two live cameras (Surf and Airport) with **solid red Maranui wing banners** at the top and bottom of the video. 
Below the camera is a compact 24‑hour conditions table that auto‑updates every 30 minutes.

How to Use
----------
1. Open `index.html` in a browser via a local server (prevents CORS blocking). For example:
   - macOS/Linux:
     cd maranui-webcam-v6_2_red && python3 -m http.server 8080
     then open http://localhost:8080
   - Windows:
     cd maranui-webcam-v6_2_red && python -m http.server 8080
     then open http://localhost:8080
2. Use the **Surf / Airport** toggle to switch feeds.
3. Watch the **status chip** under the table:
   - 🌐 Live data (Open‑Meteo reached)
   - 📁 Offline sample (fallback demo data used)

Data Sources
------------
- **Open‑Meteo Forecast** (wind, gusts, rain, sunrise, sunset): https://api.open-meteo.com/v1/forecast
- **Open‑Meteo Marine** (waves: height, period, direction): https://marine-api.open-meteo.com/v1/marine
- **Open‑Meteo Tide** (tide height series; for official times see MetService): https://marine-api.open-meteo.com/v1/tide

Notes
-----
- If a data source fails or CORS blocks the requests, the app shows an **offline sample dataset** so the table still renders.
- For official tide times, please check MetService Wellington Tides.
- Theme colours and wing speed/size are configurable in `style.css`:
  - `.overlay { height: 28px }`
  - `.overlay { background-size: 210px auto }`
  - `@keyframes drift` (60s loop)

Files
-----
- `index.html` – structure
- `style.css` – theme, **solid red** wing bars, table styles
- `script.js` – data fetch + fallback, table rendering, camera toggle
- `assets/maranui-wing-band.png` – wing banner image (repeat‑x tile)
