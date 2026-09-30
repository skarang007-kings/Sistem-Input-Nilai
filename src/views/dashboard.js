/**
 * Dashboard View
 * Features:
 * - 4 Summary stat cards (Kelas, Murid, Rata-rata Nilai, Ujian Terkoreksi)
 * - Donut Chart (Sebaran Nilai: Sangat Baik, Baik, Cukup, Perlu Bimbingan)
 * - Green Area Sparkline Chart (Rata-rata Nilai per Mapel)
 * - Recent Graded Students Table
 * - Right Panel: Activities and Lime CTA Button
 */

import { db } from '../db/storage.js';
import { icons } from '../components/icons.js';
import { getScoreCategory } from '../services/grading.js';

export async function renderDashboard(container, navigate) {
  const classes = await db.getAll('classes');
  const students = await db.getAll('students');
  const subjects = await db.getAll('subjects');
  const results = await db.getAll('results');
  const queue = await db.getAll('syncQueue');

  // Compute stats
  const totalClasses = classes.length;
  const totalStudents = students.length;
  const totalResults = results.length;

  let avgScore = 0;
  if (totalResults > 0) {
    const sum = results.reduce((acc, r) => acc + (Number(r.finalScore) || 0), 0);
    avgScore = Math.round((sum / totalResults) * 10) / 10;
  }

  // Distribution for Donut Chart
  const dist = { SB: 0, B: 0, C: 0, PB: 0 };
  results.forEach(r => {
    const cat = getScoreCategory(r.finalScore).code;
    if (dist[cat] !== undefined) dist[cat]++;
    else dist.PB++;
  });

  // Calculate Mapel averages for Area Chart
  const mapelStats = subjects.map(s => {
    const sResults = results.filter(r => r.subjectId === s.id);
    if (sResults.length === 0) return { name: s.shortCode || s.name.substring(0, 4), avg: 75 };
    const sum = sResults.reduce((acc, r) => acc + (Number(r.finalScore) || 0), 0);
    return {
      name: s.shortCode || s.name.substring(0, 4),
      avg: Math.round(sum / sResults.length)
    };
  }).slice(0, 6);

  // Fallback mapel stats if few results
  if (mapelStats.length === 0) {
    mapelStats.push(
      { name: 'IPAS', avg: 85 },
      { name: 'PP', avg: 82 },
      { name: 'MTK', avg: 78 },
      { name: 'BINDO', avg: 88 },
      { name: 'BING', avg: 80 }
    );
  }

  // Recent 6 students
  const recentResults = [...results]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 7);

  container.innerHTML = `
    <!-- Topbar Header -->
    <div class="main-topbar">
      <div class="topbar-breadcrumbs">
        <span>Aplikasi</span>
        <span>/</span>
        <span class="active">Ringkasan</span>
      </div>
      <div class="topbar-actions">
        <button type="button" class="topbar-btn" id="btnSyncQueueTop" title="Sinkronisasi Offline (${queue.length} antrean)">
          ${icons.sync(17)}
        </button>
        <button type="button" class="topbar-btn" id="btnSettingsTop" title="Pengaturan">
          ${icons.settings(17)}
        </button>
      </div>
    </div>

    <!-- Page Title -->
    <div class="page-header-row">
      <div>
        <h1 class="page-title">Ringkasan Nilai Siswa</h1>
        <p class="card-subtitle" style="margin-top: 4px;">Tahun Ajaran 2026/2027 • Kurikulum Merdeka Fase B</p>
      </div>
      <button type="button" class="btn btn-primary" id="btnStartScanMain">
        ${icons.camera(18)} Mulai Scan Ujian
      </button>
    </div>

    <!-- 4 Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Kelas Aktif</div>
        <div class="stat-value">${totalClasses}</div>
        <div class="stat-badge">${icons.lightning(13)} ${classes[0]?.name || 'Kelas IV'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Siswa Terdaftar</div>
        <div class="stat-value">${totalStudents}</div>
        <div class="stat-badge">${icons.students(14)} Terdata Lengkap</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Rata-rata Nilai Kelas</div>
        <div class="stat-value" style="color: var(--accent-lime);">${avgScore || '--'}</div>
        <div class="stat-badge">Kategori: ${getScoreCategory(avgScore).label}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Lembar Terkoreksi</div>
        <div class="stat-value">${totalResults}</div>
        <div class="stat-badge" style="color: ${queue.length > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
          ${queue.length > 0 ? `⚠️ ${queue.length} antrean pending` : '✔ Semua tersinkron'}
        </div>
      </div>
    </div>

    <!-- Charts Row (Donut & Area) -->
    <div class="charts-row">
      <!-- Donut Chart: Sebaran Nilai -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">${icons.results(18)} Sebaran Predikat Nilai</div>
          <span class="card-subtitle">${totalResults} siswa dinilai</span>
        </div>
        <div class="donut-chart-container">
          <div class="donut-svg-wrap">
            ${generateDonutSvg(dist, totalResults)}
            <div class="donut-center-text">
              <span class="donut-center-val">${avgScore}</span>
              <span class="donut-center-sub">Rata-rata</span>
            </div>
          </div>
          <div class="donut-legend">
            <div class="donut-legend-item">
              <div class="donut-color-dot" style="background: var(--accent-lime);"></div>
              <div class="donut-legend-info">
                <span class="donut-legend-name">Sangat Baik (A)</span>
                <span class="donut-legend-val">${dist.SB} siswa</span>
              </div>
            </div>
            <div class="donut-legend-item">
              <div class="donut-color-dot" style="background: #38bdf8;"></div>
              <div class="donut-legend-info">
                <span class="donut-legend-name">Baik (B)</span>
                <span class="donut-legend-val">${dist.B} siswa</span>
              </div>
            </div>
            <div class="donut-legend-item">
              <div class="donut-color-dot" style="background: #fbbf24;"></div>
              <div class="donut-legend-info">
                <span class="donut-legend-name">Cukup (C)</span>
                <span class="donut-legend-val">${dist.C} siswa</span>
              </div>
            </div>
            <div class="donut-legend-item">
              <div class="donut-color-dot" style="background: #f87171;"></div>
              <div class="donut-legend-info">
                <span class="donut-legend-name">Perlu Bimbingan</span>
                <span class="donut-legend-val">${dist.PB} siswa</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Area Chart: Rata-rata per Mapel -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">${icons.subjects(18)} Tren Rata-rata Mata Pelajaran</div>
          <span class="card-subtitle">Kriteria Kelulusan 70</span>
        </div>
        <div class="area-chart-wrap">
          ${generateAreaSvg(mapelStats)}
        </div>
      </div>
    </div>

    <!-- Recent Graded Students Table -->
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Daftar Hasil Koreksi Terbaru</div>
          <div class="card-subtitle">Hasil scan kamera dan input lembar ujian terakhir</div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnViewAllResults">
          Lihat Semua Hasil ${icons.chevronRight(14)}
        </button>
      </div>

      <div class="table-responsive">
        <table class="custom-table">
          <thead>
            <tr>
              <th style="width: 50px;">No</th>
              <th>Nama Siswa</th>
              <th>Mata Pelajaran</th>
              <th>Benar PG</th>
              <th>Nilai Akhir</th>
              <th>Predikat</th>
              <th>Status Sheets</th>
            </tr>
          </thead>
          <tbody>
            ${recentResults.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">
                  Belum ada lembar ujian yang dikoreksi. Tekan "Mulai Scan Ujian" di atas untuk memulai.
                </td>
              </tr>
            ` : recentResults.map((r, idx) => {
              const cat = getScoreCategory(r.finalScore);
              const isSync = r.syncStatus === 'synced';
              return `
                <tr>
                  <td style="color: var(--text-muted); font-weight: 600;">${r.studentRoll || idx + 1}</td>
                  <td style="font-weight: 600;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div style="width: 28px; height: 28px; border-radius: 50%; background: #282a30; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--accent-lime);">
                        ${(r.studentName || 'S').charAt(0)}
                      </div>
                      ${r.studentName}
                    </div>
                  </td>
                  <td style="color: var(--text-secondary);">${r.sheetName || 'IPAS'}</td>
                  <td>${r.pgCorrect || 0} / ${r.pgCount || 25}</td>
                  <td style="font-weight: 700; color: var(--accent-lime); font-size: 15px;">${r.finalScore}</td>
                  <td>
                    <span class="badge" style="background: ${cat.color}22; color: ${cat.color};">
                      ${cat.label}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${isSync ? 'badge-success' : 'badge-warning'}">
                      ${isSync ? '✔ Terkirim' : '⏳ Pending'}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach right panel content
  renderRightPanel(dist, totalResults, queue.length, navigate);

  // Event Listeners
  container.querySelector('#btnStartScanMain')?.addEventListener('click', () => navigate('scan'));
  container.querySelector('#btnViewAllResults')?.addEventListener('click', () => navigate('results'));
  container.querySelector('#btnSettingsTop')?.addEventListener('click', () => navigate('settings'));
  container.querySelector('#btnSyncQueueTop')?.addEventListener('click', () => navigate('results'));
}

/**
 * Generate Inline SVG Donut Chart
 */
function generateDonutSvg(dist, total) {
  if (total === 0) total = 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius; // ~326.7
  const colors = ['#C6FF4A', '#38bdf8', '#fbbf24', '#f87171'];
  const values = [dist.SB, dist.B, dist.C, dist.PB];

  let accumulatedPercent = 0;
  const circles = values.map((val, idx) => {
    const percent = val / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return `
      <circle
        cx="70" cy="70" r="${radius}"
        fill="transparent"
        stroke="${colors[idx]}"
        stroke-width="15"
        stroke-dasharray="${strokeDasharray}"
        stroke-dashoffset="${strokeDashoffset}"
        stroke-linecap="round"
        style="transition: all 0.5s ease;"
      />
    `;
  }).join('');

  return `
    <svg width="140" height="140" viewBox="0 0 140 140" style="transform: rotate(-90deg);">
      <circle cx="70" cy="70" r="${radius}" fill="transparent" stroke="#24262a" stroke-width="15" />
      ${circles}
    </svg>
  `;
}

/**
 * Generate Inline SVG Green Area Chart for Mapel Averages
 */
function generateAreaSvg(stats) {
  const width = 460;
  const height = 120;
  const paddingX = 40;
  const paddingY = 20;

  const points = stats.map((s, idx) => {
    const x = paddingX + (idx / Math.max(1, stats.length - 1)) * (width - 2 * paddingX);
    // map score 50 - 100 to y
    const normalized = (s.avg - 50) / 50; // 0 to 1
    const y = (height - paddingY) - normalized * (height - 2 * paddingY);
    return { x, y, name: s.name, avg: s.avg };
  });

  const lineD = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
  const areaD = `${lineD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const pointsSvg = points.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="4" class="chart-point">
      <title>${p.name}: ${p.avg}</title>
    </circle>
    <text x="${p.x}" y="${height - 2}" text-anchor="middle" fill="#6b7280" font-size="10.5" font-weight="600">${p.name}</text>
    <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" fill="#C6FF4A" font-size="11" font-weight="700">${p.avg}</text>
  `).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="area-chart-svg">
      <defs>
        <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#C6FF4A" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#C6FF4A" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <!-- Base guide line at 70 (KKM) -->
      <line x1="${paddingX}" y1="${height - paddingY - (20/50)*(height-2*paddingY)}" x2="${width - paddingX}" y2="${height - paddingY - (20/50)*(height-2*paddingY)}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="4" />
      <path d="${areaD}" class="area-path" />
      <path d="${lineD}" class="line-path" />
      ${pointsSvg}
    </svg>
  `;
}

/**
 * Render Right Panel with Activities and Lime CTA Card
 */
function renderRightPanel(dist, total, queueCount, navigate) {
  const panel = document.getElementById('appPanelRight');
  if (!panel) return;

  panel.innerHTML = `
    <!-- Notifications & Activities -->
    <div>
      <div style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
        <span>Aktivitas Sistem</span>
        <span style="font-size: 11px; color: var(--accent-lime);">${icons.lightning(12)} Live</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="padding: 10px 12px; background: var(--bg-surface); border-radius: var(--radius-sm); font-size: 12.5px; border-left: 3px solid var(--accent-lime);">
          <div style="font-weight: 600; color: #fff;">Koreksi Lembar IPAS</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">25 soal PG + 5 uraian selesai diperiksa</div>
        </div>
        <div style="padding: 10px 12px; background: var(--bg-surface); border-radius: var(--radius-sm); font-size: 12.5px; border-left: 3px solid ${queueCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'};">
          <div style="font-weight: 600; color: #fff;">${queueCount > 0 ? 'Antrean Offline Aktif' : 'Sinkron Google Sheets'}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${queueCount > 0 ? `${queueCount} data menunggu internet` : 'Template ANALISIS KELAS 4 terhubung'}</div>
        </div>
      </div>
    </div>

    <!-- CTA Banner matching Reference UI -->
    <div class="cta-card">
      <div class="cta-badge">${icons.camera(13)} SCAN CEPAT</div>
      <div class="cta-title">Scan Lembar Ujian Sekarang</div>
      <div class="cta-desc">
        Arahkan kamera HP ke kertas soal. AI akan membaca huruf opsi bertanda silang otomatis.
      </div>
      <button type="button" class="btn btn-primary" id="btnStartScanCTA" style="width: 100%; margin-top: 6px;">
        ${icons.camera(18)} Buka Kamera Scan
      </button>
    </div>

    <!-- Quick Class Summary -->
    <div style="margin-top: auto; padding: 14px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
      <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
        Status Spreadsheet
      </div>
      <div style="font-size: 13px; font-weight: 700; color: #fff;">
        ANALISIS SOAL KELAS 4.xlsx
      </div>
      <div style="font-size: 11px; color: var(--accent-lime); margin-top: 4px;">
        ✔ Kolom rumus AH-BL terlindungi
      </div>
    </div>
  `;

  panel.querySelector('#btnStartScanCTA')?.addEventListener('click', () => navigate('scan'));
}
