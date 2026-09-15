# SUKNA XXI — Jadual & Keputusan

Package standalone untuk repo:

`Sukna21/Jadual-Keputusan`

Website GitHub Pages selepas deploy:

`https://sukna21.github.io/Jadual-Keputusan/`

## Fix versi ini

### Venue sync
Parser tidak lagi menganggap venue perlu berada pada setiap row perlawanan.

Ia akan:
1. Membaca nilai `TEMPAT:` pada setiap tab sukan.
2. Menggunakan nilai itu sebagai **venue default untuk semua perlawanan** dalam tab.
3. Mengekalkan `GLG` sebagai gelanggang/court (contoh A, C, 1 & 2), bukan menggantikannya sebagai venue.
4. Membenarkan row khusus override venue. Contoh `Stadium` bagi Grand Final Bola Sepak → **Stadium UPM**.
5. Tidak pernah menggunakan `Venue Utama` sebagai fallback tempat perlawanan.

### Struktur yang diaudit daripada XLSX terbaru
- Bola Sepak → Padang Bola Sepak A & C UPM
- Bola Jaring → Dewan Serbaguna Akademi Sukan UPM
- Bola Tampar L/W → Astaka Seni & Gelanggang Serbaguna Akademi Sukan UPM
- Futsal Lelaki → Gelanggang Serbaguna, Akademi Sukan, UPM
- Futsal Wanita → Gelanggang Sintetik, Akademi Sukan, UPM
- Badminton → Dewan Serbaguna Akademi Sukan UPM
- Karom → Bilik Terapi Sukan, Akademi Sukan, UPM
- Dart → Bilik Seminar, Akademi Sukan, UPM
- Sepak Takraw → Dewan Serbaguna Akademi Sukan UPM
- Ping Pong → Dewan Serbaguna Akademi Sukan UPM
- Tarik Tali 680KG / Freeweight → Lapang Sasar Memanah, UPM

## Cara replace repo

1. Extract ZIP.
2. Upload semua fail/folder ke root repo `Sukna21/Jadual-Keputusan`.
3. GitHub → **Settings → Pages**.
4. Source: `Deploy from a branch`.
5. Branch: `main`, Folder: `/ (root)`.
6. Save.

## Nota branding
Logo/maskot rasmi dimuat dari Portal-Main supaya visual kekal sama. Fail SVG fallback tempatan disediakan jika imej remote tidak boleh dimuat.

## Data source
Google Sheet:
`1qiRF16JhUlDBV9ZvoO6YhA5JnCbjqFcs`

Parser menggunakan Google Visualization endpoint dengan `headers=0`, supaya blok metadata seperti `ACARA:`, `TARIKH:` dan `TEMPAT:` boleh dibaca terus.
