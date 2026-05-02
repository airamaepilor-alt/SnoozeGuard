const fs = require('fs');
const path = require('path');

const csv = fs.readFileSync(path.join(__dirname, 'Survey.csv'), 'utf8');
const rows = csv.split('\n').map(r => r.trim()).filter(Boolean);

function parseCSVRow(row) {
  const result = [];
  let cur = '', inQ = false;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function score(text) {
  const m = text.match(/^(\d)/);
  return m ? parseInt(m[1]) : null;
}

// 7 demographic cols, then Q1–Q66, then 2 open-ended
const Q_OFFSET = 7;

// ISO/IEC 25010 characteristic → [startQ, endQ] (0-based within Q1–Q66)
const GROUPS = {
  'Functional Suitability': [0, 12],   // Q1–Q13  (13 items)
  'Performance Efficiency': [13, 19],  // Q14–Q20 (7 items)
  'Compatibility':          [20, 24],  // Q21–Q25 (5 items)
  'Usability':              [25, 36],  // Q26–Q37 (12 items)
  'Reliability':            [37, 45],  // Q38–Q46 (9 items)
  'Security':               [46, 51],  // Q47–Q52 (6 items)
  'Maintainability':        [52, 57],  // Q53–Q58 (6 items)
  'Portability':            [58, 63],  // Q59–Q64 (6 items)
  'Overall Satisfaction':   [64, 65],  // Q65–Q66 (2 items)
};

const totals = {};
const counts = {};
const perQTotal = Array(66).fill(0);
const perQCount = Array(66).fill(0);
for (const g in GROUPS) { totals[g] = 0; counts[g] = 0; }

const demographics = [];
let n = 0;

for (let ri = 1; ri < rows.length; ri++) {
  const cols = parseCSVRow(rows[ri]);
  // need at least Q1–Q66
  if (cols.length < Q_OFFSET + 66) { console.log(`Row ${ri+1} skipped – only ${cols.length} cols`); continue; }

  n++;
  demographics.push({
    age: cols[3], gender: cols[4], occupation: cols[5], experience: cols[6]
  });

  for (const [g, [s, e]] of Object.entries(GROUPS)) {
    let sum = 0, cnt = 0;
    for (let q = s; q <= e; q++) {
      const v = score(cols[Q_OFFSET + q]);
      if (v !== null) {
        sum += v;
        cnt++;
        perQTotal[q] += v;
        perQCount[q]++;
      }
    }
    if (cnt > 0) { totals[g] += sum / cnt; counts[g]++; }
  }
}

function interp(wm) {
  if (wm >= 4.50) return 'Excellent';
  if (wm >= 3.50) return 'Very Satisfactory';
  if (wm >= 2.50) return 'Satisfactory';
  if (wm >= 1.50) return 'Poor';
  return 'Very Poor';
}

console.log(`\nTotal respondents parsed: ${n}\n`);

// Demographic breakdown
const expMap = {};
demographics.forEach(d => { expMap[d.experience] = (expMap[d.experience] || 0) + 1; });
console.log('--- Experience levels ---');
for (const [k,v] of Object.entries(expMap)) console.log(`  ${k}: ${v}`);

// Per-characteristic means
console.log('\n--- ISO/IEC 25010 Weighted Means ---');
const results = {};
for (const [g, [s, e]] of Object.entries(GROUPS)) {
  const wm = totals[g] / counts[g];
  results[g] = wm;
  const items = e - s + 1;
  console.log(`${g} (${items} items): WM = ${wm.toFixed(4)} → ${interp(wm)}`);
}

// Grand mean
const all = Object.values(results);
const grand = all.reduce((a,b) => a+b, 0) / all.length;
console.log(`\nGrand Mean (all characteristics): ${grand.toFixed(4)} → ${interp(grand)}`);

// Per-question means (for sub-characteristic tables)
console.log('\n--- Per-Question Means ---');
const qHeaders = [
  'Q1 Yawn detection real-time',
  'Q2 Head nodding/movement detection',
  'Q3 Alert at configured threshold',
  'Q4 Emergency SMS/push notification',
  'Q5 IoT audio/vibration/LED response',
  'Q6 Records/stores session data',
  'Q7 Drowsiness level reflects fatigue',
  'Q8 Alerts sent to correct contact',
  'Q9 Session history/analytics accurate',
  'Q10 IoT dismiss button works',
  'Q11 10-level scoring appropriate',
  'Q12 Escalating alerts appropriate',
  'Q13 120s countdown sufficient',
  'Q14 Minimal perceptible delay (detection)',
  'Q15 Alert modal appears promptly',
  'Q16 IoT device responds timely',
  'Q17 EC notification delivered promptly',
  'Q18 App runs smoothly, no lag',
  'Q19 No excessive heating',
  'Q20 Battery consumption acceptable',
  'Q21 Runs alongside other apps',
  'Q22 IoT no BT interference',
  'Q23 Mobile-IoT connection/communication',
  'Q24 Session data sync mobile-cloud',
  'Q25 Web dashboard reflects same data',
  'Q26 Purpose immediately clear',
  'Q27 Drowsiness indicator clear',
  'Q28 First-time users can start without help',
  'Q29 EC setup easy',
  'Q30 IoT pairing straightforward',
  'Q31 Navigation intuitive',
  'Q32 Dismissing alert minimal interaction',
  'Q33 Dark/light theme improves usability',
  'Q34 Prevents accidental session end',
  'Q35 Feedback when actions fail',
  'Q36 Visual design clean/professional',
  'Q37 Color scheme/typography appropriate',
  'Q38 Face detection consistent',
  'Q39 No crashes during normal use',
  'Q40 Alert events reliably recorded',
  'Q41 Monitoring starts quickly',
  'Q42 Works in offline mode',
  'Q43 Mobile works without IoT device',
  'Q44 Offline data sync when reconnected',
  'Q45 Sessions retained after restart',
  'Q46 Auth state preserved across restarts',
  'Q47 Session data stored securely',
  'Q48 No sharing without consent',
  'Q49 Records cannot be altered unauthorized',
  'Q50 Admin config requires credentials',
  'Q51 Login securely verifies identity',
  'Q52 Only authorized users access system',
  'Q53 Components independently updatable',
  'Q54 Thresholds adjustable without code change',
  'Q55 Analytics identify drowsiness patterns',
  'Q56 Clear feedback on alert causes',
  'Q57 Alert map updatable without disruption',
  'Q58 Emergency contacts changeable without update',
  'Q59 Works on different Android models',
  'Q60 Web accessible across browsers',
  'Q61 Adapts to indoor/outdoor lighting',
  'Q62 Easy to install from link',
  'Q63 IoT setup without technical expertise',
  'Q64 Data/settings restored after reinstall',
  'Q65 Overall effective tool for drowsiness',
  'Q66 Would recommend to others',
];

for (let q = 0; q < 66; q++) {
  const wm = perQCount[q] > 0 ? perQTotal[q] / perQCount[q] : 0;
  console.log(`${qHeaders[q]}: ${wm.toFixed(2)}`);
}

// Sub-characteristic breakdown
console.log('\n--- Sub-Characteristic Means ---');
const subGroups = {
  'Functional Completeness (Q1-Q6)': [0,5],
  'Functional Correctness (Q7-Q10)': [6,9],
  'Functional Appropriateness (Q11-Q13)': [10,12],
  'Time Behavior (Q14-Q17)': [13,16],
  'Resource Utilization (Q18-Q20)': [17,19],
  'Co-existence (Q21-Q22)': [20,21],
  'Interoperability (Q23-Q25)': [22,24],
  'Appropriateness Recognizability (Q26-Q27)': [25,26],
  'Learnability (Q28-Q30)': [27,29],
  'Operability (Q31-Q35)': [30,34],
  'User Interface Aesthetics (Q36-Q37)': [35,36],
  'Maturity (Q38-Q40)': [37,39],
  'Fault Tolerance (Q41-Q43)': [40,42],
  'Recoverability (Q44-Q46)': [43,45],
  'Confidentiality (Q47-Q48)': [46,47],
  'Integrity (Q49-Q50)': [48,49],
  'Authenticity (Q51-Q52)': [50,51],
  'Modularity (Q53-Q54)': [52,53],
  'Analysability (Q55-Q56)': [54,55],
  'Modifiability (Q57-Q58)': [56,57],
  'Adaptability (Q59-Q61)': [58,60],
  'Installability (Q62-Q63)': [61,62],
  'Replaceability (Q64)': [63,63],
};

for (const [sg, [s, e]] of Object.entries(subGroups)) {
  let sum = 0, cnt = 0;
  for (let q = s; q <= e; q++) {
    if (perQCount[q] > 0) { sum += perQTotal[q] / perQCount[q]; cnt++; }
  }
  const wm = cnt > 0 ? sum / cnt : 0;
  console.log(`${sg}: ${wm.toFixed(2)} (${interp(wm)})`);
}
