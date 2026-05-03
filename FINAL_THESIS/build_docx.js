// Generates output.docx from output.md using the docx npm package
// Run: node FINAL_THESIS/build_docx.js

const fs = require("fs");
const path = require("path");
// Resolve global docx when not locally installed
const docxPath = "C:/Users/Luis/AppData/Roaming/npm/node_modules/docx";
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  convertInchesToTwip,
} = require(docxPath);

const inputPath = path.join(__dirname, "output.md");
const outputPath = path.join(__dirname, "thesis_draft_v4.docx");

const md = fs.readFileSync(inputPath, "utf8");
const lines = md.split("\n");

// Helper: strip markdown inline formatting
function stripInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/~~(.*?)~~/g, "$1");
}

// Helper: build runs with bold/italic/code support
function buildRuns(text) {
  const runs = [];
  const re = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: text.slice(last, m.index) }));
    }
    const raw = m[0];
    if (raw.startsWith("**")) {
      runs.push(new TextRun({ text: raw.slice(2, -2), bold: true }));
    } else if (raw.startsWith("*")) {
      runs.push(new TextRun({ text: raw.slice(1, -1), italics: true }));
    } else if (raw.startsWith("`")) {
      runs.push(
        new TextRun({
          text: raw.slice(1, -1),
          font: "Courier New",
          size: 18,
          shading: { fill: "F0F0F0" },
        })
      );
    }
    last = m.index + raw.length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last) }));
  }
  return runs.length ? runs : [new TextRun({ text })];
}

function makeHeading(text, level) {
  const headingMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4,
  };
  return new Paragraph({
    text: stripInline(text),
    heading: headingMap[level] || HeadingLevel.HEADING_4,
    spacing: { before: 240, after: 120 },
  });
}

function makeBody(text, bold = false) {
  return new Paragraph({
    children: buildRuns(text),
    spacing: { after: 120 },
  });
}

function makeReference(text) {
  return new Paragraph({
    children: buildRuns(text),
    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
    spacing: { after: 240 },
  });
}

function makeCode(text) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: "Courier New",
        size: 16,
      }),
    ],
    spacing: { after: 60 },
    indent: { left: convertInchesToTwip(0.5) },
    shading: { fill: "F5F5F5" },
  });
}

function makeBullet(text) {
  return new Paragraph({
    children: buildRuns(stripInline(text)),
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

// Parse markdown table into docx Table
function parseTable(tableLines) {
  const rows = tableLines
    .filter((l) => l.trim().startsWith("|") && !l.trim().match(/^\|[-|: ]+\|$/))
    .map((l) =>
      l
        .trim()
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim())
    );

  if (!rows.length) return null;

  const colCount = rows[0].length;
  const colWidth = Math.floor(9000 / colCount);

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: rows.map((cells, ri) =>
      new TableRow({
        children: cells.map((cell) =>
          new TableCell({
            children: [
              new Paragraph({
                children: buildRuns(cell),
                spacing: { after: 60 },
              }),
            ],
            shading: ri === 0 ? { fill: "2C3E50" } : undefined,
            width: { size: colWidth, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
          })
        ),
      })
    ),
  });
}

function makeDiagramPlaceholder(raw) {
  // raw = "Figure N — Title | PROMPT: \"...\""
  const pipeIdx = raw.indexOf(' | PROMPT:');
  const figureLabel = pipeIdx > -1 ? raw.slice(0, pipeIdx).trim() : raw.trim();
  const promptText = pipeIdx > -1 ? raw.slice(pipeIdx + 10).trim().replace(/^"|"$/g, '') : '';

  return new Table({
    width: { size: 8700, type: WidthType.DXA },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: '[ DIAGRAM PLACEHOLDER ]', bold: true, size: 20, color: '555555', font: 'Times New Roman' })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text: figureLabel, bold: true, size: 22, color: '1A3A5C', font: 'Times New Roman' })],
                alignment: AlignmentType.CENTER,
                spacing: { after: 120 },
              }),
              ...(promptText ? [
                new Paragraph({
                  children: [new TextRun({ text: 'AI Image Generation Prompt:', bold: true, size: 18, color: '333333', font: 'Times New Roman' })],
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: promptText, italics: true, size: 18, color: '444444', font: 'Times New Roman' })],
                  spacing: { after: 80 },
                }),
              ] : []),
              new Paragraph({
                children: [new TextRun({ text: '(Replace this placeholder with the generated diagram image)', italics: true, size: 16, color: '888888', font: 'Times New Roman' })],
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
              }),
            ],
            shading: { fill: 'F0F4FF' },
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
          }),
        ],
      }),
    ],
    borders: {
      top:    { style: BorderStyle.DASHED, size: 4, color: '4472C4' },
      bottom: { style: BorderStyle.DASHED, size: 4, color: '4472C4' },
      left:   { style: BorderStyle.DASHED, size: 4, color: '4472C4' },
      right:  { style: BorderStyle.DASHED, size: 4, color: '4472C4' },
    },
  });
}

