Maranui Webcam — v6 (Wings + 24‑Hour Conditions Table)
===========================================================

Overview
--------
This build shows two live cameras (Surf and Airport) with animated wing banners at the top and bottom of the video. 
Below the camera is a compact 24‑hour conditions table that replaces the previous long-scrolling charts.

How to Use
----------
1. Open `index.html` in any modern browser (or deploy the folder to GitHub Pages).
2. Use the **Surf / Airport** toggle to switch between the two live feeds.
3. The **wing banners** (top and bottom) scroll continuously to cover any channel branding.
4. The **conditions table** shows 24 hours from the current hour → 23 hours ahead.
   - Columns are hours of the day.
   - Rows include: Wave (m), Period (s), Wind (km/h), Gusts (km/h), Direction, Rain (mm/hr), Tide (m), Surfability (1–10).
   - **Night hours** are shaded.
   - The table auto‑updates every 30 minutes.

Data Sources
------------
- **Open‑Meteo Forecast API** (wind, gusts, rain, sunrise, sunset):  
  https://api.open-meteo.com/v1/forecast

- **Open‑Meteo Marine API** (wave height, wave period, wave direction):  
  https://marine-api.open-meteo.com/v1/marine

- **Open‑Meteo Tide API** (tide height time series; used for next high/low identification):  
  https://marine-api.open-meteo.com/v1/tide

All data is fetched in **metric units** and aligned to your local timezone automatically.
No API keys are required. Update cadence is set to **every 30 minutes**.

Interpreting the Table
----------------------
- **Wave (m)**: 0.8–1.5 m is generally ideal for clean surf/kneeboarding.
- **Wind (km/h)**: < 15 is good; 15–25 is OK; > 25 is poor (for surf).
- **Gusts (km/h)**: strong gusts reduce quality.
- **Direction**: Arrow points toward the wind direction. Offshore at Lyall Bay (NW–WNW) gets a small bonus.
- **Rain (mm/hr)**: < 0.2 is best; heavy rain reduces score.
- **Tide (m)**: Uses Open‑Meteo tide heights; for official times please check MetService Wellington Tides.
- **Surfability (1–10)**: heuristic score, colour-coded (Good ≥8, Fair 5–7, Poor <5).

Customization
-------------
- **Wing banner speed**: Edit `style.css` → `@keyframes wing-scroll` duration (default **55s** loop).
- **Bar height**: Edit `.wing-banner { height: 25px; }`.
- **Update frequency**: Edit `setInterval(refresh, 30*60*1000);` in `script.js`.
- **Theme colours**: Edit CSS variables at the top of `style.css`.
- **Camera URLs**: `SURF_EMBED` and `AIRPORT_EMBED` constants in `script.js`.

File Layout
-----------
- `index.html` – structure and components
- `style.css` – theme, layout, wing animation, table styling
- `script.js` – camera toggle, data fetching, table rendering
- `assets/maranui-wing-band.png` – animated wing banner image (scrolling)

Deploying
---------
- **Local**: double-click `index.html`.
- **GitHub Pages**: push the folder to a repo and enable Pages (root or `/docs`).
- **iOS**: add to Home Screen; the site runs as a simple web app.

Notes
-----
- APIs require internet access; if you open offline you’ll see placeholders.
- Forecasts are model-based estimates and can differ from in-situ buoys or manual observations.
- For official tide times, please use MetService Wellington Tides: https://www.metservice.com/marine/tides/wellington
