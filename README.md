# Sistem Input Nilai Siswa SD (Koreksi Otomatis AI & Google Sheets)

Aplikasi web modern, ringan, dan cepat untuk guru Sekolah Dasar (SD) dalam memeriksa lembar ujian pilihan ganda siswa menggunakan kamera HP (AI Vision), mengoreksi otomatis terhadap kunci jawaban, dan langsung mencatat hasilnya ke template Google Sheets tanpa merusak kolom rumus nilai.

---

## 🌟 Fitur Utama

1. **Dashboard Modern Bertema Gelap & Neon Lime**:
   - Layout 3 kolom (Desktop), adaptif tablet, dan mobile-first dengan tombol kamera scan di navigasi bawah.
   - Grafik Donut SVG interaktif untuk sebaran predikat nilai (*Sangat Baik*, *Baik*, *Cukup*, *Perlu Bimbingan*).
   - Grafik Area Hijau SVG untuk tren rata-rata nilai per mata pelajaran.
   - Kartu ringkasan statistik dan daftar nilai murid terkini.

2. **Manajemen Kelas & Siswa (Fase 2)**:
   - Tambah, ubah, dan hapus kelas (contoh: *IV (Empat)*, TP *2026/2027*).
   - Penomoran otomatis presensi murid.
   - **Fitur Tempel Banyak Nama Sekaligus**: Salin daftar nama dari WhatsApp / Excel, tempel ke aplikasi; nomor urut awal dibersihkan otomatis.

3. **Mata Pelajaran & Editor Kunci Cepat (Fase 3)**:
   - Jumlah soal pilihan ganda dinamis (1 - 100 soal).
   - Grid tombol visual 1-tap untuk memilih kunci A/B/C/D.
   - **Tempel Deret Huruf**: Ketik atau tempel deretan kunci sekaligus (contoh: `ABDCCABBBAAD...`).
   - Bagian II Soal Uraian opsional dengan skor maksimal per nomor (contoh: 3, 3, 3, 2, 2).
   - Rumus perhitungan nilai sama persis dengan kolom BL template Excel:
     $$\text{Nilai Akhir} = \frac{\text{Jumlah Benar PG} + \text{Total Skor Uraian}}{\text{Jumlah Soal PG} + \text{Total Skor Maksimal Uraian}} \times 100$$
   - Tombol **Tulis Kunci ke Sheets** untuk mengisi baris 9 secara instan.

4. **Scan & Koreksi Lembar Ujian dengan Kamera HP (Fase 4)**:
   - Guru memilih siswa dari daftar kelas terlebih dahulu (100% akurat).
   - Akses kamera belakang HP (`facingMode: environment`) dengan overlay bingkai kertas HVS.
   - Dukungan multi-halaman (halaman 1 nomor 1-13, halaman 2 nomor 14-25, dst.).
   - **Kompresi Gambar di Browser**: Sisi terpanjang disesuaikan ke ~1600px, JPEG kualitas 0.8 (menghemat kuota hingga 85%).
   - **Layar Review & Koreksi 1-Tap**:
     - Grid nomor dengan warna hijau (benar), merah (salah), dan kuning (ragu/kosong).
     - Opsi pengurutan: *Tampilkan Jawaban Ragu/Kosong Terlebih Dahulu* untuk verifikasi kilat.
     - Koreksi satu ketukan (tap huruf pengganti).
     - Tombol cepat nilai uraian (0, 1, 2, 3..).
   - **Mode Demo**: Tetap dapat dicoba secara utuh meskipun belum memasukkan API key atau URL Web App (mensimulasikan pembacaan lembar contoh IPAS).

5. **Input Manual Cepat (Fitur E)**:
   - Untuk siswa yang kertasnya rusak/terlipat atau ketika guru ingin mengetik deret jawaban langsung dari keyboard fisik.

6. **Integrasi Google Sheets via Google Apps Script (Fase 5)**:
   - Mempertahankan rumus spreadsheet dari kolom `AH` hingga `BL` (seperti `=IF(C10=C$9,1,0)` dan `Na`).
   - Hanya menulis kolom `A` (No), `B` (Nama), dan `C..` (Jawaban PG dan Skor Uraian).
   - Pembaruan baris otomatis berdasarkan nama siswa (timpa baris contoh `CONTO`).
   - Penulisan batch menggunakan `setValues()` (cepat dan hemat kuota script).
   - **Antrean Offline (Sync Queue)**: Jika internet mati saat scan di kelas, nilai tersimpan lokal di IndexedDB dan disinkronkan otomatis begitu tersambung internet.

---

## 🚀 Panduan Setup & Deploy Langkah demi Langkah

