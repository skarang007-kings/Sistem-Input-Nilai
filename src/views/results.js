/**
 * Exam Results & History View (Fase 6 / Fitur F)
 * Table of graded student exams with filters by class/subject, search,
 * batch sync / retry sync to Google Sheets, detail modal, and CSV export.
 */

import { db } from '../db/storage.js';
import { icons } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { openModal } from '../components/modal.js';
import { getScoreCategory } from '../services/grading.js';
import { syncService } from '../services/sync.js';

export async function renderResults(container, navigate) {
  const classes = await db.getAll('classes');
  const subjects = await db.getAll('subjects');
  const allResults = await db.getAll('results');
  const queue = await db.getAll('syncQueue');

  let filterClassId = '';
  let filterSubjectId = '';
  let searchQuery = '';

  async function refresh() {
    const results = await db.getAll('results');
    const currentQueue = await db.getAll('syncQueue');

    let filtered = results.filter(r => {
      if (filterClassId && r.classId !== filterClassId) return false;
      if (filterSubjectId && r.subjectId !== filterSubjectId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (r.studentName || '').toLowerCase().includes(q);
        const matchSubj = (r.subjectName || '').toLowerCase().includes(q);
        if (!matchName && !matchSubj) return false;
      }
      return true;
    }).sort((a, b) => (a.studentRoll || 0) - (b.studentRoll || 0));

    container.innerHTML = `
      <div class="main-topbar">
        <div class="topbar-breadcrumbs">
          <span>Aplikasi</span>
          <span>/</span>
          <span class="active">Riwayat & Hasil Penilaian</span>
        </div>
        <div class="topbar-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="btnExportCSV">
            ${icons.download(14)} Ekspor CSV / Excel
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btnSyncAllPending">
            ${icons.sync(14)} Sinkronkan Antrean (${currentQueue.length})
          </button>
        </div>
      </div>

      <div class="page-header-row">
        <div>
          <h1 class="page-title">Rekap Nilai Siswa</h1>
          <p class="card-subtitle" style="margin-top: 4px;">Daftar seluruh lembar ujian yang telah diperiksa dan status pengiriman ke spreadsheet.</p>
        </div>
      </div>

      <!-- Filters Row -->
      <div class="card" style="margin-bottom: 20px; padding: 14px 20px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; align-items: flex-end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 11.5px;">Filter Kelas</label>
            <select id="selFilterClass" class="form-select" style="padding: 8px 12px;">
              <option value="">Semua Kelas</option>
              ${classes.map(c => `<option value="${c.id}" ${c.id === filterClassId ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 11.5px;">Filter Mata Pelajaran</label>
            <select id="selFilterSubj" class="form-select" style="padding: 8px 12px;">
              <option value="">Semua Mapel</option>
              ${subjects.map(s => `<option value="${s.id}" ${s.id === filterSubjectId ? 'selected' : ''}>${s.shortCode || s.name}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label" style="font-size: 11.5px;">Cari Nama Siswa</label>
            <input type="text" id="inpSearchStudent" class="form-input" placeholder="Ketik nama..." value="${searchQuery}" style="padding: 8px 12px;" />
          </div>
        </div>
      </div>

      <!-- Results Table Card -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>Daftar Nilai</span>
            <span class="badge badge-lime">${filtered.length} Siswa</span>
          </div>
          <span class="card-subtitle">Format penilaian sesuai kolom template Excel</span>
        </div>

        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th style="width: 50px;">No</th>
                <th>Nama Siswa</th>
                <th>Mapel (Sheet)</th>
                <th>Benar PG</th>
                <th>Skor Uraian</th>
                <th>Nilai Akhir</th>
                <th>Predikat</th>
                <th>Status Sheets</th>
                <th style="width: 120px; text-align: right;">Aksi</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 40px;">
                    Tidak ada data nilai yang cocok dengan filter.
                  </td>
                </tr>
              ` : filtered.map(r => {
                const cat = getScoreCategory(r.finalScore);
                const isSynced = r.syncStatus === 'synced';
                const uraianTotal = (r.uraianScores || []).reduce((a, b) => a + Number(b), 0);

                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--accent-lime);">${r.studentRoll || '-'}</td>
                    <td style="font-weight: 600;">${r.studentName}</td>
                    <td style="color: var(--text-secondary);">${r.sheetName || r.subjectName}</td>
                    <td>${r.pgCorrect || 0} / ${r.pgCount || 25}</td>
                    <td>${r.uraianScores?.length ? uraianTotal : '-'}</td>
                    <td style="font-size: 15px; font-weight: 800; color: var(--accent-lime);">${r.finalScore}</td>
                    <td>
                      <span class="badge" style="background: ${cat.color}22; color: ${cat.color};">
                        ${cat.label}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${isSynced ? 'badge-success' : 'badge-warning'}" title="${r.syncError || ''}">
                        ${isSynced ? '✔ Terkirim' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button type="button" class="btn-icon btn-retry-sync" data-id="${r.id}" title="Kirim Ulang ke Sheets" style="background: var(--bg-surface); color: var(--text-secondary);">
                          ${icons.sync(14)}
                        </button>
                        <button type="button" class="btn-icon btn-del-result" data-id="${r.id}" title="Hapus" style="background: var(--color-danger-dim); color: var(--color-danger);">
                          ${icons.trash(14)}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bindEvents(filtered);
  }

  function bindEvents(filtered) {
    container.querySelector('#selFilterClass')?.addEventListener('change', (e) => {
      filterClassId = e.target.value;
      refresh();
    });

    container.querySelector('#selFilterSubj')?.addEventListener('change', (e) => {
      filterSubjectId = e.target.value;
      refresh();
    });

    container.querySelector('#inpSearchStudent')?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      refresh();
    });

    // Retry single sync
    container.querySelectorAll('.btn-retry-sync').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const res = await db.getById('results', id);
        if (!res) return;

        btn.disabled = true;
        try {
          const syncRes = await syncService.saveResultToSheets(res);
          if (syncRes.success) {
            toast.success(`Nilai ${res.studentName} berhasil disinkronkan ke Sheets!`);
          } else {
            toast.warning(syncRes.message);
          }
          refresh();
        } catch (err) {
          toast.error('Gagal sinkron: ' + err.message);
          btn.disabled = false;
        }
      });
    });

    // Delete single result
    container.querySelectorAll('.btn-del-result').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const res = await db.getById('results', id);
        if (!res) return;

        if (confirm(`Hapus nilai ${res.studentName} (${res.sheetName})?`)) {
          await db.delete('results', id);
          toast.warning(`Nilai ${res.studentName} dihapus.`);
          refresh();
        }
      });
    });

    // Sync all pending in queue
    container.querySelector('#btnSyncAllPending')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btnSyncAllPending');
      btn.disabled = true;
      btn.innerHTML = 'Menyinkronkan...';

      try {
        const res = await syncService.processQueue();
        toast.success(`Sinkronisasi selesai! ${res.processed} data terkirim.`);
      } catch (err) {
        toast.error('Gagal memproses antrean: ' + err.message);
      } finally {
        refresh();
      }
    });

    // Export CSV
    container.querySelector('#btnExportCSV')?.addEventListener('click', () => {
      if (filtered.length === 0) {
        toast.warning('Tidak ada data untuk diekspor');
        return;
      }

      let csv = 'No,Nama Siswa,Mata Pelajaran,Sheet,Benar PG,Total PG,Skor Uraian,Nilai Akhir,Predikat,Status Sinkron\n';
      filtered.forEach((r, idx) => {
        const cat = getScoreCategory(r.finalScore);
        const uraianTotal = (r.uraianScores || []).reduce((a, b) => a + Number(b), 0);
        csv += `"${r.studentRoll || idx + 1}","${r.studentName}","${r.subjectName || ''}","${r.sheetName || ''}","${r.pgCorrect || 0}","${r.pgCount || 25}","${uraianTotal}","${r.finalScore}","${cat.label}","${r.syncStatus}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap_Nilai_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('File CSV berhasil diunduh!');
    });
  }

  await refresh();
}
