/**
 * Manual Entry View (Fitur E)
 * Input without camera for students whose photo failed or for rapid keyboard sequence typing.
 */

import { db } from '../db/storage.js';
import { icons } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { calculateGrade, getScoreCategory } from '../services/grading.js';
import { syncService } from '../services/sync.js';

export async function renderManual(container, navigate) {
  const classes = await db.getAll('classes');
  const subjects = await db.getAll('subjects');
  const allStudents = await db.getAll('students');
  const settings = (await db.getById('settings', 'app_config')) || {};

  let selectedClassId = settings.activeClassId || classes[0]?.id || '';
  let selectedSubjectId = settings.activeSubjectId || subjects[0]?.id || '';
  let selectedStudentId = '';

  function getStudentsForClass() {
    return allStudents.filter(s => s.classId === selectedClassId).sort((a, b) => a.rollNumber - b.rollNumber);
  }

  const activeSubject = subjects.find(s => s.id === selectedSubjectId) || subjects[0];
  const pgCount = activeSubject?.pgCount || 25;
  const keys = activeSubject?.answerKeys || [];
  const hasUraian = !!activeSubject?.hasUraian;
  const uraianMaxScores = activeSubject?.uraianMaxScores || [3, 3, 3, 2, 2];

  let answers = Array(pgCount).fill(null);
  let uraianScores = hasUraian ? uraianMaxScores.map(m => Math.min(3, m)) : [];

  function refresh() {
    const classStudents = getStudentsForClass();
    const currentStudent = classStudents.find(s => s.id === selectedStudentId);

    const grade = calculateGrade({
      answers: answers.map((ans, i) => ({ no: i + 1, jawaban: ans })),
      keys,
      pgCount,
      uraianScores,
      uraianMaxScores: hasUraian ? uraianMaxScores : []
    });

    const cat = getScoreCategory(grade.finalScore);

    container.innerHTML = `
      <div class="main-topbar">
        <div class="topbar-breadcrumbs">
          <span>Aplikasi</span>
          <span>/</span>
          <span class="active">Input Nilai Manual</span>
        </div>
      </div>

      <div class="page-header-row">
        <div>
          <h1 class="page-title">Input Manual Tanpa Kamera</h1>
          <p class="card-subtitle" style="margin-top: 4px;">Ketik deretan jawaban langsung dari keyboard untuk pengisian super cepat.</p>
        </div>
      </div>

      <!-- Setup Selectors -->
      <div class="card" style="margin-bottom: 20px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Kelas</label>
            <select id="selManualClass" class="form-select">
              ${classes.map(c => `<option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Mata Pelajaran</label>
            <select id="selManualSubj" class="form-select">
              ${subjects.map(s => `<option value="${s.id}" ${s.id === selectedSubjectId ? 'selected' : ''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Pilih Murid</label>
            <select id="selManualStudent" class="form-select">
              <option value="">-- Pilih Siswa --</option>
              ${classStudents.map(s => `<option value="${s.id}" ${s.id === selectedStudentId ? 'selected' : ''}>${s.rollNumber}. ${s.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Quick Sequence String Paste -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header">
          <div class="card-title">${icons.manual(18)} Ketik Deretan Jawaban (Keyboard Fast-Entry)</div>
        </div>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 10px;">
          Ketik langsung huruf jawaban siswa (misal: <code>ABDCCABBBAAD...</code>). Kotak di bawah akan terisi otomatis.
        </p>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="inpFastSequence" class="form-input" style="font-family: monospace; font-size: 16px; letter-spacing: 3px; text-transform: uppercase;" placeholder="Ketik huruf A/B/C/D di sini..." value="${answers.map(a => a || '-').join('')}" />
          <button type="button" class="btn btn-secondary" id="btnClearManualAnswers">Reset</button>
        </div>
      </div>

      <!-- Live Score Badge Card -->
      <div class="card" style="background: linear-gradient(135deg, #18191c 0%, #1f221a 100%); margin-bottom: 20px; border-color: rgba(198, 255, 74, 0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="font-size: 13px; color: var(--text-muted);">Siswa Terpilih:</div>
            <div style="font-size: 18px; font-weight: 700; color: #fff;">
              ${currentStudent ? `${currentStudent.rollNumber}. ${currentStudent.name}` : '(Pilih siswa di atas)'}
            </div>
          </div>
          <div style="display: flex; gap: 16px; align-items: center;">
            <div style="text-align: right;">
              <div style="font-size: 11px; color: var(--text-muted);">Nilai Akhir:</div>
              <div style="font-size: 30px; font-weight: 800; color: var(--accent-lime);">${grade.finalScore}</div>
            </div>
            <div style="font-size: 12px; border-left: 1px solid var(--border-subtle); padding-left: 14px;">
              <div>Benar PG: <strong>${grade.pgCorrect}</strong> / ${pgCount}</div>
              ${hasUraian ? `<div>Uraian: <strong>${grade.totalUraianScore}</strong> / ${grade.totalUraianMax}</div>` : ''}
              <div style="color: ${cat.color}; font-weight: 600;">${cat.label}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Answer Grid -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Pilihan Ganda (1 - ${pgCount})</div>
        </div>
        <div class="key-grid">
          ${Array.from({ length: pgCount }).map((_, i) => {
            const qNum = i + 1;
            const currentAns = answers[i] || '';
            const correctKey = keys[i] || '';
            const isCorrect = currentAns && currentAns === correctKey;
            const isWrong = currentAns && currentAns !== correctKey;

            return `
              <div class="key-cell" style="${isCorrect ? 'border-left: 3px solid var(--color-success);' : (isWrong ? 'border-left: 3px solid var(--color-danger);' : '')}">
                <span class="key-num">${qNum}. <small style="color: var(--accent-lime);">(${correctKey})</small></span>
                <div class="key-btn-group">
                  ${['A', 'B', 'C', 'D'].map(opt => `
                    <button type="button" class="key-option-btn manual-opt-btn ${currentAns === opt ? (isCorrect ? 'selected' : 'active-wrong') : ''}" data-q="${i}" data-opt="${opt}" style="${currentAns === opt && isWrong ? 'background: var(--color-danger); color: #fff;' : ''}">
                      ${opt}
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${hasUraian ? `
          <div style="border-top: 1px solid var(--border-subtle); margin-top: 24px; padding-top: 20px;">
            <div class="card-title" style="margin-bottom: 12px;">Skor Soal Uraian</div>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              ${uraianMaxScores.map((max, idx) => {
                const qNum = pgCount + idx + 1;
                const score = uraianScores[idx] ?? 0;
                return `
                  <div style="background: var(--bg-surface); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <div style="font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 6px;">No. ${qNum} (Maks: ${max})</div>
                    <div style="display: flex; gap: 4px;">
                      ${Array.from({ length: max + 1 }).map((_, pt) => `
                        <button type="button" class="btn-manual-uraian ${score === pt ? 'btn-primary' : 'btn-secondary'}" data-idx="${idx}" data-score="${pt}" style="padding: 4px 10px; font-size: 12px; font-weight: 700;">
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

        <!-- Save Button -->
        <div style="margin-top: 24px; display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-primary" id="btnSaveManualEntry" ${!currentStudent ? 'disabled' : ''}>
            ${icons.sync(16)} Simpan & Kirim Nilai ke Sheets
          </button>
        </div>
      </div>
    `;

    bindEvents(classStudents, currentStudent, grade, cat);
  }

  function bindEvents(classStudents, currentStudent, grade, cat) {
    container.querySelector('#selManualClass').addEventListener('change', (e) => {
      selectedClassId = e.target.value;
      selectedStudentId = '';
      refresh();
    });

    container.querySelector('#selManualSubj').addEventListener('change', (e) => {
      selectedSubjectId = e.target.value;
      refresh();
    });

    container.querySelector('#selManualStudent').addEventListener('change', (e) => {
      selectedStudentId = e.target.value;
      refresh();
    });

    // Fast sequence input typing
    container.querySelector('#inpFastSequence').addEventListener('input', (e) => {
      const letters = e.target.value.toUpperCase().replace(/[^ABCD]/g, '').split('');
      for (let i = 0; i < pgCount; i++) {
        answers[i] = letters[i] || null;
      }
      refresh();
    });

    container.querySelector('#btnClearManualAnswers').addEventListener('click', () => {
      answers = Array(pgCount).fill(null);
      refresh();
    });

    // 1-Tap button in grid
    container.querySelectorAll('.manual-opt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qIdx = parseInt(btn.dataset.q, 10);
        const opt = btn.dataset.opt;
        answers[qIdx] = answers[qIdx] === opt ? null : opt;
        refresh();
      });
    });

    // Uraian buttons
    container.querySelectorAll('.btn-manual-uraian').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const score = parseInt(btn.dataset.score, 10);
        uraianScores[idx] = score;
        refresh();
      });
    });

    // Save
    container.querySelector('#btnSaveManualEntry')?.addEventListener('click', async () => {
      if (!currentStudent) {
        toast.warning('Pilih siswa terlebih dahulu!');
        return;
      }

      const record = {
        id: 'res_' + Date.now(),
        classId: selectedClassId,
        className: classes.find(c => c.id === selectedClassId)?.name || '',
        subjectId: selectedSubjectId,
        subjectName: activeSubject.name,
        sheetName: activeSubject.sheetName,
        studentId: currentStudent.id,
        studentRoll: currentStudent.rollNumber,
        studentName: currentStudent.name,
        pgCount,
        pgCorrect: grade.pgCorrect,
        pgWrong: grade.pgWrong,
        answers,
        uraianScores: hasUraian ? uraianScores : [],
        totalScoreEarned: grade.totalScoreEarned,
        totalMaxPossible: grade.totalMaxPossible,
        finalScore: grade.finalScore,
        category: cat.code,
        layout: activeSubject.layout || { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' },
        syncStatus: 'pending',
        createdAt: new Date().toISOString()
      };

      await db.put('results', record);
      const syncRes = await syncService.saveResultToSheets(record);

      if (syncRes.mode === 'demo') {
        toast.success(`Nilai ${currentStudent.name} (${grade.finalScore}) tersimpan! (Mode Demo)`);
      } else if (syncRes.success) {
        toast.success(`Nilai ${currentStudent.name} berhasil ditulis ke Google Sheets!`);
      } else {
        toast.warning(syncRes.message);
      }

      // Automatically move to next student in roll order
      const nextStudent = classStudents.find(s => s.rollNumber === currentStudent.rollNumber + 1);
      if (nextStudent) {
        selectedStudentId = nextStudent.id;
        answers = Array(pgCount).fill(null);
        toast.info(`Beralih ke siswa berikutnya: ${nextStudent.rollNumber}. ${nextStudent.name}`);
      }
      refresh();
    });
  }

  refresh();
}
