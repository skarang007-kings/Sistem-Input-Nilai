import { calculateGrade, getScoreCategory } from '../src/services/grading.js';
import assert from 'assert';

console.log('Testing grading logic...');

// Test Case 1: IPAS template test
// 25 PG questions, 5 Uraian questions with max scores [3, 3, 3, 2, 2]
// Total possible score: 25 + 13 = 38
// Perfect score: 25 correct + 13 uraian = 38 => (38 * 100) / 38 = 100
{
  const keys = ['A','D','B','C','A','D','B','D','A','A','B','A','B','C','A','B','A','D','A','B','A','C','A','B','A'];
  const answers = keys.map((ans, idx) => ({ no: idx + 1, jawaban: ans, confidence: 0.98 }));
  const uraianMaxScores = [3, 3, 3, 2, 2];
  const uraianScores = [3, 3, 3, 2, 2];

  const result = calculateGrade({
    answers,
    keys,
    pgCount: 25,
    uraianScores,
    uraianMaxScores
  });

  assert.strictEqual(result.pgCount, 25);
  assert.strictEqual(result.pgCorrect, 25);
  assert.strictEqual(result.pgWrong, 0);
  assert.strictEqual(result.totalUraianScore, 13);
  assert.strictEqual(result.totalMaxPossible, 38);
  assert.strictEqual(result.finalScore, 100);
  assert.strictEqual(getScoreCategory(result.finalScore).code, 'SB');
  console.log('✔ Test Case 1 passed: Perfect score yields 100');
}

// Test Case 2: Partial score matching typical student exam
// Student gets 20 PG correct, 3 wrong, 2 empty
// Uraian: [2, 3, 1, 2, 0] = 8 points out of 13
// Total points: 20 + 8 = 28 / 38 * 100 = 73.68
{
  const keys = Array(25).fill('A');
  const answers = [
    ...Array(20).fill(null).map((_, i) => ({ no: i + 1, jawaban: 'A' })),
    { no: 21, jawaban: 'B' },
    { no: 22, jawaban: 'C' },
    { no: 23, jawaban: 'D' },
    { no: 24, jawaban: null },
    { no: 25, jawaban: null }
  ];
  const uraianMaxScores = [3, 3, 3, 2, 2];
  const uraianScores = [2, 3, 1, 2, 0]; // sum = 8

  const result = calculateGrade({
    answers,
    keys,
    pgCount: 25,
    uraianScores,
    uraianMaxScores
  });

  assert.strictEqual(result.pgCorrect, 20);
  assert.strictEqual(result.pgWrong, 3);
  assert.strictEqual(result.pgEmpty, 2);
  assert.strictEqual(result.totalUraianScore, 8);
  assert.strictEqual(result.finalScore, 73.68);
  assert.strictEqual(getScoreCategory(result.finalScore).code, 'B');
  console.log('✔ Test Case 2 passed: Partial score correctly calculated as 73.68 (Category: Baik)');
}

// Test Case 3: Pure Multiple Choice without Uraian (e.g. 50 PG questions)
{
  const keys = Array(50).fill('B');
  const answers = Array(45).fill(null).map((_, i) => ({ no: i + 1, jawaban: 'B' })); // 45 correct, 5 empty
  const result = calculateGrade({
    answers,
    keys,
    pgCount: 50,
    uraianScores: [],
    uraianMaxScores: []
  });

  assert.strictEqual(result.pgCorrect, 45);
  assert.strictEqual(result.pgEmpty, 5);
  assert.strictEqual(result.totalMaxPossible, 50);
  assert.strictEqual(result.finalScore, 90);
  assert.strictEqual(getScoreCategory(result.finalScore).code, 'SB');
  console.log('✔ Test Case 3 passed: Pure 50 PG questions correctly graded as 90');
}

console.log('\nAll grading unit tests passed successfully!\n');
