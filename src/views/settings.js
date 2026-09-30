/**
 * Settings View (Fase 5 & Integrasi Google Apps Script)
 * Manages Google Apps Script Web App URL, secret token, spreadsheet ID,
 * connection test (Ping), custom per-mapel layout settings (keyRow, firstStudentRow, firstAnswerCol),
 * and complete JSON backup export/import.
 */

import { db } from '../db/storage.js';
import { icons } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { syncService } from '../services/sync.js';

export async function renderSettings(container, navigate) {
  const settings = (await db.getById('settings', 'app_config')) || {
    id: 'app_config',
    appTitle: 'Sistem Input Nilai SD',
    webAppUrl: '',
    secretToken: 'guru-sd-super-secret-2026',
    spreadsheetId: '',
    demoMode: true,
    geminiModel: 'gemini-1.5-flash'
  };

  const subjects = await db.getAll('subjects');

  container.innerHTML = `
    <div class="main-topbar">
      <div class="topbar-breadcrumbs">
        <span>Aplikasi</span>
        <span>/</span>
        <span class="active">Pengaturan & Integrasi</span>
      </div>
    </div>

    <div class="page-header-row">
      <div>
        <h1 class="page-title">Pengaturan Sistem</h1>
        <p class="card-subtitle" style="margin-top: 4px;">Konfigurasi Google Apps Script, Spreadsheet, dan cadangan data aplikasi.</p>
      </div>
      <button type="button" class="btn btn-primary" id="btnSaveAllSettings">
        ${icons.check(16)} Simpan Perubahan
      </button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 20px;">
      <!-- Card 1: Backend Google Apps Script -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${icons.sync(18)} Integrasi Google Apps Script</div>
            <div class="card-subtitle">Backend gratis untuk Gemini Vision OCR & Google Sheets</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Mode Operasi Aplikasi</label>
          <div style="display: flex; gap: 10px; align-items: center; background: var(--bg-surface); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <input type="checkbox" id="chkDemoMode" ${settings.demoMode ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--accent-lime);" />
            <div>
              <label for="chkDemoMode" style="font-weight: 600; color: #fff; cursor: pointer;">Mode Demo (Simulasi Tanpa Backend)</label>
              <div style="font-size: 11.5px; color: var(--text-muted);">Aktifkan untuk mencoba seluruh alur tanpa memasukkan URL Google Apps Script.</div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">URL Web App Google Apps Script</label>
          <input type="url" id="inpWebAppUrl" class="form-input" placeholder="https://script.google.com/macros/s/.../exec" value="${settings.webAppUrl || ''}" />
          <span class="form-help">Didapatkan setelah Deploy Web App (Akses: Anyone). Panduan lengkap ada di README.</span>
        </div>

        <div class="form-group">
          <label class="form-label">Token Rahasia (Secret Token)</label>
          <input type="password" id="inpSecretToken" class="form-input" value="${settings.secretToken || ''}" />
          <span class="form-help">Kunci otorisasi pengaman antara frontend dan Apps Script.</span>
        </div>

        <div class="form-group">
          <label class="form-label">ID Spreadsheet (Opsional jika bound-script)</label>
          <input type="text" id="inpSpreadsheetId" class="form-input" placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" value="${settings.spreadsheetId || ''}" />
          <span class="form-help">Kosongkan jika script dibuat langsung dari menu Ekstensi > Apps Script di Google Sheets Anda.</span>
        </div>

        <div class="form-group">
          <label class="form-label">Model AI Vision Gemini</label>
          <select id="selGeminiModel" class="form-select">
            <option value="gemini-1.5-flash" ${settings.geminiModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash (Cepat & Akurat - Rekomendasi)</option>
            <option value="gemini-2.5-flash" ${settings.geminiModel === 'gemini-2.5-flash' ? 'selected' : ''}>Gemini 2.5 Flash</option>
            <option value="gemini-1.5-pro" ${settings.geminiModel === 'gemini-1.5-pro' ? 'selected' : ''}>Gemini 1.5 Pro</option>
          </select>
        </div>

        <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
          <button type="button" class="btn btn-secondary" id="btnTestPing">
            ${icons.lightning(14)} Tes Koneksi (Ping)
          </button>
          <span id="pingStatusText" style="font-size: 12.5px; font-weight: 600;"></span>
        </div>
      </div>

      <!-- Card 2: Layout Spreadsheet Per-Mapel -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${icons.subjects(18)} Tata Letak Kolom Spreadsheet</div>
            <div class="card-subtitle">Aturan penulisan baris/kolom per mata pelajaran (misal: PAI, PJOK)</div>
          </div>
        </div>

        <div style="font-size: 12.5px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.4;">
          Sistem secara baku menulis kunci di <strong>Baris 9</strong> dan nama murid mulai <strong>Baris 10</strong>, kolom <strong>C</strong> seterusnya. Rumus AH..BL tidak akan tertimpa.
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;" id="subjectLayoutList">
          ${subjects.map(s => {
            const layout = s.layout || { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' };
            return `
              <div style="background: var(--bg-surface); padding: 12px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-weight: 700; color: #fff; margin-bottom: 8px; font-size: 13px;">
                  ${s.shortCode || s.name} (Sheet: <code>${s.sheetName}</code>)
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                  <div>
                    <label style="font-size: 10.5px; color: var(--text-muted); display: block;">Baris Kunci</label>
                    <input type="number" class="form-input inp-layout-key" data-id="${s.id}" value="${layout.keyRow || 9}" style="padding: 4px 8px; font-size: 12px;" />
                  </div>
                  <div>
                    <label style="font-size: 10.5px; color: var(--text-muted); display: block;">Baris Siswa 1</label>
                    <input type="number" class="form-input inp-layout-student" data-id="${s.id}" value="${layout.firstStudentRow || 10}" style="padding: 4px 8px; font-size: 12px;" />
                  </div>
                  <div>
                    <label style="font-size: 10.5px; color: var(--text-muted); display: block;">Kolom Jawaban</label>
                    <input type="text" class="form-input inp-layout-col" data-id="${s.id}" value="${layout.firstAnswerCol || 'C'}" style="padding: 4px 8px; font-size: 12px; text-transform: uppercase;" />
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Card 3: Cadangan & Pemulihan Data (Backup & Restore) -->
      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-header">
          <div>
            <div class="card-title">${icons.download(18)} Cadangan & Pemulihan Data (Backup & Restore)</div>
            <div class="card-subtitle">Unduh seluruh basis data (kelas, siswa, mapel, kunci, riwayat) sebagai arsip JSON aman</div>
          </div>
        </div>

        <div style="display: flex; gap: 14px; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" id="btnExportBackup">
            ${icons.download(16)} Unduh Cadangan JSON
          </button>
          
          <input type="file" id="fileImportInput" accept=".json" style="display: none;" />
          <button type="button" class="btn btn-secondary" id="btnImportBackup">
            ${icons.upload(16)} Pulihkan dari File JSON
          </button>

          <button type="button" class="btn btn-danger" id="btnResetDatabase" style="margin-left: auto;">
            ${icons.trash(16)} Reset Ulang Data ke Bawaan
          </button>
        </div>
      </div>
    </div>
  `;

  bindEvents(settings, subjects);
}

function bindEvents(settings, subjects) {
  const container = document.querySelector('#appMainContent');

  // Test Ping
  container.querySelector('#btnTestPing')?.addEventListener('click', async () => {
    const statusEl = container.querySelector('#pingStatusText');
    const isDemo = container.querySelector('#chkDemoMode').checked;

    if (isDemo) {
      statusEl.style.color = 'var(--accent-lime)';
      statusEl.textContent = '✔ Mode Demo Aktif (Simulasi Siap)';
      toast.success('Mode Demo siap digunakan!');
      return;
    }

    const url = container.querySelector('#inpWebAppUrl').value.trim();
    if (!url) {
      toast.warning('Masukkan URL Google Apps Script terlebih dahulu!');
      return;
    }

    statusEl.style.color = 'var(--color-warning)';
    statusEl.textContent = 'Menghubungkan ke Google Apps Script...';

    // Temporarily save entered URL for test
    settings.webAppUrl = url;
    settings.secretToken = container.querySelector('#inpSecretToken').value.trim();
    settings.spreadsheetId = container.querySelector('#inpSpreadsheetId').value.trim();
    settings.demoMode = false;
    await db.put('settings', settings);

    try {
      const res = await syncService.pingBackend();
      statusEl.style.color = 'var(--color-success)';
      statusEl.textContent = '✔ Terhubung! ' + (res.message || 'OK');
      toast.success('Koneksi Google Apps Script Berhasil!');
    } catch (err) {
      statusEl.style.color = 'var(--color-danger)';
      statusEl.textContent = '✕ Gagal: ' + err.message;
      toast.error('Gagal menghubungkan: ' + err.message);
    }
  });

  // Save Settings
  container.querySelector('#btnSaveAllSettings')?.addEventListener('click', async () => {
    settings.demoMode = container.querySelector('#chkDemoMode').checked;
    settings.webAppUrl = container.querySelector('#inpWebAppUrl').value.trim();
    settings.secretToken = container.querySelector('#inpSecretToken').value.trim();
    settings.spreadsheetId = container.querySelector('#inpSpreadsheetId').value.trim();
    settings.geminiModel = container.querySelector('#selGeminiModel').value;

    await db.put('settings', settings);

    // Save subject layout updates
    const currentSubjects = await db.getAll('subjects');
    for (const s of currentSubjects) {
      const keyInp = container.querySelector(`.inp-layout-key[data-id="${s.id}"]`);
      const stuInp = container.querySelector(`.inp-layout-student[data-id="${s.id}"]`);
      const colInp = container.querySelector(`.inp-layout-col[data-id="${s.id}"]`);

      if (keyInp && stuInp && colInp) {
        s.layout = {
          keyRow: parseInt(keyInp.value, 10) || 9,
          firstStudentRow: parseInt(stuInp.value, 10) || 10,
          firstAnswerCol: (colInp.value || 'C').toUpperCase().trim()
        };
        await db.put('subjects', s);
      }
    }

    toast.success('Pengaturan sistem berhasil disimpan!');
  });

  // Export Backup JSON
  container.querySelector('#btnExportBackup')?.addEventListener('click', async () => {
    const backup = await db.exportBackup();
    const str = JSON.stringify(backup, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SistemInputNilai_Cadangan_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Cadangan data JSON berhasil diunduh!');
  });

  // Import Backup JSON
  const fileInp = container.querySelector('#fileImportInput');
  container.querySelector('#btnImportBackup')?.addEventListener('click', () => fileInp.click());
  fileInp.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (confirm('Pulihkan data dari cadangan ini? Data saat ini akan digantikan oleh isi file cadangan.')) {
        await db.importBackup(json);
        toast.success('Data berhasil dipulihkan!');
        setTimeout(() => location.reload(), 800);
      }
    } catch (err) {
      toast.error('File cadangan tidak valid: ' + err.message);
    }
  });

  // Reset Database
  container.querySelector('#btnResetDatabase')?.addEventListener('click', async () => {
    if (confirm('PERINGATAN: Yakin ingin mereset seluruh data ke data bawaan contoh? Semua data saat ini akan dihapus.')) {
      indexedDB.deleteDatabase('SistemInputNilaiDB');
      localStorage.clear();
      toast.warning('Database telah direset. Memuat ulang...');
      setTimeout(() => location.reload(), 1000);
    }
  });
}
