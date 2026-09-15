# SETUP GOOGLE APPS SCRIPT — SUKNA XXI

Ini setup sekali sahaja.

## 1. Buka Google Sheet rasmi
Buka spreadsheet yang urus setia akan gunakan.

## 2. Buka Apps Script
`Extensions → Apps Script`

## 3. Masukkan backend
Padam code asal dalam `Code.gs`.

Copy **semua** kandungan fail:

`apps-script/Code.gs`

Kemudian Save.

## 4. Test dahulu
Dalam dropdown function, pilih:

`testPayload`

Tekan **Run**.

Pada first run, Google akan minta authorization.

Selepas run:
`Execution log / Logs`

Pastikan JSON yang keluar mengandungi:
- `"ok": true`
- `"sports"`
- dan keputusan yang telah anda masukkan, contoh `"result":"3 : 1"`

Kalau keputusan muncul di sini, backend memang membaca sel yang betul.

## 5. Deploy sebagai Web App
`Deploy → New deployment → Web app`

Pilih:
- **Execute as:** Me
- **Who has access:** Anyone

Tekan Deploy.

Copy URL yang berakhir dengan:

`/exec`

## 6. Sambungkan portal
Buka fail:

`js/live-config.js`

Ganti:

`PASTE_APPS_SCRIPT_EXEC_URL_HERE`

dengan URL `/exec` tadi.

Contoh:

```js
window.SUKNA_LIVE_CONFIG = {
  appsScriptUrl: "https://script.google.com/macros/s/XXXXXXXX/exec"
};
```

Save.

## 7. Upload repo
Upload/replace package ini ke repo `Sukna21/Jadual-Keputusan`.

Bila berjaya footer portal akan papar:

`API LIVE · apps-script-v7`

Urus setia selepas itu hanya perlu update Google Sheet.
Tidak perlu edit GitHub lagi untuk keputusan.
