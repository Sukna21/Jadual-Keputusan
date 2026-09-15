# SUKNA XXI — Jadual & Keputusan LIVE v7

Versi ini tidak lagi membaca keputusan melalui Google Visualization (`gviz`).

Flow baharu:

**Google Sheet → Google Apps Script API → Portal GitHub Pages**

Ini mengelakkan isu:
- merged cells `KEPUTUSAN`
- cache `gviz`
- response Google Sheet yang tidak konsisten
- browser cross-origin/cookie

Ikut `SETUP-APPS-SCRIPT.md`.

Selepas setup, urus setia hanya update Google Sheet.
Portal refresh automatik setiap 30 saat dan boleh refresh manual.

Fail utama:
- `apps-script/Code.gs` — backend API
- `js/live-config.js` — URL `/exec` Apps Script
- `js/live-data.js` — client portal


## FINAL LIVE CONNECTION

Apps Script Web App telah disambungkan:

`https://script.google.com/macros/s/AKfycbzDqtHxz98f6bEdYxq7ytgB1E9TEvHDWrPjnf9Uuwp30a1wd1ni78VRsT-sOHKwFE7Dlg/exec`

Portal akan baca data daripada bridge Apps Script yang sync fail XLSX urus setia.

Cache build:
`20260916-final1`

Expected footer selepas berjaya:
`API LIVE · xlsx-bridge-v8`
