/**
 * Logic for student exam grading
 * Formula specification:
 * PG: 1 point per correct answer.
 * Uraian: manual score per question (0 up to max score).
 * Final Score (Na):
 *   Na = Math.round(((total_pg_correct + total_uraian_score) * 100) / (total_pg_count + total_uraian_max_score))
 * Matches Google Sheets column BL formula: =(SUM(AH10:BK10)*100)/38
 */

export function calculateGrade({
  answers = [], // array of { no: number, jawaban: string|null }
  keys = [],    // array of string "A"|"B"|"C"|"D" (1-indexed or 0-indexed aligned)
  pgCount = 25,
  uraianScores = [], // array of numbers entered for each uraian question
  uraianMaxScores = [] // array of numbers for max score per uraian question
}) {
  let pgCorrect = 0;
  let pgWrong = 0;
  let pgEmpty = 0;
  const itemResults = [];

  for (let i = 0; i < pgCount; i++) {
    const qNum = i + 1;
    const studentAnsObj = answers.find(a => Number(a.no) === qNum);
    const studentAns = studentAnsObj && studentAnsObj.jawaban ? String(studentAnsObj.jawaban).trim().toUpperCase() : null;
    const correctKey = keys[i] ? String(keys[i]).trim().toUpperCase() : null;

    let isCorrect = false;
    if (!studentAns) {
      pgEmpty++;
    } else if (correctKey && studentAns === correctKey) {
      isCorrect = true;
      pgCorrect++;
    } else {
      pgWrong++;
    }

    itemResults.push({
      no: qNum,
      type: 'PG',
      studentAnswer: studentAns,
      key: correctKey,
      isCorrect,
      confidence: studentAnsObj?.confidence ?? 1.0,
      note: studentAnsObj?.catatan || ''
    });
  }

  // Uraian score
  let totalUraianScore = 0;
  let totalUraianMax = 0;
  const uraianResults = [];

  for (let j = 0; j < uraianMaxScores.length; j++) {
    const qNum = pgCount + j + 1;
    const maxScore = Number(uraianMaxScores[j]) || 0;
    const scoreGiven = Number(uraianScores[j]) || 0;
    const validScore = Math.min(Math.max(0, scoreGiven), maxScore);

    totalUraianScore += validScore;
    totalUraianMax += maxScore;

    uraianResults.push({
      no: qNum,
      type: 'URAIAN',
      score: validScore,
      maxScore
    });
  }

  const totalMaxPossible = pgCount + totalUraianMax;
  let finalScore = 0;
  if (totalMaxPossible > 0) {
    const rawVal = ((pgCorrect + totalUraianScore) * 100) / totalMaxPossible;
    // Round to 2 decimals or integer as common in SD
    finalScore = Math.round(rawVal * 100) / 100;
  }

  return {
    pgCount,
    pgCorrect,
    pgWrong,
    pgEmpty,
    itemResults,
    uraianResults,
    totalUraianScore,
    totalUraianMax,
    totalScoreEarned: pgCorrect + totalUraianScore,
    totalMaxPossible,
    finalScore // 0 - 100
  };
}

/**
 * Categorize score for SD assessment:
 * 85 - 100: Sangat Baik (A)
 * 70 - 84:  Baik (B)
 * 55 - 69:  Cukup (C)
 * < 55:     Perlu Bimbingan (D)
 */
export function getScoreCategory(score) {
  if (score >= 85) return { code: 'SB', label: 'Sangat Baik', color: '#C6FF4A' };
  if (score >= 70) return { code: 'B',  label: 'Baik', color: '#38bdf8' };
  if (score >= 55) return { code: 'C',  label: 'Cukup', color: '#fbbf24' };
  return { code: 'PB', label: 'Perlu Bimbingan', color: '#f87171' };
}