### 1. Dapatkan Gemini API Key Gratis di Google AI Studio
1. Kunjungi [Google AI Studio](https://aistudio.google.com/).
2. Masuk menggunakan akun Google Anda.
3. Klik tombol **Get API key** di pojok kiri atas.
4. Klik **Create API key** > Pilih proyek Google Cloud atau buat baru.
5. Salin API Key yang dihasilkan (contoh: `AIzaSy...`).

---

### 2. Deploy Google Apps Script Web App (Backend)
Backend Google Apps Script berfungsi sebagai jembatan aman agar Gemini API Key tersimpan di server Google dan tidak pernah bocor ke browser.

1. Buka spreadsheet Google Sheets Anda (atau buat salinan dari file `ANALISIS SOAL KELAS 4.xlsx`).
2. Di Google Sheets, klik menu **Ekstensi** > **Apps Script**.
3. Hapus kode bawaan di `Code.gs`, lalu salin seluruh isi file [`/apps-script/Code.gs`](file:///C:/Users/SAKA/.gemini/antigravity-ide/scratch/sistem-input-nilai/apps-script/Code.gs) ke editor Apps Script.
4. Simpan Gemini API Key dan Secret Token di Script Properties:
   - Di menu sebelah kiri editor Apps Script, klik ikon roda gigi (**Setelan Project / Project Settings**).
   - Gulir ke bawah ke bagian **Properti Script (Script Properties)**.
   - Klik **Tambahkan properti script (Add script property)**:
     - Properti 1:
       - Nama: `GEMINI_API_KEY`
       - Nilai: *(Tempel Gemini API Key dari Langkah 1)*
     - Properti 2:
       - Nama: `SECRET_TOKEN`
       - Nilai: `guru-sd-super-secret-2026` *(atau token rahasia pilihan Anda)*
   - Klik **Simpan properti script**.
5. Deploy sebagai Web App:
   - Di pojok kanan atas editor Apps Script, klik **Terapkan (Deploy)** > **Penerapan Baru (New deployment)**.
   - Klik ikon gerigi di samping *Select type* > pilih **Aplikasi Web (Web App)**.
   - Konfigurasi:
     - **Deskripsi**: `Sistem Input Nilai Backend v1`
     - **Jalankan sebagai (Execute as)**: **Saya (Email Anda)**
     - **Yang memiliki akses (Who has access)**: **Siapa saja (Anyone)**
   - Klik **Terapkan (Deploy)**.
   - Berikan izin akses akun Google jika diminta (*Lanjutan > Buka Project (tidak aman)*).
   - Salin **URL Aplikasi Web** yang berakhiran `/exec`.

---

### 3. Hubungkan Aplikasi ke Google Apps Script
1. Buka web app **Sistem Input Nilai**.
2. Masuk ke menu **Pengaturan Sheets** di sidebar kiri (atau ikon gerigi).
3. Hapus centang pada **Mode Demo**.
4. Tempelkan URL Web App pada kolom **URL Web App Google Apps Script**.
5. Pastikan **Token Rahasia** sama dengan `SECRET_TOKEN` yang Anda simpan di Script Properties.
6. Klik tombol **Tes Koneksi (Ping)**.
7. Jika muncul indikator hijau `✔ Terhubung!`, integrasi Google Sheets dan AI telah aktif sempurna!
8. Klik **Simpan Perubahan**.

---

## 💻 Menjalankan Aplikasi Secara Lokal

Prasyarat: Node.js (v18 ke atas)

```bash
# Masuk ke direktori proyek
cd sistem-input-nilai

# Jalankan server pengembangan lokal
npm run dev
```

Buka peramban di `http://localhost:5173/`.

### Menjalankan Pengujian Unit Rumus Nilai
```bash
npm test
```
*Hasil uji: Memvalidasi perhitungan bobot 25 PG + 5 Uraian terhadap rumus kolom BL spreadsheet.*

### Build Produksi
```bash
npm run build
```
*Ukuran bundle JS gzip hanya ~28 KB (sangat ringan di jaringan seluler).*

---

## 🌐 Deploy Frontend Gratis ke Internet (Vercel / Netlify / GitHub Pages)

### A. Deploy ke Vercel (Paling Mudah)
1. Unggah folder proyek ini ke repositori GitHub Anda.
2. Buka [Vercel](https://vercel.com/) dan klik **Add New Project**.
3. Impor repositori GitHub Anda.
4. Pengaturan build terdeteksi otomatis (`Vite`, build command: `npm run build`, output: `dist`).
5. Klik **Deploy**. Web app langsung aktif dengan HTTPS gratis (kamera HP siap digunakan).

### B. Deploy ke Netlify
1. Buka [Netlify](https://app.netlify.com/).
2. Tarik dan lepas (*drag-and-drop*) folder `dist` (hasil `npm run build`) ke dashboard Netlify.
3. Aplikasi langsung online dengan tautan HTTPS gratis.

---

## 📋 Asumsi Teknis yang Digunakan

1. **Struktur Lembar Ujian**:
   - Lembar ujian berupa lembar soal HVS cetak biasa (bukan LJK bulat).
   - Siswa menyilang (X) atau melingkari huruf opsi A, B, C, atau D.
   - Satu siswa dapat terdiri dari 1 hingga 3 foto lembar (misal halaman 1 memuat soal 1-13, halaman 2 memuat soal 14-25 dan uraian).
2. **Kerahasiaan Kunci & Keamanan**:
   - Gemini API Key tidak pernah disimpan di kode browser klien. Semua permintaan scan dikirimkan ke Google Apps Script yang menyimpan API Key di `ScriptProperties`.
3. **Penyimpanan Lokal & PWA**:
   - IndexedDB digunakan untuk penyimpanan persisten kelas, murid, kunci, dan antrean sinkron offline.
   - Dilengkapi fungsi cadangan (*Backup & Restore*) satu berkas JSON di menu Pengaturan.
