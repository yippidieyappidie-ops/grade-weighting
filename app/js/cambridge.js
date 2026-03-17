// ==========================================
// MOTOR OFICIAL CAMBRIDGE ENGLISH SCALE
// ==========================================

export const CAMBRIDGE_LEVELS = {
  'A1': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 20, 'Writing': 20, 'Listening': 20, 'Speaking': 20 } },
  'A2': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 30, 'Writing': 30, 'Listening': 25, 'Speaking': 15 } },
  'B1': { parts: ['Reading', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 32, 'Writing': 40, 'Listening': 25, 'Speaking': 30 } },
  'B2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 42, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 60 } },
  'C1': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 50, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } },
  'C2': { parts: ['Reading', 'Use of English', 'Writing', 'Listening', 'Speaking'], max: { 'Reading': 56, 'Use of English': 28, 'Writing': 40, 'Listening': 30, 'Speaking': 75 } }
};

export const CAMBRIDGE_CURVES = {
  'A1': [[0, 60], [0.45, 80], [0.60, 90], [0.75, 100], [0.80, 110], [1, 120]],
  'A2': [[0, 82], [0.45, 100], [0.60, 120], [0.75, 133], [0.80, 140], [1, 150]],
  'B1': [[0, 102], [0.45, 120], [0.60, 140], [0.75, 153], [0.80, 160], [1, 170]],
  'B2': [[0, 122], [0.45, 140], [0.60, 160], [0.75, 173], [0.80, 180], [1, 190]],
  'C1': [[0, 142], [0.45, 160], [0.60, 180], [0.75, 193], [0.80, 200], [1, 210]],
  'C2': [[0, 162], [0.45, 180], [0.60, 200], [0.75, 213], [0.80, 220], [1, 230]]
};

export function calculateScaleScore(level, pct) {
  const curve = CAMBRIDGE_CURVES[level] || CAMBRIDGE_CURVES['B2'];
  if (pct <= 0) return curve[0][1]; 
  if (pct >= 1) return curve[curve.length - 1][1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [p1, s1] = curve[i]; 
    const [p2, s2] = curve[i+1];
    if (pct >= p1 && pct <= p2) { 
      return Math.round(s1 + ((pct - p1) / (p2 - p1)) * (s2 - s1)); 
    }
  }
  return curve[0][1];
}

export function getCambridgeGrade(level, scaleScore) {
  if (level === 'C2') { if (scaleScore >= 220) return 'Grade A'; if (scaleScore >= 213) return 'Grade B'; if (scaleScore >= 200) return 'Grade C'; if (scaleScore >= 180) return 'Level C1'; return 'Fail'; }
  if (level === 'C1') { if (scaleScore >= 200) return 'Grade A'; if (scaleScore >= 193) return 'Grade B'; if (scaleScore >= 180) return 'Grade C'; if (scaleScore >= 160) return 'Level B2'; return 'Fail'; }
  if (level === 'B2') { if (scaleScore >= 180) return 'Grade A'; if (scaleScore >= 173) return 'Grade B'; if (scaleScore >= 160) return 'Grade C'; if (scaleScore >= 140) return 'Level B1'; return 'Fail'; }
  if (level === 'B1') { if (scaleScore >= 160) return 'Grade A'; if (scaleScore >= 153) return 'Grade B'; if (scaleScore >= 140) return 'Grade C'; if (scaleScore >= 120) return 'Level A2'; return 'Fail'; }
  if (level === 'A2') { if (scaleScore >= 140) return 'Distinction'; if (scaleScore >= 133) return 'Merit'; if (scaleScore >= 120) return 'Pass'; if (scaleScore >= 100) return 'Level A1'; return 'Fail'; }
  if (level === 'A1') { if (scaleScore >= 120) return 'Distinction'; if (scaleScore >= 110) return 'Merit'; if (scaleScore >= 100) return 'Pass'; return 'Fail'; }
  return 'Fail';
}

export function getCambridgeColor(level, scaleScore) {
  const grade = getCambridgeGrade(level, scaleScore);
  if (grade.includes('Grade A') || grade.includes('Distinction')) return 'var(--green)';
  if (grade.includes('Grade B') || grade.includes('Merit')) return '#0055ff'; 
  if (grade.includes('Grade C') || grade.includes('Pass')) return 'var(--gold)';
  return 'var(--accent)'; 
}
