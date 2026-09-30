/**
 * Subjects & Answer Key Editor View (Fase 3)
 * Dynamic question count (1-100), visual answer key grid, quick sequence string input ("BCACBBA..."),
 * essay question configuration with max scores, and sync to Google Sheets (Row 9).
 */

import { db } from '../db/storage.js';
import { icons } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { syncService } from '../services/sync.js';

export async function renderSubjects(container, navigate) {
  const subjects = await db.getAll('subjects');
  const classes = await db.getAll('classes');
  const settings = (await db.getById('settings', 'app_config')) || {};

  let activeSubjectId = settings.activeSubjectId || (subjects[0]?.id || '');
  let activeSubject = subjects.find(s => s.id === activeSubjectId) || subjects[0];

  async function refresh() {
    const currentSubjects = await db.getAll('subjects');
    activeSubject = currentSubjects.find(s => s.id === activeSubjectId) || currentSubjects[0];
    if (activeSubject) activeSubjectId = activeSubject.id;

    if (!activeSubject) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px;">
          <p style="color: var(--text-muted); margin-bottom: 16px;">Belum ada mata pelajaran.</p>
          <button type="button" class="btn btn-primary" id="btnCreateSubject">Tambah Mata Pelajaran</button>
        </div>
      `;
      container.querySelector('#btnCreateSubject')?.addEventListener('click', openAddSubjectModal);
      return;
    }

    const pgCount = activeSubject.pgCount || 25;
    const keys = activeSubject.answerKeys || [];
    const hasUraian = !!activeSubject.hasUraian;
    const uraianMaxScores = activeSubject.uraianMaxScores || [3, 3, 3, 2, 2];
    const totalMax = pgCount + uraianMaxScores.reduce((a, b) => a + Number(b), 0);

    container.innerHTML = `
      <div class="main-topbar">
        <div class="topbar-breadcrumbs">
          <span>Aplikasi</span>
          <span>/</span>
          <span class="active">Kunci Jawaban</span>
        </div>
      </div>

      <div class="page-header-row">
        <div>
          <h1 class="page-title">Mata Pelajaran & Kunci Jawaban</h1>
          <p class="card-subtitle" style="margin-top: 4px;">Atur kunci pilihan ganda dan bobot uraian untuk koreksi otomatis.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-secondary" id="btnAddSubjectBtn">
            ${icons.plus(16)} Tambah Mapel
          </button>
          <button type="button" class="btn btn-primary" id="btnSaveKeyToSheets">
            ${icons.sync(16)} Tulis Kunci ke Sheets (Baris 9)
          </button>
        </div>
      </div>

      <!-- Subject Tabs Bar -->
      <div class="tabs-bar">
        ${currentSubjects.map(s => `
          <button type="button" class="btn ${s.id === activeSubjectId ? 'btn-primary' : 'btn-secondary'} subj-tab-btn" data-id="${s.id}">
            ${s.shortCode || s.name}
          </button>
        `).join('')}
      </div>

      <!-- Main Subject Card -->
      <div class="card">
        <div class="card-header">
          <div style="flex: 1; min-width: 260px;">
            <div class="card-title">${icons.subjects(18)} ${activeSubject.name}</div>
            <div class="card-subtitle" style="margin-top: 4px; line-height: 1.4;">Nama Sheet Tujuan: <strong>${activeSubject.sheetName}</strong> • ${pgCount} Soal PG • ${hasUraian ? `${uraianMaxScores.length} Soal Uraian` : 'Tanpa Uraian'} • Bobot Maksimal: ${totalMax}</div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" id="btnEditSubjectMeta">
              ${icons.edit(14)} Pengaturan Soal
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btnPasteSequence">
              ${icons.upload(14)} Tempel Deret Kunci
            </button>
          </div>
        </div>


        <!-- Section: Pilihan Ganda -->
        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">
              <span>Bagian I: Kunci Pilihan Ganda (1 - ${pgCount})</span>
              <span class="badge badge-lime">${keys.filter(Boolean).length} / ${pgCount} Terisi</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnClearAllKeys" style="font-size: 11px;">
              Kosongkan Semua
            </button>
          </div>

          <!-- Answer Key Visual Grid -->
          <div class="key-grid">
            ${Array.from({ length: pgCount }).map((_, i) => {
              const qNum = i + 1;
              const currentKey = keys[i] || '';
              return `
                <div class="key-cell" data-q="${i}">
                  <span class="key-num">${qNum}.</span>
                  <div class="key-btn-group">
                    ${['A', 'B', 'C', 'D'].map(opt => `
                      <button type="button" class="key-option-btn ${currentKey === opt ? 'selected' : ''}" data-q="${i}" data-opt="${opt}">
                        ${opt}
                      </button>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Section: Uraian / Essay -->
        <div style="border-top: 1px solid var(--border-subtle); padding-top: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div>
              <div style="font-weight: 700; font-size: 14px; color: var(--text-primary);">
                Bagian II: Soal Uraian (Skor Maksimal Per Nomor)
              </div>
              <div class="card-subtitle">Ditulis ke baris 9 pada kolom setelah PG. Rumus: (Benar PG + Skor Uraian) * 100 / ${totalMax}</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" id="btnToggleUraian">
              ${hasUraian ? 'Nonaktifkan Uraian' : 'Aktifkan Uraian'}
            </button>
          </div>

          ${hasUraian ? `
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              ${uraianMaxScores.map((score, idx) => {
                const qNum = pgCount + idx + 1;
                return `
                  <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 13px; font-weight: 700; color: var(--text-muted);">No. ${qNum}:</span>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <label style="font-size: 12px; color: var(--text-secondary);">Skor Maks:</label>
                      <input type="number" min="1" max="20" class="form-input inp-uraian-max" data-idx="${idx}" value="${score}" style="width: 60px; padding: 4px 8px; text-align: center;" />
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <p style="font-size: 13px; color: var(--text-muted);">Mata pelajaran ini hanya menggunakan pilihan ganda tanpa soal uraian.</p>
          `}
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Switch tabs
    container.querySelectorAll('.subj-tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        activeSubjectId = btn.dataset.id;
        const s = (await db.getById('settings', 'app_config')) || {};
        s.activeSubjectId = activeSubjectId;
        await db.put('settings', s);
        refresh();
      });
    });

    // 1-tap Key Selection
    container.querySelectorAll('.key-option-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qIdx = parseInt(btn.dataset.q, 10);
        const opt = btn.dataset.opt;
        const keys = activeSubject.answerKeys || [];

        // If clicking already selected, toggle off
        if (keys[qIdx] === opt) {
          keys[qIdx] = null;
        } else {
          keys[qIdx] = opt;
        }

        activeSubject.answerKeys = keys;
        await db.put('subjects', activeSubject);
        refresh();
      });
    });

    // Quick Paste Sequence (e.g. "BCACBBA...")
    container.querySelector('#btnPasteSequence')?.addEventListener('click', () => {
      openModal({
        title: 'Tempel Deret Kunci Jawaban',
        contentHtml: `
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
            Ketik atau tempel deretan huruf kunci secara langsung tanpa spasi atau dengan spasi (misalnya: <code>ABDCCABBBAAD...</code>).
          </p>
          <div class="form-group">
            <label class="form-label">Deret Huruf Kunci Jawaban</label>
            <textarea id="txtKeySequence" class="form-textarea" rows="4" style="font-family: monospace; font-size: 16px; letter-spacing: 2px;" placeholder="ABDCCABBBA..."></textarea>
          </div>
        `,
        saveLabel: 'Terapkan Kunci',
        onSave: async (modalEl) => {
          const raw = modalEl.querySelector('#txtKeySequence').value;
          const cleanedLetters = raw.toUpperCase().replace(/[^ABCD]/g, '').split('');
          if (cleanedLetters.length === 0) {
            toast.error('Tidak ada huruf A, B, C, atau D yang terdeteksi');
            return false;
          }

          const pgCount = activeSubject.pgCount || 25;
          const newKeys = Array(pgCount).fill(null);
          for (let i = 0; i < Math.min(pgCount, cleanedLetters.length); i++) {
            newKeys[i] = cleanedLetters[i];
          }

          activeSubject.answerKeys = newKeys;
          await db.put('subjects', activeSubject);
          toast.success(`Berhasil menerapkan ${cleanedLetters.length} kunci jawaban!`);
          refresh();
          return true;
        }
      });
    });

    // Clear All Keys
    container.querySelector('#btnClearAllKeys')?.addEventListener('click', async () => {
      if (confirm('Kosongkan semua kunci pilihan ganda untuk mata pelajaran ini?')) {
        activeSubject.answerKeys = Array(activeSubject.pgCount || 25).fill(null);
        await db.put('subjects', activeSubject);
        toast.warning('Semua kunci jawaban telah dikosongkan.');
        refresh();
      }
    });

    // Uraian score change
    container.querySelectorAll('.inp-uraian-max').forEach(inp => {
      inp.addEventListener('change', async () => {
        const idx = parseInt(inp.dataset.idx, 10);
        const val = Math.max(1, parseInt(inp.value, 10) || 1);
        inp.value = val;
        activeSubject.uraianMaxScores[idx] = val;
        await db.put('subjects', activeSubject);
        refresh();
      });
    });

    // Toggle Uraian
    container.querySelector('#btnToggleUraian')?.addEventListener('click', async () => {
      activeSubject.hasUraian = !activeSubject.hasUraian;
      if (activeSubject.hasUraian && (!activeSubject.uraianMaxScores || activeSubject.uraianMaxScores.length === 0)) {
        activeSubject.uraianMaxScores = [3, 3, 3, 2, 2];
      }
      await db.put('subjects', activeSubject);
      refresh();
    });

    // Edit Subject Metadata Modal
    container.querySelector('#btnEditSubjectMeta')?.addEventListener('click', () => {
      openModal({
        title: 'Pengaturan Mata Pelajaran',
        contentHtml: `
          <div class="form-group">
            <label class="form-label">Nama Mata Pelajaran</label>
            <input type="text" id="inpSubjName" class="form-input" value="${activeSubject.name}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Kode Singkat (Tab)</label>
            <input type="text" id="inpSubjCode" class="form-input" value="${activeSubject.shortCode || ''}" placeholder="contoh: IPAS" />
          </div>
          <div class="form-group">
            <label class="form-label">Nama Sheet di Google Spreadsheet</label>
            <input type="text" id="inpSheetName" class="form-input" value="${activeSubject.sheetName}" required />
            <span class="form-help">Wajib sama persis dengan nama tab di spreadsheet (misal: IPAS, PP, BAHASA INDONESIA, KELAS 4)</span>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah Soal Pilihan Ganda (1 - 100)</label>
            <input type="number" id="inpPgCount" min="1" max="100" class="form-input" value="${activeSubject.pgCount || 25}" required />
          </div>
        `,
        saveLabel: 'Simpan',
        onSave: async (modalEl) => {
          const name = modalEl.querySelector('#inpSubjName').value.trim();
          const code = modalEl.querySelector('#inpSubjCode').value.trim();
          const sheet = modalEl.querySelector('#inpSheetName').value.trim();
          const pgCount = parseInt(modalEl.querySelector('#inpPgCount').value, 10);

          if (!name || !sheet || !pgCount) {
            toast.error('Semua data wajib diisi dengan benar');
            return false;
          }

          activeSubject.name = name;
          activeSubject.shortCode = code || name.substring(0, 5);
          activeSubject.sheetName = sheet;
          activeSubject.pgCount = pgCount;

          // Adjust array length if changed
          const currentKeys = activeSubject.answerKeys || [];
          if (currentKeys.length < pgCount) {
            while (currentKeys.length < pgCount) currentKeys.push(null);
          } else if (currentKeys.length > pgCount) {
            activeSubject.answerKeys = currentKeys.slice(0, pgCount);
          }

          await db.put('subjects', activeSubject);
          toast.success('Pengaturan mata pelajaran disimpan!');
          refresh();
          return true;
        }
      });
    });

    // Add Subject Button
    container.querySelector('#btnAddSubjectBtn')?.addEventListener('click', openAddSubjectModal);

    // Save Answer Key to Google Sheets (Baris 9)
    container.querySelector('#btnSaveKeyToSheets')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btnSaveKeyToSheets');
      btn.disabled = true;
      btn.innerHTML = 'Menulis ke Sheets...';

      try {
        const res = await syncService.saveKeyToSheets(activeSubject);
        if (res.mode === 'demo') {
          toast.success('Kunci tersimpan lokal (Mode Demo Aktif).');
        } else {
          toast.success(`Kunci jawaban berhasil ditulis ke baris 9 sheet "${activeSubject.sheetName}"!`);
        }
      } catch (err) {
        toast.error('Gagal menulis kunci ke Sheets: ' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${icons.sync(16)} Tulis Kunci ke Sheets (Baris 9)`;
      }
    });
  }

  function openAddSubjectModal() {
    openModal({
      title: 'Tambah Mata Pelajaran Baru',
      contentHtml: `
        <div class="form-group">
          <label class="form-label">Nama Mata Pelajaran</label>
          <input type="text" id="inpNewSubjName" class="form-input" placeholder="contoh: Pendidikan Jasmani (PJOK)" required />
        </div>
        <div class="form-group">
          <label class="form-label">Kode Singkat</label>
          <input type="text" id="inpNewSubjCode" class="form-input" placeholder="contoh: PJOK" />
        </div>
        <div class="form-group">
          <label class="form-label">Nama Sheet Tujuan di Google Sheets</label>
          <input type="text" id="inpNewSheetName" class="form-input" placeholder="contoh: PJOK-KLS 4" required />
        </div>
        <div class="form-group">
          <label class="form-label">Jumlah Soal Pilihan Ganda</label>
          <input type="number" id="inpNewPgCount" class="form-input" value="25" min="1" max="100" />
        </div>
      `,
      saveLabel: 'Tambah Mapel',
      onSave: async (modalEl) => {
        const name = modalEl.querySelector('#inpNewSubjName').value.trim();
        const code = modalEl.querySelector('#inpNewSubjCode').value.trim();
        const sheet = modalEl.querySelector('#inpNewSheetName').value.trim();
        const pgCount = parseInt(modalEl.querySelector('#inpNewPgCount').value, 10) || 25;

        if (!name || !sheet) {
          toast.error('Nama mapel dan nama sheet wajib diisi');
          return false;
        }

        const newSubj = await db.put('subjects', {
          name,
          shortCode: code || name.substring(0, 5),
          sheetName: sheet,
          pgCount,
          answerKeys: Array(pgCount).fill(null),
          hasUraian: true,
          uraianCount: 5,
          uraianMaxScores: [3, 3, 3, 2, 2],
          layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
        });

        activeSubjectId = newSubj.id;
        toast.success(`Mata pelajaran ${name} berhasil ditambahkan!`);
        refresh();
        return true;
      }
    });
  }

  await refresh();
}
