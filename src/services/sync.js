/**
 * Sync Service & Google Apps Script Client
 * Communicates with Google Apps Script Web App using POST with text/plain (CORS preflight safe)
 * Handles offline queueing, automatic retry upon reconnection, and manual sync.
 */

import { db } from '../db/storage.js';

export const syncService = {
  async getSettings() {
    const s = await db.getById('settings', 'app_config');
    return s || { webAppUrl: '', secretToken: '', demoMode: true };
  },

  /**
   * Send JSON payload to Google Apps Script Web App
   */
  async callBackend(action, payload = {}) {
    const settings = await this.getSettings();
    const url = settings.webAppUrl?.trim();

    if (!url) {
      throw new Error('URL Google Apps Script belum diisi di Pengaturan');
    }

    const bodyData = {
      action,
      token: settings.secretToken?.trim() || '',
      spreadsheetId: settings.spreadsheetId?.trim() || '',
      ...payload
    };

    // Google Apps Script requires text/plain to avoid OPTIONS preflight CORS blockage
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.status === 'error') {
      throw new Error(result.message || 'Error dari Google Apps Script');
    }
    return result;
  },

  async pingBackend() {
    return this.callBackend('ping');
  },

  /**
   * Save result to Google Sheets
   * If online & backend configured, calls backend directly.
   * If fails or offline, enqueues to syncQueue and marks result as 'pending'.
   */
  async saveResultToSheets(resultData) {
    const settings = await this.getSettings();

    // In demo mode or if no backend configured, mark as synced locally
    if (settings.demoMode || !settings.webAppUrl) {
      return { success: true, mode: 'demo', message: 'Tersimpan lokal (Mode Demo Aktif)' };
    }

    // Try online sync first
    if (navigator.onLine) {
      try {
        const res = await this.callBackend('saveResult', {
          sheetName: resultData.sheetName,
          studentName: resultData.studentName,
          studentRoll: resultData.studentRoll,
          answers: resultData.answers, // array of A, B, C, D
          uraianScores: resultData.uraianScores || [],
          layout: resultData.layout || { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
        });

        // Update result sync status in db
        resultData.syncStatus = 'synced';
        resultData.syncError = null;
        resultData.syncedAt = new Date().toISOString();
        await db.put('results', resultData);

        return { success: true, message: 'Berhasil disinkronkan ke Google Sheets', data: res };
      } catch (err) {
        console.warn('Direct sync failed, queueing for later retry:', err);
      }
    }

    // Enqueue if offline or failed
    resultData.syncStatus = 'pending';
    resultData.syncError = 'Menunggu koneksi internet / sinkronisasi ulang';
    await db.put('results', resultData);

    await this.enqueue({
      resultId: resultData.id,
      payload: {
        sheetName: resultData.sheetName,
        studentName: resultData.studentName,
        studentRoll: resultData.studentRoll,
        answers: resultData.answers,
        uraianScores: resultData.uraianScores || [],
        layout: resultData.layout || { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
      }
    });

    return {
      success: false,
      queued: true,
      message: 'Koneksi terganggu. Data disimpan ke antrean offline dan akan dikirim otomatis saat online.'
    };
  },

  /**
   * Save answer key to Google Sheets (Row 9)
   */
  async saveKeyToSheets(subject) {
    const settings = await this.getSettings();
    if (settings.demoMode || !settings.webAppUrl) {
      return { success: true, mode: 'demo' };
    }

    return this.callBackend('saveKey', {
      sheetName: subject.sheetName,
      subjectName: subject.name,
      className: subject.className || '',
      keys: subject.answerKeys,
      uraianMaxScores: subject.uraianMaxScores || [],
      layout: subject.layout || { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    });
  },

  async enqueue(item) {
    item.id = 'queue_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    item.retries = 0;
    item.createdAt = new Date().toISOString();
    await db.put('syncQueue', item);
  },

  /**
   * Process all pending offline sync queue items
   */
  async processQueue() {
    if (!navigator.onLine) return { processed: 0, pending: 0 };
    const settings = await this.getSettings();
    if (!settings.webAppUrl || settings.demoMode) return { processed: 0, pending: 0 };

    const queue = await db.getAll('syncQueue');
    if (queue.length === 0) return { processed: 0, pending: 0 };

    console.log(`Processing ${queue.length} offline sync items...`);
    let processed = 0;

    for (const item of queue) {
      try {
        await this.callBackend('saveResult', item.payload);
        
        // Update corresponding result
        if (item.resultId) {
          const res = await db.getById('results', item.resultId);
          if (res) {
            res.syncStatus = 'synced';
            res.syncError = null;
            res.syncedAt = new Date().toISOString();
            await db.put('results', res);
          }
        }

        await db.delete('syncQueue', item.id);
        processed++;
      } catch (err) {
        console.error('Queue item sync failed:', err);
        item.retries = (item.retries || 0) + 1;
        item.lastError = err.message;
        await db.put('syncQueue', item);
      }
    }

    return { processed, pending: queue.length - processed };
  }
};

// Automatic listener when internet returns
window.addEventListener('online', () => {
  console.log('Internet connected, auto-flushing sync queue...');
  syncService.processQueue();
});
