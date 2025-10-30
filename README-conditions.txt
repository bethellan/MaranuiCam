Maranui Webcam — v6.3 (Sunrise/Sunset Icons + Fixed 24‑Hour Table)
=====================================================================

What’s new
----------
- **Sunrise / Sunset** chips use coloured **gradient SVG icons** (no text labels; hover shows tooltips).
- **High / Low tide** times are merged into one compact chip: “🌊 HH:MM / HH:MM”.
- **24‑hour forecast** table fixed and robust (live data or fallback), with correct night shading and surfability.
- Theme stays with **solid Maranui red** wing banners (28px) scrolling left→right.

How to run (to get LIVE data)
-----------------------------
Run via a local server to avoid CORS:
- macOS/Linux
  cd maranui-webcam-v6_3
  python3 -m http.server 8080
  open http://localhost:8080
- Windows
  cd maranui-webcam-v6_3
  python -m http.server 8080

Data sources
------------
- Open‑Meteo Forecast (wind, gusts, rain, sunrise/sunset)
- Open‑Meteo Marine (wave height/period/direction)
- Open‑Meteo Tide (tide height series). For official tide times, refer to MetService Wellington Tides.

Notes
-----
- If any live call fails, the app switches to a built‑in fallback dataset so the table still renders.
- You can tweak banner speed, height or tile size via `style.css` (`@keyframes drift`, `.overlay`).
