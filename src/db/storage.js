/**
 * Storage Layer: IndexedDB with localStorage fallback
 * Supports CRUD for classes, students, subjects, answer keys, exam results, sync queue, settings.
 * Includes complete Export / Import JSON functionality.
 */

const DB_NAME = 'SistemInputNilaiDB';
const DB_VERSION = 1;
const STORE_NAMES = ['classes', 'students', 'subjects', 'results', 'syncQueue', 'settings'];

let dbInstance = null;

function openDB() {
  return new Promise((resolve) => {
    if (dbInstance) return resolve(dbInstance);
    if (!window.indexedDB) return resolve(null);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.warn('IndexedDB failed to open, falling back to localStorage');
      resolve(null);
    };
  });
}

async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  if (db) {
    const tx = db.transaction(storeName, mode);
    return {
      type: 'idb',
      store: tx.objectStore(storeName),
      tx
    };
  }
  return { type: 'local', key: `sin_${storeName}` };
}

export const db = {
  async getAll(storeName) {
    const s = await getStore(storeName, 'readonly');
    if (s.type === 'idb') {
      return new Promise((resolve, reject) => {
        const req = s.store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      const raw = localStorage.getItem(s.key);
      return raw ? JSON.parse(raw) : [];
    }
  },

  async getById(storeName, id) {
    const s = await getStore(storeName, 'readonly');
    if (s.type === 'idb') {
      return new Promise((resolve, reject) => {
        const req = s.store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } else {
      const list = await this.getAll(storeName);
      return list.find(item => item.id === id) || null;
    }
  },

  async put(storeName, item) {
    if (!item.id) item.id = 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    item.updatedAt = new Date().toISOString();

    const s = await getStore(storeName, 'readwrite');
    if (s.type === 'idb') {
      return new Promise((resolve, reject) => {
        const req = s.store.put(item);
        req.onsuccess = () => resolve(item);
        req.onerror = () => reject(req.error);
      });
    } else {
      const list = await this.getAll(storeName);
      const idx = list.findIndex(x => x.id === item.id);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      localStorage.setItem(s.key, JSON.stringify(list));
      return item;
    }
  },

  async delete(storeName, id) {
    const s = await getStore(storeName, 'readwrite');
    if (s.type === 'idb') {
      return new Promise((resolve, reject) => {
        const req = s.store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } else {
      let list = await this.getAll(storeName);
      list = list.filter(x => x.id !== id);
      localStorage.setItem(s.key, JSON.stringify(list));
      return true;
    }
  },

  async clear(storeName) {
    const s = await getStore(storeName, 'readwrite');
    if (s.type === 'idb') {
      return new Promise((resolve, reject) => {
        const req = s.store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } else {
      localStorage.removeItem(s.key);
      return true;
    }
  },

  // Export all databases into single backup JSON
  async exportBackup() {
    const data = {};
    for (const name of STORE_NAMES) {
      data[name] = await this.getAll(name);
    }
    return {
      version: 1,
      appName: 'Sistem Input Nilai',
      exportedAt: new Date().toISOString(),
      data
    };
  },

  // Import JSON backup and replace/merge
  async importBackup(backupJson) {
    if (!backupJson || !backupJson.data) throw new Error('Format cadangan tidak valid');
    for (const name of STORE_NAMES) {
      if (Array.isArray(backupJson.data[name])) {
        await this.clear(name);
        for (const item of backupJson.data[name]) {
          await this.put(name, item);
        }
      }
    }
    return true;
  }
};

/**
 * Seed initial data if database is empty so teacher immediately has
 * working sample class, students, subjects (IPAS, Matematika, etc.), keys, and settings.
 */
export async function initSeedData() {
  const classes = await db.getAll('classes');
  if (classes.length > 0) return; // already seeded

  console.log('Seeding initial data for Sistem Input Nilai...');

  // 1. Initial Class
  const defaultClass = {
    id: 'class_iv_2026',
    name: 'IV (Empat)',
    academicYear: '2026/2027',
    teacherName: 'Pak Guru Husni',
    notes: 'Kelas IV Kurikulum Merdeka Fase B'
  };
  await db.put('classes', defaultClass);

  // 2. Initial Students (matching typical class list)
  const sampleStudents = [
    'Aditia Pratama', 'Bella Septiani', 'Cindy Claudia', 'Daffa Al Ghifari',
    'Eko Prasetyo', 'Fajar Ramadhan', 'Gita Savitri', 'Hafiz Fauzan',
    'Intan Permata', 'Jafar Husni', 'Kevin Sanjaya', 'Laila Fitri',
    'Muhammad Rizky', 'Nabila Az-Zahra', 'Omar Dani', 'Putri Ayu',
    'Qonita Rahma', 'Raditya Dika', 'Siti Nurhaliza', 'Tariq Ziyad',
    'Utami Dewi', 'Vina Panduwinata', 'Wahyu Hidayat', 'Xena Maharani',
    'Yoga Pratama', 'Zahra Amelia'
  ];

  for (let i = 0; i < sampleStudents.length; i++) {
    await db.put('students', {
      id: `student_${i + 1}`,
      classId: defaultClass.id,
      rollNumber: i + 1,
      name: sampleStudents[i],
      gender: i % 2 === 0 ? 'L' : 'P'
    });
  }

  // 3. Initial Subjects (Mapel) matching Google Sheets template sheets
  const defaultSubjects = [
    {
      id: 'subj_ipas',
      name: 'IPAS (Ilmu Pengetahuan Alam & Sosial)',
      shortCode: 'IPAS',
      sheetName: 'IPAS',
      classId: defaultClass.id,
      pgCount: 25,
      // Sample key matching the exam paper photo
      // No 1-13 (p1): A, B, D, C, C, A, B, B, B, A, A, D, B
      // No 14-25 (p2): A, A, B, A, B, A, B, B, A, A, B, A
      answerKeys: ['A','B','D','C','C','A','B','B','B','A','A','D','B','A','A','B','A','B','A','B','B','A','A','B','A'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_pp',
      name: 'Pendidikan Pancasila',
      shortCode: 'PP',
      sheetName: 'PP',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['B','A','C','D','A','B','C','A','D','C','B','A','D','C','B','A','C','D','A','B','C','D','A','B','C'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_matematika',
      name: 'Matematika',
      shortCode: 'MTK',
      sheetName: 'MATEMATIKA',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['C','B','A','A','D','B','C','D','B','C','A','B','D','C','A','B','C','D','A','D','B','C','A','B','C'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_bindo',
      name: 'Bahasa Indonesia',
      shortCode: 'BINDO',
      sheetName: 'BAHASA INDONESIA',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['A','C','B','D','A','B','A','C','D','B','A','C','B','D','A','C','B','D','A','B','C','D','A','B','C'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_bing',
      name: 'Bahasa Inggris',
      shortCode: 'BING',
      sheetName: 'BAHASA INGGRIS',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['B','A','D','C','B','A','D','C','B','A','D','C','B','A','D','C','B','A','D','C','B','A','D','C','B'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_seni',
      name: 'Seni Budaya',
      shortCode: 'SENI',
      sheetName: 'SENI BUDAYA',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_sunda',
      name: 'Bahasa Sunda',
      shortCode: 'SUNDA',
      sheetName: 'SUNDA',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['C','D','A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A','B','C'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_pai',
      name: 'Pendidikan Agama Islam (PAI)',
      shortCode: 'PAI',
      sheetName: 'KELAS 4',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A','B','C','D','A'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    },
    {
      id: 'subj_pjok',
      name: 'PJOK',
      shortCode: 'PJOK',
      sheetName: 'PJOK-KLS 4',
      classId: defaultClass.id,
      pgCount: 25,
      answerKeys: ['B','A','D','C','B','A','D','C','B','A','D','C','B','A','D','C','B','A','D','C','B','A','D','C','B'],
      hasUraian: true,
      uraianCount: 5,
      uraianMaxScores: [3, 3, 3, 2, 2],
      layout: { keyRow: 9, firstStudentRow: 10, firstAnswerCol: 'C' }
    }
  ];

  for (const s of defaultSubjects) {
    await db.put('subjects', s);
  }

  // 4. Sample Results to populate dashboard nicely
  const sampleGraded = [
    { name: 'Aditia Pratama', roll: 1, correct: 24, uraian: [3,3,3,2,2], score: 97.37, cat: 'SB', sync: 'synced' },
    { name: 'Bella Septiani', roll: 2, correct: 23, uraian: [3,3,2,2,2], score: 92.11, cat: 'SB', sync: 'synced' },
    { name: 'Cindy Claudia', roll: 3, correct: 21, uraian: [3,2,3,1,2], score: 84.21, cat: 'B', sync: 'synced' },
    { name: 'Daffa Al Ghifari', roll: 4, correct: 19, uraian: [2,2,2,1,2], score: 73.68, cat: 'B', sync: 'pending' },
    { name: 'Eko Prasetyo', roll: 5, correct: 17, uraian: [2,1,2,1,1], score: 63.16, cat: 'C', sync: 'pending' },
    { name: 'Fajar Ramadhan', roll: 6, correct: 14, uraian: [1,1,1,0,1], score: 47.37, cat: 'PB', sync: 'synced' }
  ];

  for (const item of sampleGraded) {
    await db.put('results', {
      id: `res_${item.roll}`,
      classId: defaultClass.id,
      className: defaultClass.name,
      subjectId: 'subj_ipas',
      subjectName: 'IPAS (Ilmu Pengetahuan Alam & Sosial)',
      sheetName: 'IPAS',
      studentId: `student_${item.roll}`,
      studentRoll: item.roll,
      studentName: item.name,
      pgCount: 25,
      pgCorrect: item.correct,
      pgWrong: 25 - item.correct,
      uraianScores: item.uraian,
      totalScoreEarned: item.correct + item.uraian.reduce((a, b) => a + b, 0),
      totalMaxPossible: 38,
      finalScore: item.score,
      category: item.cat,
      syncStatus: item.sync, // 'synced' | 'pending' | 'failed'
      syncError: null,
      createdAt: new Date(Date.now() - (7 - item.roll) * 3600000).toISOString()
    });
  }

  // 5. Initial Settings
  await db.put('settings', {
    id: 'app_config',
    appTitle: 'Sistem Input Nilai SD',
    webAppUrl: '',
    secretToken: 'guru-sd-super-secret-2026',
    spreadsheetId: '',
    demoMode: true, // Default to demo mode if no Web App URL set yet
    activeClassId: defaultClass.id,
    activeSubjectId: 'subj_ipas',
    geminiModel: 'gemini-1.5-flash',
    theme: 'dark'
  });

  console.log('Seed data initialized successfully.');
}
