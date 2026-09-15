# SUKNA XXI — Jadual & Keputusan LIVE

Versi ini mengekalkan UI **V1** dan menyambungkan portal terus kepada Google Sheet rasmi:

**Spreadsheet ID:** `1qiRF16JhUlDBV9ZvoO6YhA5JnCbjqFcs`

Portal membaca:
- Jadual Umum
- semua tab sukan
- `TEMPAT:` sebagai venue rasmi
- `GLG` sebagai gelanggang/court
- pasukan, masa, pusingan dan keputusan
- tab `PINGAT` untuk kedudukan pungutan pingat

## Aliran kerja urus setia

1. Urus setia edit Google Sheet sahaja.
2. Portal membaca semula data secara automatik setiap **60 saat**.
3. Pengguna juga boleh tekan **↻ Kemaskini Data**.
4. Jika Google Sheet tidak boleh dicapai, portal menggunakan snapshot `js/data.js` sebagai fallback supaya paparan tidak kosong.

## Permission Google Sheet

Pastikan helaian boleh dibaca oleh portal:
- Share → General access → **Anyone with the link → Viewer**, atau
- Publish to web jika organisasi memilih kaedah itu.

Urus setia yang perlu mengubah keputusan masih diberi akses Editor seperti biasa.

## Tab PINGAT

Cipta satu tab baharu bernama tepat:

`PINGAT`

Gunakan struktur:

| Kontinjen | Emas | Perak | Gangsa |
|---|---:|---:|---:|
| ZON HQ |  |  |  |
| ZON TENGAH |  |  |  |
| ZON UTARA |  |  |  |
| ZON TIMUR |  |  |  |
| ZON SELATAN |  |  |  |
| ZON SABAH |  |  |  |

Fail `PINGAT_TEMPLATE.csv` turut disertakan.

Portal mengira **Jumlah** dan ranking sendiri mengikut:
**Emas → Perak → Gangsa → Jumlah**.

## Keputusan perlawanan

Kekalkan format tab pertandingan semasa. Urus setia cuma isi ruang `KEPUTUSAN`.
Parser menyokong skor yang dimasukkan pada dua sel di kiri/kanan tanda `:` atau nilai keputusan yang ditulis terus dalam ruangan keputusan.

## Venue

Venue tidak lagi menggunakan fallback “Venue Utama”.
- nilai `TEMPAT:` = venue rasmi bagi tab
- `GLG` = gelanggang/court
- `Stadium` pada row khusus = Stadium UPM

## Deploy

Extract ZIP ini dan replace semua fail di root repo `Sukna21/Jadual-Keputusan`.

GitHub Pages:
`https://sukna21.github.io/Jadual-Keputusan/`