function makeIPODiagram() {
  const W = "FFFFFF";

  function hCell(text, fill) {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, bold: true, color: W, size: 24, font: "Times New Roman" })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 100 },
      })],
      shading: { fill },
      width: { size: 2900, type: WidthType.DXA },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
    });
  }

  function cCell(lines, bg) {
    const paragraphs = lines.map(line => {
      const isSection = /^[A-Z][A-Z\s\/\-–]+$/.test(line.trim()) && line.trim().length > 2 && !line.startsWith("•");
      const isArrow = line.startsWith("→");
      return new Paragraph({
        children: [new TextRun({
          text: line,
          bold: isSection,
          italics: isArrow,
          size: isSection ? 18 : 17,
          font: "Times New Roman",
        })],
        indent: line.startsWith("  ") ? { left: convertInchesToTwip(0.25) } : undefined,
        spacing: { after: line === "" ? 80 : 30 },
      });
    });
    return new TableCell({
      children: paragraphs,
      shading: { fill: bg },
      width: { size: 2900, type: WidthType.DXA },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
    });
  }

  const headerRow = new TableRow({
    children: [
      hCell("INPUT", "1A3A5C"),
      hCell("PROCESS", "145A32"),
      hCell("OUTPUT", "6B1A1A"),
    ],
  });

  const contentRow = new TableRow({
    children: [
      cCell([
        "FACIAL SIGNALS",
        "• jawOpen blend shape (≥ 0.70)",
        "  Yawn detection",
        "• Head pitch & roll angles",
        "  Nod / tilt detection",
        "• 478 landmarks, 52 blend shapes",
        "",
        "MOTION SIGNALS",
        "• Accelerometer delta (≥ 0.45g)",
        "  Sudden brake detection",
        "",
        "SYSTEM CONFIGURATION",
        "• Alert map thresholds (admin)",
        "• Emergency contact details",
        "",
        "NETWORK STATE",
        "• Online / Offline (NetInfo)",
        "",
        "AUTHENTICATION",
        "• Email / Password",
        "• Google OAuth",
      ], "D6EAF8"),
      cCell([
        "STAGE 1 — SIGNAL ACQUISITION",
        "• MediaPipe Face Landmarker",
        "• 478 landmarks + 52 blend shapes",
        "• Mobile: 600ms  |  Web: 130ms",
        "",
        "STAGE 2 — DROWSINESS SCORING",
        "• jawOpen ≥ 0.70 → yawn event",
        "• Pitch/roll threshold → nod event",
        "• 10s sustained tilt → tilt event",
        "• Accel. ≥ 0.45g → brake event",
        "• Accumulated into level 0–10",
        "",
        "STAGE 3 — ALERT ESCALATION",
        "• Levels 1–5: mild in-app alerts",
        "• Levels 6–8: IoT device triggers",
        "• Levels 9–10: EC notification",
        "  + 120s self-dismiss countdown",
        "",
        "STAGE 4 — DATA PERSISTENCE",
        "• SQLite offline-first storage",
        "→ Supabase cloud background sync",
        "",
        "STAGE 5 — IoT COMMUNICATION",
        "• MQTT over TLS (HiveMQ, 8883)",
        "• BLE fallback (SG-{device_id})",
      ], "D5F5E3"),
      cCell([
        "REAL-TIME DROWSINESS LEVEL",
        "• Score 0–10 rendered on",
        "  Drive screen continuously",
        "",
        "DRIVER ALERTS",
        "• In-app alert modal",
        "• Synthesized voice (MP3 audio)",
        "• IoT vibration & LED patterns",
        "  (calibrated per level 6–10)",
        "",
        "EMERGENCY NOTIFICATION",
        "• Expo push notification",
        "  (FCM / APNs)",
        "• PhilSMS via Supabase",
        "  Edge Function",
        "  (triggered at levels 9–10)",
        "",
        "SESSION ANALYTICS",
        "• Driving session logs",
        "• Drowsiness event timeline",
        "• Focus Score",
        "• Alert event heat map",
        "",
        "ISO/IEC 25010 EVALUATION",
        "• Grand Mean: 4.01",
        "• Very Satisfactory",
        "  (n = 29 respondents)",
      ], "FADBD8"),
    ],
  });

  const feedbackRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        children: [new Paragraph({
          children: [new TextRun({
            text: "FEEDBACK LOOP:  Driver dismisses alert (in-app button  |  IoT GPIO 25 button  |  120-second timeout)  →  Alert state resets  →  Monitoring resumes automatically",
            italics: true,
            bold: false,
            size: 18,
            font: "Times New Roman",
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
        })],
        shading: { fill: "EDE7F6" },
        margins: { top: 120, bottom: 120, left: 140, right: 140 },
      }),
    ],
  });

  const table = new Table({
    width: { size: 8700, type: WidthType.DXA },
    rows: [headerRow, contentRow, feedbackRow],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 4, color: "333333" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
      left:   { style: BorderStyle.SINGLE, size: 4, color: "333333" },
      right:  { style: BorderStyle.SINGLE, size: 4, color: "333333" },
      insideH:{ style: BorderStyle.SINGLE, size: 2, color: "888888" },
      insideV:{ style: BorderStyle.SINGLE, size: 2, color: "888888" },
    },
  });

  return [
    table,
    new Paragraph({
      children: [new TextRun({ text: "Figure 1. Input-Process-Output (IPO) Conceptual Framework of SnoozeGuard", italics: true, size: 22 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 240 },
    }),
  ];
}

// Main parse loop
const docChildren = [];

let i = 0;
let inReferences = false;
let inTable = false;
let tableBuffer = [];
let inCode = false;
let codeBuffer = [];

while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  // Skip HTML comments
  if (trimmed.startsWith("<!--")) {
    while (i < lines.length && !lines[i].includes("-->")) i++;
    i++;
    continue;
  }

  // Code block
  if (trimmed.startsWith("```")) {
    if (!inCode) {
      inCode = true;
      codeBuffer = [];
    } else {
      inCode = false;
      codeBuffer.forEach((cl) => docChildren.push(makeCode(cl)));
    }
    i++;
    continue;
  }
  if (inCode) {
    codeBuffer.push(line);
    i++;
    continue;
  }

  // Table detection
  if (trimmed.startsWith("|")) {
    tableBuffer.push(line);
    i++;
    continue;
  } else if (tableBuffer.length) {
    const tbl = parseTable(tableBuffer);
    if (tbl) {
      docChildren.push(tbl);
      docChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
    tableBuffer = [];
  }

  // Diagram placeholder markers: [DIAGRAM: Figure N — Title | PROMPT: "..."]
  if (trimmed.startsWith("[DIAGRAM:")) {
    const inner = trimmed.replace(/^\[DIAGRAM:\s*/, '').replace(/\]$/, '');
    docChildren.push(makeDiagramPlaceholder(inner));
    docChildren.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    i++;
    continue;
  }

  // Special figure markers
  if (trimmed === "[FIGURE:conceptual_framework]") {
    makeIPODiagram().forEach(el => docChildren.push(el));
    i++;
    continue;
  }

  // Headings
  const h1 = line.match(/^# (.+)/);
  const h2 = line.match(/^## (.+)/);
  const h3 = line.match(/^### (.+)/);
  const h4 = line.match(/^#### (.+)/);

  if (h1) {
    if (h1[1].trim() === "References") inReferences = true;
    else inReferences = false;
    docChildren.push(makeHeading(h1[1], 1));
  } else if (h2) {
    docChildren.push(makeHeading(h2[1], 2));
  } else if (h3) {
    docChildren.push(makeHeading(h3[1], 3));
  } else if (h4) {
    docChildren.push(makeHeading(h4[1], 4));
  }
  // Horizontal rule → page break
  else if (trimmed === "---") {
    docChildren.push(
      new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } })
    );
  }
  // Bullet list
  else if (trimmed.startsWith("- ")) {
    docChildren.push(makeBullet(trimmed.slice(2)));
  }
  // Numbered list
  else if (/^\d+\. /.test(trimmed)) {
    docChildren.push(makeBullet(trimmed.replace(/^\d+\. /, "")));
  }
  // Empty line
  else if (trimmed === "") {
    docChildren.push(new Paragraph({ text: "", spacing: { after: 60 } }));
  }
  // Normal paragraph / bold paragraph
  else {
    if (inReferences && trimmed !== "") {
      docChildren.push(makeReference(trimmed));
    } else {
      docChildren.push(makeBody(trimmed));
    }
  }

  i++;
}

// Flush trailing table
if (tableBuffer.length) {
  const tbl = parseTable(tableBuffer);
  if (tbl) docChildren.push(tbl);
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Times New Roman", size: 24 },
        paragraph: { spacing: { line: 480 } }, // double-spaced
      },
      heading1: {
        run: { font: "Times New Roman", size: 28, bold: true, color: "000000" },
        paragraph: { spacing: { before: 480, after: 240 }, alignment: AlignmentType.CENTER },
      },
      heading2: {
        run: { font: "Times New Roman", size: 26, bold: true, color: "000000" },
        paragraph: { spacing: { before: 360, after: 180 } },
      },
      heading3: {
        run: { font: "Times New Roman", size: 24, bold: true, color: "000000" },
        paragraph: { spacing: { before: 240, after: 120 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1.25),
            bottom: convertInchesToTwip(1.25),
            left: convertInchesToTwip(1.5),
            right: convertInchesToTwip(1.0),
          },
        },
      },
      children: docChildren,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync(outputPath, buffer);
  console.log("output.docx written to", outputPath);
});
