/**
 * Classes & Students Management View (Fase 2)
 * Full CRUD for Classes and Students + Bulk Paste Student Names
 */

import { db } from '../db/storage.js';
import { icons } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { openModal } from '../components/modal.js';

export async function renderClasses(container, navigate) {
  const classes = await db.getAll('classes');
  const settings = (await db.getById('settings', 'app_config')) || {};
  let activeClassId = settings.activeClassId || (classes[0]?.id || '');

  async function refresh() {
    const currentClasses = await db.getAll('classes');
    let activeClass = currentClasses.find(c => c.id === activeClassId) || currentClasses[0];
    if (activeClass) activeClassId = activeClass.id;

    const allStudents = await db.getAll('students');
    const classStudents = activeClass ? allStudents.filter(s => s.classId === activeClass.id).sort((a, b) => a.rollNumber - b.rollNumber) : [];

    container.innerHTML = `
      <div class="main-topbar">
        <div class="topbar-breadcrumbs">
          <span>Aplikasi</span>
          <span>/</span>
          <span class="active">Data Kelas & Siswa</span>
        </div>
      </div>

      <div class="page-header-row">
        <div>
          <h1 class="page-title">Manajemen Kelas & Siswa</h1>
          <p class="card-subtitle" style="margin-top: 4px;">Kelola daftar kelas dan murid yang akan dihubungkan ke lembar penilaian.</p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-secondary" id="btnAddClassBtn">
            ${icons.plus(16)} Tambah Kelas
          </button>
        </div>
      </div>

      <!-- Class Selection Bar -->
      <div class="tabs-bar">
        ${currentClasses.map(c => `
          <button type="button" class="btn ${c.id === activeClassId ? 'btn-primary' : 'btn-secondary'} class-tab-btn" data-id="${c.id}">
            ${icons.classes(16)} ${c.name} (${c.academicYear || '2026/2027'})
          </button>
        `).join('')}
      </div>


      ${!activeClass ? `
        <div class="card" style="text-align: center; padding: 48px;">
          <p style="color: var(--text-muted); margin-bottom: 16px;">Belum ada kelas yang terdaftar.</p>
          <button type="button" class="btn btn-primary" id="btnEmptyAddClass">Tambah Kelas Pertama</button>
        </div>
      ` : `
        <!-- Active Class Card -->
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${icons.classes(18)} Kelas ${activeClass.name} - Tahun ${activeClass.academicYear}</div>
              <div class="card-subtitle">Wali Kelas: ${activeClass.teacherName || 'Pak Guru'} • ${classStudents.length} Siswa Terdaftar</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btnEditClassBtn">
                ${icons.edit(14)} Edit Kelas
              </button>
              <button type="button" class="btn btn-danger btn-sm" id="btnDeleteClassBtn">
                ${icons.trash(14)} Hapus
              </button>
            </div>
          </div>

          <!-- Student Actions Bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">
              Daftar Murid (${classStudents.length})
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="btnBulkAddStudents">
                ${icons.upload(14)} Tempel Banyak Nama
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="btnAddSingleStudent">
                ${icons.plus(14)} Tambah Siswa
              </button>
            </div>
          </div>

          <!-- Students Table -->
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th style="width: 60px;">No Urut</th>
                  <th>Nama Lengkap Siswa</th>
                  <th style="width: 100px;">L/P</th>
                  <th style="width: 130px; text-align: right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${classStudents.length === 0 ? `
                  <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 32px;">
                      Belum ada siswa di kelas ini. Klik "Tempel Banyak Nama" untuk menambahkan daftar nama sekaligus dari WA/Excel.
                    </td>
                  </tr>
                ` : classStudents.map(s => `
                  <tr>
                    <td style="font-weight: 700; color: var(--accent-lime);">${s.rollNumber}</td>
                    <td style="font-weight: 600;">${s.name}</td>
                    <td>
                      <span class="badge ${s.gender === 'P' ? 'badge-warning' : 'badge-info'}">
                        ${s.gender === 'P' ? 'Perempuan' : 'Laki-laki'}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button type="button" class="btn-icon btn-edit-student" data-id="${s.id}" title="Edit" style="background: var(--bg-surface); color: var(--text-secondary);">
                          ${icons.edit(14)}
                        </button>
                        <button type="button" class="btn-icon btn-del-student" data-id="${s.id}" title="Hapus" style="background: var(--color-danger-dim); color: var(--color-danger);">
                          ${icons.trash(14)}
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    `;

    // Bind event listeners
    bindEvents(activeClass, classStudents);
  }

  function bindEvents(activeClass, classStudents) {
    // Switch class tabs
    container.querySelectorAll('.class-tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        activeClassId = btn.dataset.id;
        const s = (await db.getById('settings', 'app_config')) || {};
        s.activeClassId = activeClassId;
        await db.put('settings', s);
        refresh();
      });
    });

    // Add Class
    const openAddClassModal = () => {
      openModal({
        title: 'Tambah Kelas Baru',
        contentHtml: `
          <div class="form-group">
            <label class="form-label">Nama Kelas</label>
            <input type="text" id="inpClassName" class="form-input" placeholder="contoh: IV (Empat) atau 4A" required />
          </div>
          <div class="form-group">
            <label class="form-label">Tahun Pelajaran</label>
            <input type="text" id="inpClassYear" class="form-input" value="2026/2027" required />
          </div>
          <div class="form-group">
            <label class="form-label">Nama Guru / Wali Kelas</label>
            <input type="text" id="inpClassTeacher" class="form-input" placeholder="Nama Guru" value="Pak Guru Husni" />
          </div>
        `,
        saveLabel: 'Simpan Kelas',
        onSave: async (modalEl) => {
          const name = modalEl.querySelector('#inpClassName').value.trim();
          const year = modalEl.querySelector('#inpClassYear').value.trim();
          const teacher = modalEl.querySelector('#inpClassTeacher').value.trim();
          if (!name) {
            toast.error('Nama kelas wajib diisi!');
            return false;
          }
          const newClass = await db.put('classes', {
            name,
            academicYear: year,
            teacherName: teacher
          });
          activeClassId = newClass.id;
          toast.success(`Kelas ${name} berhasil ditambahkan!`);
          refresh();
          return true;
        }
      });
    };

    container.querySelector('#btnAddClassBtn')?.addEventListener('click', openAddClassModal);
    container.querySelector('#btnEmptyAddClass')?.addEventListener('click', openAddClassModal);

    // Edit Class
    container.querySelector('#btnEditClassBtn')?.addEventListener('click', () => {
      if (!activeClass) return;
      openModal({
        title: 'Edit Data Kelas',
        contentHtml: `
          <div class="form-group">
            <label class="form-label">Nama Kelas</label>
            <input type="text" id="inpClassName" class="form-input" value="${activeClass.name}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Tahun Pelajaran</label>
            <input type="text" id="inpClassYear" class="form-input" value="${activeClass.academicYear || ''}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Nama Guru</label>
            <input type="text" id="inpClassTeacher" class="form-input" value="${activeClass.teacherName || ''}" />
          </div>
        `,
        saveLabel: 'Perbarui',
        onSave: async (modalEl) => {
          activeClass.name = modalEl.querySelector('#inpClassName').value.trim();
          activeClass.academicYear = modalEl.querySelector('#inpClassYear').value.trim();
          activeClass.teacherName = modalEl.querySelector('#inpClassTeacher').value.trim();
          await db.put('classes', activeClass);
          toast.success('Data kelas berhasil diperbarui!');
          refresh();
          return true;
        }
      });
    });

    // Delete Class
    container.querySelector('#btnDeleteClassBtn')?.addEventListener('click', async () => {
      if (!activeClass) return;
      if (confirm(`Yakin ingin menghapus kelas ${activeClass.name}? Semua data siswa di kelas ini akan ikut terhapus.`)) {
        await db.delete('classes', activeClass.id);
        const allStudents = await db.getAll('students');
        for (const s of allStudents) {
          if (s.classId === activeClass.id) await db.delete('students', s.id);
        }
        toast.warning(`Kelas ${activeClass.name} telah dihapus.`);
        refresh();
      }
    });

    // Bulk Add Students (Paste many names at once)
    container.querySelector('#btnBulkAddStudents')?.addEventListener('click', () => {
      if (!activeClass) return;
      openModal({
        title: 'Tempel Banyak Nama Siswa Sekaligus',
        contentHtml: `
          <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
            Salin daftar nama dari WhatsApp atau Excel, lalu tempel di bawah ini (1 nama per baris). Angka nomor urut di depan nama akan dibersihkan otomatis.
          </p>
          <div class="form-group">
            <label class="form-label">Daftar Nama Siswa</label>
            <textarea id="txtBulkNames" class="form-textarea" rows="8" placeholder="1. Ahmad Fauzi&#10;2. Budi Santoso&#10;3. Citra Kirana..."></textarea>
          </div>
        `,
        saveLabel: 'Simpan Semua Siswa',
        onSave: async (modalEl) => {
          const raw = modalEl.querySelector('#txtBulkNames').value;
          const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length === 0) {
            toast.error('Masukkan setidaknya satu nama siswa');
            return false;
          }

          let currentMaxRoll = classStudents.reduce((max, s) => Math.max(max, s.rollNumber || 0), 0);
          let addedCount = 0;

          for (const line of lines) {
            // Strip leading numbers like "1. ", "01 - ", etc.
            const cleanName = line.replace(/^\d+[\.\-\)\s]+/, '').trim();
            if (!cleanName) continue;
            currentMaxRoll++;
            await db.put('students', {
              classId: activeClass.id,
              rollNumber: currentMaxRoll,
              name: cleanName,
              gender: 'L'
            });
            addedCount++;
          }

          toast.success(`Berhasil menambahkan ${addedCount} siswa baru!`);
          refresh();
          return true;
        }
      });
    });

    // Add Single Student
    container.querySelector('#btnAddSingleStudent')?.addEventListener('click', () => {
      if (!activeClass) return;
      const nextRoll = classStudents.reduce((max, s) => Math.max(max, s.rollNumber || 0), 0) + 1;
      openModal({
        title: 'Tambah Siswa Baru',
        contentHtml: `
          <div class="form-group">
            <label class="form-label">Nomor Urut (Presensi)</label>
            <input type="number" id="inpRoll" class="form-input" value="${nextRoll}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Nama Lengkap Siswa</label>
            <input type="text" id="inpStudentName" class="form-input" placeholder="contoh: Muhammad Rizky" required />
          </div>
          <div class="form-group">
            <label class="form-label">Jenis Kelamin</label>
            <select id="selGender" class="form-select">
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
        `,
        saveLabel: 'Simpan Siswa',
        onSave: async (modalEl) => {
          const roll = parseInt(modalEl.querySelector('#inpRoll').value, 10);
          const name = modalEl.querySelector('#inpStudentName').value.trim();
          const gender = modalEl.querySelector('#selGender').value;
          if (!name) {
            toast.error('Nama siswa tidak boleh kosong');
            return false;
          }
          await db.put('students', {
            classId: activeClass.id,
            rollNumber: roll || nextRoll,
            name,
            gender
          });
          toast.success(`Siswa ${name} berhasil ditambahkan!`);
          refresh();
          return true;
        }
      });
    });

    // Edit Student
    container.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', async () => {
        const student = await db.getById('students', btn.dataset.id);
        if (!student) return;
        openModal({
          title: 'Edit Data Siswa',
          contentHtml: `
            <div class="form-group">
              <label class="form-label">Nomor Urut</label>
              <input type="number" id="inpRoll" class="form-input" value="${student.rollNumber}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Nama Siswa</label>
              <input type="text" id="inpStudentName" class="form-input" value="${student.name}" required />
            </div>
            <div class="form-group">
              <label class="form-label">Jenis Kelamin</label>
              <select id="selGender" class="form-select">
                <option value="L" ${student.gender === 'L' ? 'selected' : ''}>Laki-laki</option>
                <option value="P" ${student.gender === 'P' ? 'selected' : ''}>Perempuan</option>
              </select>
            </div>
          `,
          saveLabel: 'Perbarui',
          onSave: async (modalEl) => {
            student.rollNumber = parseInt(modalEl.querySelector('#inpRoll').value, 10);
            student.name = modalEl.querySelector('#inpStudentName').value.trim();
            student.gender = modalEl.querySelector('#selGender').value;
            await db.put('students', student);
            toast.success('Data siswa diperbarui!');
            refresh();
            return true;
          }
        });
      });
    });

    // Delete Student
    container.querySelectorAll('.btn-del-student').forEach(btn => {
      btn.addEventListener('click', async () => {
        const student = await db.getById('students', btn.dataset.id);
        if (!student) return;
        if (confirm(`Hapus siswa "${student.name}"?`)) {
          await db.delete('students', student.id);
          toast.warning(`Siswa ${student.name} dihapus.`);
          refresh();
        }
      });
    });
  }

  await refresh();
}
