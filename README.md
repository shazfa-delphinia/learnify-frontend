# Learnify

Learnify adalah platform pembelajaran berbasis chatbot yang membantu pengguna menemukan jalur belajar yang sesuai dengan minat dan tujuan mereka. Dengan menggunakan teknologi Machine Learning, Learnify memberikan rekomendasi pembelajaran yang personal dan adaptif. Pengguna dapat berinteraksi langsung dengan chatbot untuk mendapatkan panduan belajar, memilih topik yang diminati, dan menerima saran yang relevan berdasarkan profil mereka. Platform ini dirancang untuk membuat proses pembelajaran menjadi lebih terstruktur, efisien, dan menyenangkan.

# Tools yang Digunakan

Frontend
HTML - Menentukan struktur dasar halaman web
CSS - Mengatur tampilan dan gaya visual halaman web
JavaScript - Menambahkan interaksi dan logika pada halaman web
Figma - Digunakan untuk desain UI/UX dan membuat prototipe aplikasi

Backend & Database
Node.js - Menjalankan JavaScript di server untuk membuat backend
Supabase - Layanan database/storage untuk backend siap pakai 

Tools Lainnya
Python - Mengolah data pengguna untuk membuat fitur personalisasi belajar
GitHub - Platform untuk menyimpan kode dan kolaborasi
Vercel - Platform deployment untuk hosting aplikasi
Postman - Platform untuk deploy dan hosting website langsung dari GitHub

# Frontend
Frontend proyek ini dibangun dengan teknologi dasar web yang dipadukan untuk menghasilkan tampilan yang responsif dan fungsional:

HTML: Digunakan sebagai fondasi untuk membangun struktur dasar halaman web. HTML menyediakan kerangka yang jelas dan semantik untuk semua elemen dalam aplikasi.
CSS: Diterapkan untuk mengatur tampilan dan gaya visual halaman web. CSS memastikan desain yang konsisten, responsif, dan menarik secara visual di berbagai ukuran layar.
JavaScript: Menambahkan interaksi dan logika pada halaman web. JavaScript memungkinkan fitur-fitur dinamis seperti chat interaktif, validasi form, dan manipulasi DOM secara real-time.

# Penggunaan
A. Persiapan 
install visual studio code
install extension live server 
install Node.js (LTS) + npm
install Python

B. jalankan frontend (index.html pakai Live Server)
1. Buka folder project di VS Code:
File → Open Folder → pilih folder LEARNIFY BLM ROADMAP 
2. Klik kanan index.html → pilih “Open with Live Server”. Browser akan kebuka otomatis dan Frontend sudah jalan.
Catatan: Live Server hanya untuk frontend statis (HTML/CSS/JS). Untuk fitur login/chatbot/dll, tetap perlu backend & ML server. 

C. Jalankan Backend (Node.js)
1. Buka terminal di VS Code: Terminal → New Terminal 
2. Masuk ke folder backend: cd learnify-backend 
3. Install dependency backend: npm install 
4. Jalankan server backend: node server.js 

D. Jalankan ML / Python Server
ML server ini jalan terpisah, lalu backend/frontend akan request ke ML server.
1. Buka terminal baru (jangan tutup terminal backend)
2. Pastikan posisi terminal berada di folder utama project
Jika masih di learnify-backend, kembali dulu: cd ..
3. Install dependency Python: pip install -r requirements.txt 
4. Jalankan ML server: python ml_server.py
ML server berhasil berjalan jika muncul log bahwa server aktif (misalnya running di localhost). 

Catatan Tambahan
Jika terjadi error:
- Pastikan Node.js dan Python sudah terinstall
- Pastikan semua dependency berhasil terinstall
- Pastikan backend dan ML server sedang berjalan sebelum menggunakan fitur chatbot


# Alur ringkas menjalankan website
Urutan yang disarankan:
1. Jalankan Backend (Node.js)
2. Jalankan ML Server (Python)
3. Jalankan Frontend (Live Server – index.html)

# API 
API Learning Buddy (Learning Paths, Courses, Course Levels, Tutorials):
https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/learning_paths
https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/courses
https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/course_levels
https://jrkqcbmjknzgpbtrupxh.supabase.co/rest/v1/tutorials 

1. AUTH 
POST /auth/register - menyimpan user baru (nama, email)
POST / auth/login - mengambil data user berdasarkan email 

2. LEARNING PATH QUIZ 
GET /quiz/lp/questions - mengambil semua pertanyaan LP Quiz 
POST /quiz/lp/submit - kirim jawaban user kemudian hitung score dan sumpan ke user_learning_path_result

3. LEVEL QUIZ 
GET /quiz/level/questions - ambil soal untuk learning path tertentu 
POST /quiz/level/submit - kirim jawaban user kemudian hitung score dan simpan ke user_level_result 

4. LEARNING PATH & COURSE 
GET /learning-paths - ambil semua LP 
GET /learning-paths/:id/courses - ambil course berdasarkan LP 
GET /courses/:id/tutorials - ambil tutorial dalam satu course 

5. USER ROADMAP 
POST /user/roadmap/generate - menyimpan roadmap hasil rekomendasi chatbot 
GET /user/:id/roadmap - mengambil roadmap milik user 
