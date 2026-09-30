/**
 * Gemini AI Vision Service & Prompt Definition
 * Formats prompt for multi-page handwritten crosses/marks detection on printed exam sheets.
 * Includes Demo Mode simulator that provides realistic output matching actual exam papers.
 */

export const GEMINI_PROMPT_SYSTEM = `
Anda adalah asisten AI pemeriksa lembar ujian siswa Sekolah Dasar (SD) di Indonesia.
Tugas Anda adalah membaca tanda silang (X) atau tanda centang/lingkaran yang dibuat siswa pada huruf opsi pilihan ganda (A, B, C, D).

KARAKTERISTIK LEMBAR UJIAN:
1. Lembar ujian berupa lembar cetak kertas HVS standar (bukan LJK bulat OMR).
2. Opsi A, B, C, D bisa tersusun horizontal, vertikal, atau dalam 2 kolom.
3. Siswa MENYILANG (X) atau melingkari huruf opsi secara langsung dengan pensil atau pulpen.
4. Huruf opsi yang TERTIMPA / TERCANTEL tanda silang atau coretan adalah pilihan jawaban siswa.
5. Gambar mungkin terdiri dari 1, 2, atau 3 halaman bersambung nomornya.

ATURAN PEMERIKSAAN KETAT:
- Jika siswa menyilang salah satu opsi dengan jelas, kembalikan jawaban huruf tersebut ("A", "B", "C", atau "D") dengan confidence tinggi (0.85 - 1.0).
- Jika ada dua opsi disilang tetapi salah satunya dicoret/ditumpuk (koreksi oleh siswa), pilih opsi yang paling jelas merupakan pilihan finalnya, berikan confidence lebih rendah (0.5 - 0.7), dan isi 'catatan' (misal: "Ada coretan di opsi A, final B").
- Jika tidak ada tanda silang sama sekali pada nomor tersebut, kembalikan jawaban: null, confidence: 1.0, catatan: "Tidak dijawab".
- Jika nomor soal atau opsi tertutup bayangan / buram / tidak terbaca, jangan menebak! Kembalikan jawaban: null, confidence: 0.2, catatan: "Tidak terbaca jelas".
- Baca nomor soal secara berurutan sesuai nomor yang tertera pada soal (misal halaman 1 nomor 1-13, halaman 2 nomor 14-25). Abaikan bagian Uraian/Essay (Bagian II) karena dinilai manual oleh guru.

FORMAT KELUARAN WAJIB JSON MURNI:
{
  "detectedStudentName": string atau null (jika terbaca di header lembar),
  "detectedSubject": string atau null,
  "detectedClass": string atau null,
  "questions": [
    {
      "no": 1,
      "jawaban": "A",
      "confidence": 0.95,
      "catatan": ""
    }
  ]
}
`;

/**
 * Realistic Mock Scan for Demo Mode
 * Matches the actual answers from the user's sample exam paper:
 * Page 1 (Q1-Q13) & Page 2 (Q14-Q25)
 */
export function simulateDemoScan(pgCount = 25) {
  // Real answers taken from the sample exam paper:
  // Q1: A (matahari)
  // Q2: B (curah hujan yang tinggi)
  // Q3: D (setrika)
  // Q4: C (oksigen)
  // Q5: C (gerak)
  // Q6: A (tumbuhan tidak memerlukan air)
  // Q7: B (energi cahaya menjadi energi gerak)
  // Q8: B (ikan dan tumbuhan air...)
  // Q9: B (energi listrik menjadi energi cahaya)
  // Q10: A (adanya pengolahan air limbah)
  // Q11: A (biji)
  // Q12: D (adanya tanah yang subur)
  // Q13: B (1 dan 4)
  // Q14: A ((1) dan (2))
  // Q15: A (menggunakan transportasi umum)
  // Q16: B (menanam dan merawat...)
  // Q17: A (mempelajari budaya lokal)
  // Q18: B (angklung)
  // Q19: A (turbin)
  // Q20: B (bernapas)
  // Q21: B (tidak kehilangan identitas)
  // Q22: A (energi cahaya matahari...)
  // Q23: A (mendapatkan air)
  // Q24: B (energi selalu berubah...)
  // Q25: C (daun)
  const samplePaperAnswers = [
    { no: 1, jawaban: 'A', confidence: 0.98, catatan: 'Silang jelas di A' },
    { no: 2, jawaban: 'B', confidence: 0.72, catatan: 'Ada bekas pensil di A, silang tebal di B' },
    { no: 3, jawaban: 'D', confidence: 0.95, catatan: '' },
    { no: 4, jawaban: 'C', confidence: 0.96, catatan: '' },
    { no: 5, jawaban: 'C', confidence: 0.94, catatan: '' },
    { no: 6, jawaban: 'A', confidence: 0.97, catatan: '' },
    { no: 7, jawaban: 'B', confidence: 0.95, catatan: '' },
    { no: 8, jawaban: 'B', confidence: 0.96, catatan: '' },
    { no: 9, jawaban: 'B', confidence: 0.93, catatan: '' },
    { no: 10, jawaban: 'A', confidence: 0.95, catatan: '' },
    { no: 11, jawaban: 'A', confidence: 0.98, catatan: '' },
    { no: 12, jawaban: 'D', confidence: 0.94, catatan: '' },
    { no: 13, jawaban: 'B', confidence: 0.91, catatan: '' },
    { no: 14, jawaban: 'A', confidence: 0.96, catatan: '' },
    { no: 15, jawaban: 'A', confidence: 0.95, catatan: '' },
    { no: 16, jawaban: 'B', confidence: 0.97, catatan: '' },
    { no: 17, jawaban: 'A', confidence: 0.96, catatan: '' },
    { no: 18, jawaban: 'B', confidence: 0.98, catatan: '' },
    { no: 19, jawaban: 'A', confidence: 0.94, catatan: '' },
    { no: 20, jawaban: 'B', confidence: 0.95, catatan: '' },
    { no: 21, jawaban: 'B', confidence: 0.93, catatan: '' },
    { no: 22, jawaban: 'A', confidence: 0.95, catatan: '' },
    { no: 23, jawaban: 'A', confidence: 0.65, catatan: 'Silang agak tipis, mohon verifikasi' },
    { no: 24, jawaban: 'B', confidence: 0.96, catatan: '' },
    { no: 25, jawaban: 'C', confidence: 0.92, catatan: '' }
  ];

  const questions = [];
  for (let i = 1; i <= pgCount; i++) {
    if (i <= samplePaperAnswers.length) {
      questions.push(samplePaperAnswers[i - 1]);
    } else {
      const opts = ['A', 'B', 'C', 'D'];
      const chosen = opts[Math.floor(Math.random() * opts.length)];
      questions.push({
        no: i,
        jawaban: chosen,
        confidence: 0.92,
        catatan: ''
      });
    }
  }

  return {
    detectedStudentName: 'Aditia Pratama',
    detectedSubject: 'IPAS',
    detectedClass: 'IV (Empat)',
    questions
  };
}
