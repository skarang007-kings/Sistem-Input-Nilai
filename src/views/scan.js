/**
 * Scan & Koreksi View (Fase 4)
 * Core camera flow, client-side compression, AI reading (Gemini / Demo Simulator),
 * and rich Review & Correction Screen with live score calculation.
 */

import { db } from '../db/storage.js';
import { icons } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { cameraService } from '../services/camera.js';
import { compressImage } from '../services/compressor.js';
import { simulateDemoScan } from '../services/gemini.js';
import { calculateGrade, getScoreCategory } from '../services/grading.js';
import { syncService } from '../services/sync.js';

export async function renderScan(container, navigate) {
  const classes = await db.getAll('classes');
  const subjects = await db.getAll('subjects');
  const allStudents = await db.getAll('students');
  const settings = (await db.getById('settings', 'app_config')) || {};

  let selectedClassId = settings.activeClassId || classes[0]?.id || '';
  let selectedSubjectId = settings.activeSubjectId || subjects[0]?.id || '';
  let selectedStudentId = '';

  // State
  let capturedPages = []; // array of { blob, dataUrl, compressed }
  let isScanningAI = false;
  let scanResults = null; // review state

  function getStudentsForClass() {
    return allStudents.filter(s => s.classId === selectedClassId).sort((a, b) => a.rollNumber - b.rollNumber);
  }

  function renderSetupStep() {
    const classStudents = getStudentsForClass();
    const activeSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0];

    container.innerHTML = `
      <div class="main-topbar">
        <div class="topbar-breadcrumbs">
          <span>Aplikasi</span>
          <span>/</span>
          <span class="active">Scan & Koreksi</span>
        </div>
      </div>

      <div class="page-header-row">
        <div>
          <h1 class="page-title">Scan Lembar Ujian Siswa</h1>
          <p class="card-subtitle" style="margin-top: 4px;">Pilih identitas siswa dan mata pelajaran sebelum memotret lembar kertas.</p>
        </div>
        ${settings.demoMode || !settings.webAppUrl ? `
          <div class="badge badge-warning" style="padding: 6px 12px;">
            ⚡ Mode Demo Aktif (Simulasi Scan Lembar Contoh)
          </div>
        ` : ''}
      </div>

      <!-- Selection Card -->
      <div class="card" style="max-width: 680px;">
        <div class="card-header">
          <div class="card-title">${icons.students(18)} Identitas Ujian & Siswa</div>
          <span class="card-subtitle">Langkah 1 dari 3</span>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Kelas</label>
          <select id="selClass" class="form-select">
            ${classes.map(c => `
              <option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>
                Kelas ${c.name} (${c.academicYear})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Mata Pelajaran</label>
          <select id="selSubject" class="form-select">
            ${subjects.map(s => `
              <option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>
                ${s.name} (Sheet: ${s.sheetName})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Pilih Murid yang Dikoreksi</label>
          <select id="selStudent" class="form-select">
            <option value="">-- Pilih Nama Siswa dari Daftar --</option>
            ${classStudents.map(s => `
              <option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>
                ${s.rollNumber}. ${s.name} (${s.gender === 'P' ? 'Perempuan' : 'Laki-laki'})
              </option>
            `).join('')}
          </select>
          <span class="form-help">Nama dipilih manual agar 100% akurat sesuai presensi kelas.</span>
        </div>

        <div style="display: flex; gap: 12px; margin-top: 24px;">
          <button type="button" class="btn btn-primary" id="btnGoToCamera" style="flex: 1;" ${!classStudents.length ? 'disabled' : ''}>
            ${icons.camera(18)} Buka Kamera Scan
          </button>
          <button type="button" class="btn btn-secondary" id="btnGoToManual" style="flex: 1;">
            ${icons.manual(18)} Input Manual (Tanpa Foto)
          </button>
        </div>
      </div>
    `;

    // Listeners
    container.querySelector('#selClass').addEventListener('change', (e) => {
      selectedClassId = e.target.value;
      renderSetupStep();
    });

    container.querySelector('#selSubject').addEventListener('change', (e) => {
      selectedSubjectId = e.target.value;
    });

    container.querySelector('#selStudent').addEventListener('change', (e) => {
      selectedStudentId = e.target.value;
    });

    container.querySelector('#btnGoToCamera').addEventListener('click', () => {
      const studentSelect = container.querySelector('#selStudent');
      if (!studentSelect.value) {
        toast.warning('Pilih siswa terlebih dahulu!');
        return;
      }
      selectedStudentId = studentSelect.value;
      renderCameraStep();
    });

    container.querySelector('#btnGoToManual').addEventListener('click', () => {
      navigate('manual');
    });
  }

  function renderCameraStep() {
    const student = allStudents.find(s => s.id === selectedStudentId);
    const subject = subjects.find(s => s.id === selectedSubjectId);

    container.innerHTML = `
      <div class="main-topbar">
        <div class="topbar-breadcrumbs">
          <span>Scan & Koreksi</span>
          <span>/</span>
          <span class="active">Kamera Pengambilan Foto</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnCancelScan">
          ${icons.x(14)} Batal
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div>
          <h2 style="font-size: 18px; font-weight: 700; color: #fff;">
            Siswa: ${student?.rollNumber}. ${student?.name}
          </h2>
          <p class="card-subtitle">Mapel: ${subject?.name} • Target Sheet: ${subject?.sheetName}</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="file" id="fileFallbackInput" accept="image/*" capture="environment" style="display: none;" />
          <button type="button" class="btn btn-secondary btn-sm" id="btnUploadFileAlt">
            ${icons.upload(14)} Unggah dari File
          </button>
        </div>
      </div>

      <!-- Camera Viewport with paper guide -->
      <div class="scanner-viewport" id="scannerViewport">
        <video id="scanVideo" class="scanner-video" autoplay playsinline muted></video>

        <!-- Paper Alignment Overlay -->
        <div class="paper-guide-overlay">
          <div class="paper-guide-text">
            Posisikan Kertas Lembar Ujian di Dalam Kotak
          </div>
          <div class="paper-guide-text" style="background: rgba(0,0,0,0.85); font-size: 11px;">
            Pastikan tanda silang (X) terlihat tajam dan tidak tertutup bayangan
          </div>
        </div>

        <!-- Shutter Button -->
        <div class="scanner-controls">
          <button type="button" class="capture-btn" id="btnCaptureShutter" title="Ambil Foto Lembar">
            <div class="capture-btn-inner"></div>
          </button>
        </div>
      </div>

      <!-- Captured Pages Thumbnails & Multi-Page Bar -->
      <div style="margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="font-size: 13.5px; font-weight: 600; color: #fff;">
            Foto Halaman Tersimpan (${capturedPages.length} Halaman)
          </div>
          ${capturedPages.length > 0 ? `
            <button type="button" class="btn btn-primary btn-sm" id="btnProceedToReview">
              ${icons.lightning(14)} Proses & Koreksi dengan AI (${capturedPages.length} Halaman)
            </button>
          ` : ''}
        </div>

        <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;" id="capturedThumbnailsWrap">
          ${capturedPages.map((page, idx) => `
            <div style="position: relative; width: 100px; height: 130px; border-radius: var(--radius-sm); border: 2px solid var(--accent-lime); overflow: hidden; background: #000; flex-shrink: 0;">
              <img src="${page.dataUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.75); color: #fff; font-size: 10px; text-align: center; padding: 2px;">
                Hal ${idx + 1} (${page.compressed ? Math.round(page.compressed.compressedSize / 1024) + ' KB' : ''})
              </div>
              <button type="button" class="btn-remove-page" data-idx="${idx}" style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(239, 68, 68, 0.85); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px;">
                ✕
              </button>
            </div>
          `).join('')}

          ${capturedPages.length === 0 ? `
            <div style="padding: 16px; background: var(--bg-surface); border-radius: var(--radius-sm); color: var(--text-muted); font-size: 12.5px; width: 100%;">
              Belum ada foto yang diambil. Tekan tombol bulat di atas atau gunakan "Unggah dari File".
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Start Camera Stream
    const videoEl = container.querySelector('#scanVideo');
    cameraService.startCamera(videoEl).catch(err => {
      console.warn('Camera stream error:', err);
      toast.warning('Kamera tidak dapat diakses langsung. Anda dapat mengunggah foto lembar ujian.');
    });

    // Capture Frame Listener
    container.querySelector('#btnCaptureShutter').addEventListener('click', async () => {
      try {
        const frame = await cameraService.captureFrame(videoEl);
        // Compress image immediately (client-side)
        const compressed = await compressImage(frame.blob, 1600, 0.8);
        capturedPages.push({
          blob: frame.blob,
          dataUrl: frame.dataUrl,
          compressed
        });
        toast.success(`Halaman ${capturedPages.length} berhasil dipotret! (${Math.round(compressed.compressedSize / 1024)} KB)`);
        renderCameraStep();
      } catch (err) {
        toast.error('Gagal mengambil foto: ' + err.message);
      }
    });

    // File input fallback
    const fileInp = container.querySelector('#fileFallbackInput');
    container.querySelector('#btnUploadFileAlt').addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const compressed = await compressImage(file, 1600, 0.8);
        capturedPages.push({
          blob: file,
          dataUrl: compressed.dataUrl,
          compressed
        });
        toast.success(`Foto halaman ditambahkan! (${Math.round(compressed.compressedSize / 1024)} KB)`);
        renderCameraStep();
      } catch (err) {
        toast.error('Gagal memproses file gambar: ' + err.message);
      }
    });

    // Delete thumbnail
    container.querySelectorAll('.btn-remove-page').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        capturedPages.splice(idx, 1);
        renderCameraStep();
      });
    });

    // Cancel scan
    container.querySelector('#btnCancelScan').addEventListener('click', () => {
      cameraService.stopCamera();
      renderSetupStep();
    });

    // Proceed to AI Scan & Review
    container.querySelector('#btnProceedToReview')?.addEventListener('click', async () => {
      cameraService.stopCamera();
      await executeAIScan();
    });
  }

  async function executeAIScan() {
    const student = allStudents.find(s => s.id === selectedStudentId);
    const subject = subjects.find(s => s.id === selectedSubjectId);

    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 60px 20px; max-width: 540px; margin: 40px auto;">
        <div style="width: 60px; height: 60px; border: 4px solid var(--accent-lime); border-top-color: transparent; border-radius: 50%; margin: 0 auto 24px; animation: spin 1s linear infinite;"></div>
        <h2 style="font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 8px;">
          Menganalisis Lembar Ujian...
        </h2>
        <p style="font-size: 13.5px; color: var(--text-secondary); line-height: 1.5;">
          AI Vision sedang membaca tanda silang (X) pada opsi A, B, C, D untuk ${subject.name} (${capturedPages.length} Halaman)...
        </p>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;

    try {
      let aiResult = null;

      if (!settings.demoMode && settings.webAppUrl) {
        // Send compressed images to Apps Script Web App
        const imagesPayload = capturedPages.map(p => ({
          base64: p.compressed.base64,
          mimeType: 'image/jpeg'
        }));

        const res = await syncService.callBackend('scan', {
          images: imagesPayload,
          model: settings.geminiModel || 'gemini-1.5-flash'
        });

        aiResult = res.data;
      } else {
        // Realistic Demo Simulation matching exam paper
        await new Promise(r => setTimeout(r, 1200)); // slight natural delay
        aiResult = simulateDemoScan(subject.pgCount || 25);
      }

      // Initialize review state
      renderReviewStep(aiResult);
    } catch (err) {
      console.error('Scan error:', err);
      toast.error('Gagal membaca lembar ujian: ' + err.message);
      // Fallback to manual review with empty/demo answers
      renderReviewStep(simulateDemoScan(subject.pgCount || 25));
    }
  }

  function renderReviewStep(aiResult) {
    const student = allStudents.find(s => s.id === selectedStudentId);
    const subject = subjects.find(s => s.id === selectedSubjectId);
    const pgCount = subject.pgCount || 25;
    const keys = subject.answerKeys || [];
    const hasUraian = !!subject.hasUraian;
    const uraianMaxScores = subject.uraianMaxScores || [3, 3, 3, 2, 2];

    // State for answers in review
    let currentAnswers = [];
    for (let i = 1; i <= pgCount; i++) {
      const detected = aiResult?.questions?.find(q => Number(q.no) === i);
      currentAnswers.push({
        no: i,
        jawaban: detected?.jawaban || null,
        confidence: detected?.confidence ?? 1.0,
        catatan: detected?.catatan || ''
      });
    }

    // Default uraian scores from teacher (initialized to max or 0)
    let uraianScores = hasUraian ? uraianMaxScores.map(m => Math.min(3, m)) : [];
    let filterLowConfidenceFirst = false;

    function updateReviewUI() {
      // Calculate grade live
      const grade = calculateGrade({
        answers: currentAnswers,
        keys,
        pgCount,
        uraianScores,
        uraianMaxScores: hasUraian ? uraianMaxScores : []
      });

      const cat = getScoreCategory(grade.finalScore);

      // Questions to render, sorted if teacher toggled
      let displayItems = [...grade.itemResults];
      if (filterLowConfidenceFirst) {
        displayItems.sort((a, b) => {
          const aPriority = (!a.studentAnswer || a.confidence < 0.8) ? 0 : 1;
          const bPriority = (!b.studentAnswer || b.confidence < 0.8) ? 0 : 1;
          return aPriority - bPriority;
        });
      }

      container.innerHTML = `
        <div class="main-topbar">
          <div class="topbar-breadcrumbs">
            <span>Scan & Koreksi</span>
            <span>/</span>
            <span class="active">Layar Review & Koreksi Guru</span>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btnRetakePhoto">
            ${icons.camera(14)} Foto Ulang
          </button>
        </div>

        <!-- Student & Live Score Header Card -->
        <div class="card" style="background: linear-gradient(135deg, #18191c 0%, #1f221a 100%); border-color: rgba(198, 255, 74, 0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <span class="badge badge-lime" style="margin-bottom: 6px;">Pemeriksaan Selesai</span>
              <h1 style="font-size: 22px; font-weight: 700; color: #fff;">
                ${student?.rollNumber}. ${student?.name}
              </h1>
              <p class="card-subtitle">
                Mata Pelajaran: <strong>${subject?.name}</strong> • Sheet: <strong>${subject?.sheetName}</strong>
              </p>
            </div>

            <!-- Score Summary Badges -->
            <div style="display: flex; gap: 14px; align-items: center;">
              <div style="text-align: right;">
                <div style="font-size: 11.5px; color: var(--text-muted);">Nilai Akhir (Na)</div>
                <div style="font-size: 32px; font-weight: 800; color: var(--accent-lime); line-height: 1;">
                  ${grade.finalScore}
                </div>
                <div style="font-size: 11px; font-weight: 600; color: ${cat.color};">
                  Predikat: ${cat.label}
                </div>
              </div>

              <div style="border-left: 1px solid var(--border-subtle); padding-left: 14px; display: flex; flex-direction: column; gap: 4px; font-size: 12px;">
                <div>Benar PG: <strong>${grade.pgCorrect}</strong> / ${pgCount}</div>
                <div>Salah PG: <strong style="color: var(--color-danger);">${grade.pgWrong}</strong></div>
                <div>Kosong: <strong style="color: var(--color-warning);">${grade.pgEmpty}</strong></div>
                ${hasUraian ? `<div>Skor Uraian: <strong>${grade.totalUraianScore}</strong> / ${grade.totalUraianMax}</div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- Review Controls Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0 12px; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 14px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
            <span>Koreksi Hasil Bacaan AI (${pgCount} Soal PG)</span>
            <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">• Tap huruf untuk mengubah jawaban siswa</span>
          </div>

          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); cursor: pointer; user-select: none;">
            <input type="checkbox" id="chkSortConfidence" ${filterLowConfidenceFirst ? 'checked' : ''} />
            <span>Tampilkan Jawaban Ragu / Kosong Terlebih Dahulu</span>
          </label>
        </div>

        <!-- Questions Review Grid -->
        <div class="review-grid">
          ${displayItems.map(item => {
            const isCorrect = item.isCorrect;
            const isWrong = !!item.studentAnswer && !item.isCorrect;
            const isEmpty = !item.studentAnswer;
            const isLowConf = item.confidence < 0.75;

            let cardClass = isCorrect ? 'is-correct' : (isWrong ? 'is-wrong' : 'is-empty');
            if (isLowConf && !isEmpty) cardClass += ' is-low-conf';

            return `
              <div class="review-item ${cardClass}">
                <div class="review-header">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 700; font-size: 14px; color: #fff;">No. ${item.no}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">Kunci: <strong style="color: var(--accent-lime);">${item.key || '-'}</strong></span>
                  </div>
                  <div>
                    ${isCorrect ? `<span class="badge badge-success" style="font-size: 10.5px;">✔ Benar</span>` : ''}
                    ${isWrong ? `<span class="badge badge-danger" style="font-size: 10.5px;">✕ Salah</span>` : ''}
                    ${isEmpty ? `<span class="badge badge-warning" style="font-size: 10.5px;">Kosong</span>` : ''}
                    ${isLowConf && !isEmpty ? `<span class="badge badge-warning" style="font-size: 10.5px;">Ragu (${Math.round(item.confidence * 100)}%)</span>` : ''}
                  </div>
                </div>

                <!-- 1-Tap Option Buttons -->
                <div class="review-options">
                  ${['A', 'B', 'C', 'D'].map(opt => {
                    const isSelected = item.studentAnswer === opt;
                    const isKey = item.key === opt;
                    let btnClass = '';
                    if (isSelected && isCorrect) btnClass = 'active-correct';
                    else if (isSelected && !isCorrect) btnClass = 'active-wrong';
                    else if (isSelected) btnClass = 'active-selected';
                    if (isKey) btnClass += ' is-key-indicator';

                    return `
                      <button type="button" class="review-opt-btn ${btnClass}" data-no="${item.no}" data-opt="${opt}">
                        ${opt}
                      </button>
                    `;
                  }).join('')}
                  <button type="button" class="review-opt-btn btn-clear-opt" data-no="${item.no}" title="Kosongkan Jawaban" style="font-size: 11px; color: var(--text-muted);">
                    ✕
                  </button>
                </div>

                ${item.note ? `
                  <div style="font-size: 11px; color: var(--color-warning); font-style: italic;">
                    Catatan AI: ${item.note}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Uraian Section -->
        ${hasUraian ? `
          <div class="card" style="margin-top: 20px;">
            <div class="card-header">
              <div>
                <div class="card-title">Bagian II: Penilaian Uraian (Manual Guru)</div>
                <div class="card-subtitle">Beri nilai angka (0 sampai skor maksimal) sesuai rubrik lembar kertas siswa</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px;">
              ${uraianMaxScores.map((maxScore, idx) => {
                const qNum = pgCount + idx + 1;
                const currentScore = uraianScores[idx] ?? 0;
                return `
                  <div style="background: var(--bg-surface); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                      <span style="font-weight: 700; color: #fff;">Soal No. ${qNum}</span>
                      <span style="font-size: 11.5px; color: var(--text-muted);">Maks: ${maxScore}</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                      ${Array.from({ length: maxScore + 1 }).map((_, pt) => `
                        <button type="button" class="btn-uraian-score ${currentScore === pt ? 'btn-primary' : 'btn-secondary'}" data-idx="${idx}" data-score="${pt}" style="flex: 1; padding: 6px 0; font-size: 12px; font-weight: 700; border-radius: var(--radius-xs);">
                          ${pt}
                        </button>
                      `).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Bottom Action Sticky Bar -->
        <div style="position: sticky; bottom: 16px; background: rgba(18, 19, 22, 0.95); backdrop-filter: blur(12px); border: 1px solid var(--border-card); border-radius: var(--radius-pill); padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; margin-top: 24px; box-shadow: var(--shadow-card); z-index: 100;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 13.5px; color: var(--text-secondary);">Nilai Akhir:</span>
            <span style="font-size: 24px; font-weight: 800; color: var(--accent-lime);">${grade.finalScore}</span>
          </div>

          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn btn-secondary" id="btnCancelReview">
              Batal
            </button>
            <button type="button" class="btn btn-primary" id="btnSaveResultConfirm">
              ${icons.sync(16)} Simpan & Kirim ke Google Sheets
            </button>
          </div>
        </div>
      `;

      bindReviewEvents(grade);
    }

    function bindReviewEvents(grade) {
      // Toggle Sort Low Confidence First
      container.querySelector('#chkSortConfidence')?.addEventListener('change', (e) => {
        filterLowConfidenceFirst = e.target.checked;
        updateReviewUI();
      });

      // 1-Tap Option change
      container.querySelectorAll('.review-opt-btn[data-opt]').forEach(btn => {
        btn.addEventListener('click', () => {
          const qNo = parseInt(btn.dataset.no, 10);
          const opt = btn.dataset.opt;
          const found = currentAnswers.find(a => a.no === qNo);
          if (found) {
            found.jawaban = opt;
            found.confidence = 1.0;
            found.catatan = 'Divalidasi guru';
          }
          updateReviewUI();
        });
      });

      // Clear option
      container.querySelectorAll('.btn-clear-opt').forEach(btn => {
        btn.addEventListener('click', () => {
          const qNo = parseInt(btn.dataset.no, 10);
          const found = currentAnswers.find(a => a.no === qNo);
          if (found) {
            found.jawaban = null;
            found.confidence = 1.0;
            found.catatan = 'Dikosongkan guru';
          }
          updateReviewUI();
        });
      });

      // Uraian score tap
      container.querySelectorAll('.btn-uraian-score').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          const score = parseInt(btn.dataset.score, 10);
          uraianScores[idx] = score;
          updateReviewUI();
        });
      });

      // Retake photo
      container.querySelector('#btnRetakePhoto')?.addEventListener('click', () => {
        capturedPages = [];
        renderCameraStep();
      });

      // Cancel
      container.querySelector('#btnCancelReview')?.addEventListener('click', () => {
        renderSetupStep();
      });

      // Confirm & Save
      container.querySelector('#btnSaveResultConfirm')?.addEventListener('click', async () => {
        const btn = container.querySelector('#btnSaveResultConfirm');
        btn.disabled = true;
        btn.innerHTML = 'Menyimpan...';

        const resultRecord = {
          id: 'res_' + Date.now(),
          classId: selectedClassId,
          className: classes.find(c => c.id === selectedClassId)?.name || '',
          subjectId: selectedSubjectId,
          subjectName: subject.name,
          sheetName: subject.sheetName,
          studentId: student.id,
          studentRoll: student.rollNumber,
          studentName: student.name,
          pgCount,
          pgCorrect: grade.pgCorrect,
          pgWrong: grade.pgWrong,
          answers: currentAnswers.map(a => a.jawaban), // Array of letters A-D
          uraianScores: hasUraian ? uraianScores : [],
          totalScoreEarned: grade.totalScoreEarned,
          totalMaxPossible: grade.totalMaxPossible,
          finalScore: grade.finalScore,
          category: cat.code,
          layout: subject.layout || { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' },
          syncStatus: 'pending',
          createdAt: new Date().toISOString()
        };

        // Save local
        await db.put('results', resultRecord);

        // Sync to Sheets
        try {
          const syncRes = await syncService.saveResultToSheets(resultRecord);
          if (syncRes.mode === 'demo') {
            toast.success(`Nilai ${student.name} (${grade.finalScore}) berhasil disimpan! (Mode Demo)`);
          } else if (syncRes.success) {
            toast.success(`Berhasil! Nilai ${student.name} tertulis di Google Sheets.`);
          } else {
            toast.warning(syncRes.message);
          }
        } catch (err) {
          toast.error('Gagal sinkron ke Google Sheets: ' + err.message);
        }

        // Offer next student
        renderDoneStep(student, grade);
      });
    }

    updateReviewUI();
  }

  function renderDoneStep(student, grade) {
    const classStudents = getStudentsForClass();
    const nextStudent = classStudents.find(s => s.rollNumber === student.rollNumber + 1);

    container.innerHTML = `
      <div class="card" style="text-align: center; max-width: 520px; margin: 40px auto; padding: 40px 24px;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--accent-lime); color: var(--text-on-lime); display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px; box-shadow: var(--shadow-lime);">
          ✔
        </div>
        <h2 style="font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 6px;">
          Koreksi Berhasil Disimpan!
        </h2>
        <p style="font-size: 14px; color: var(--text-secondary); margin-bottom: 24px;">
          Nilai untuk <strong>${student.name}</strong> adalah <strong>${grade.finalScore}</strong> (Kategori: ${getScoreCategory(grade.finalScore).label}).
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${nextStudent ? `
            <button type="button" class="btn btn-primary" id="btnNextStudent" style="width: 100%;">
              Lanjut ke Siswa Berikutnya: ${nextStudent.rollNumber}. ${nextStudent.name} ${icons.chevronRight(16)}
            </button>
          ` : ''}
          <button type="button" class="btn btn-secondary" id="btnScanAnother" style="width: 100%;">
            Scan Siswa Lain
          </button>
          <button type="button" class="btn btn-secondary" id="btnBackToDashboard" style="width: 100%;">
            Kembali ke Ringkasan
          </button>
        </div>
      </div>
    `;

    container.querySelector('#btnNextStudent')?.addEventListener('click', () => {
      selectedStudentId = nextStudent.id;
      capturedPages = [];
      renderCameraStep();
    });

    container.querySelector('#btnScanAnother')?.addEventListener('click', () => {
      capturedPages = [];
      renderSetupStep();
    });

    container.querySelector('#btnBackToDashboard')?.addEventListener('click', () => {
      navigate('dashboard');
    });
  }

  renderSetupStep();
}
