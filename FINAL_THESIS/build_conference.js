// Builds conference_paper.docx from conference_paper.md
// Run: node FINAL_THESIS/build_conference.js

const fs = require("fs");
const path = require("path");
const docxPath = "C:/Users/Luis/AppData/Roaming/npm/node_modules/docx";
const {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType,
  convertInchesToTwip, PageOrientation,
} = require(docxPath);

const inputPath = path.join(__dirname, "conference_paper.md");
const outputPath = path.join(__dirname, "SnoozeGuard_Conference_Paper.docx");

const md = fs.readFileSync(inputPath, "utf8");
const lines = md.split("\n");

// ─── Inline formatter ────────────────────────────────────────────────────────
function buildRuns(text) {
  const runs = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(\d+)\])/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), size: 22 }));
    if (m[2]) runs.push(new TextRun({ text: m[2], bold: true, italics: true, size: 22 }));
    else if (m[3]) runs.push(new TextRun({ text: m[3], bold: true, size: 22 }));
    else if (m[4]) runs.push(new TextRun({ text: m[4], italics: true, size: 22 }));
    else if (m[5]) runs.push(new TextRun({ text: m[5], font: "Courier New", size: 20 }));
    else if (m[6]) runs.push(new TextRun({ text: m[0], size: 22 })); // citation [n]
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), size: 22 }));
  return runs;
}

function stripInline(text) {
  return text.replace(/\*\*\*(.+?)\*\*\*/g, "$1").replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1");
}

// ─── Paragraph helpers ───────────────────────────────────────────────────────
function titlePara(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, font: "Times New Roman" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 160 },
  });
}

function authorPara(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Times New Roman" })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  });
}

function sectionHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, font: "Times New Roman" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 280, after: 120 },
  });
}

function subHeading(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, italics: true, size: 22, font: "Times New Roman" })],
    spacing: { before: 160, after: 80 },
  });
}

function bodyPara(text) {
  return new Paragraph({
    children: buildRuns(text),
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: convertInchesToTwip(0.25) },
    spacing: { after: 80, line: 276 },
  });
}

function bulletPara(text) {
  return new Paragraph({
    children: buildRuns(text),
    bullet: { level: 0 },
    spacing: { after: 60, line: 276 },
  });
}

function abstractBlock(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "Abstract—", bold: true, italics: true, size: 22, font: "Times New Roman" }),
      new TextRun({ text, italics: true, size: 22, font: "Times New Roman" }),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 276 },
  });
}

function keywordsPara(text) {
  return new Paragraph({
    children: [
      new TextRun({ text: "Index Terms—", bold: true, italics: true, size: 22, font: "Times New Roman" }),
      new TextRun({ text, italics: true, size: 22, font: "Times New Roman" }),
    ],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 200, line: 276 },
  });
}

function figureCaptionPara(text) {
  return new Paragraph({
    children: [new TextRun({ text, italics: true, size: 20, font: "Times New Roman" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 160 },
  });
}

function tableCaptionPara(text) {
  return new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, font: "Times New Roman" })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 160, after: 60 },
  });
}

function referencePara(text) {
  return new Paragraph({
    children: buildRuns(text),
    indent: { left: convertInchesToTwip(0.4), hanging: convertInchesToTwip(0.4) },
    spacing: { after: 100, line: 276 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

function hrLine() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" } },
    spacing: { before: 120, after: 120 },
    text: "",
  });
}

// ─── Table parser ─────────────────────────────────────────────────────────────
function parseTable(tableLines) {
  const rows = tableLines.filter(l => l.trim().startsWith("|") && !/^\|[-:| ]+\|$/.test(l.trim()));
  if (rows.length < 1) return null;
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: rows.map((row, ri) => {
      const cells = row.split("|").slice(1, -1).map(c => c.trim());
      const isHeader = ri === 0;
      return new TableRow({
        children: cells.map(cell => new TableCell({
          children: [new Paragraph({
            children: [new TextRun({
              text: stripInline(cell), bold: isHeader, size: 20,
              font: "Times New Roman",
            })],
            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { after: 40 },
          })],
          shading: isHeader ? { fill: "D9E1F2" } : undefined,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
        }))
      });
    }),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideH: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
      insideV: { style: BorderStyle.SINGLE, size: 1, color: "AAAAAA" },
    },
  });
}

// ─── Parse ────────────────────────────────────────────────────────────────────
const docChildren = [];
let i = 0;
let mode = "body"; // title | authors | abstract | keywords | section | sub | figure_caption | table_caption | references | ack
let tableBuffer = [];
let inReferences = false;

while (i < lines.length) {
  const line = lines[i];
  const trimmed = line.trim();

  // Flush table
  if (!trimmed.startsWith("|") && tableBuffer.length) {
    const tbl = parseTable(tableBuffer);
    if (tbl) {
      docChildren.push(tbl);
      docChildren.push(new Paragraph({ text: "", spacing: { after: 80 } }));
    }
    tableBuffer = [];
  }

  // Table row
  if (trimmed.startsWith("|")) {
    tableBuffer.push(line);
    i++; continue;
  }

  // Mode markers
  if (trimmed === "[CONFERENCE_TITLE]") { mode = "title"; i++; continue; }
  if (trimmed === "[AUTHORS]") { mode = "authors"; i++; continue; }
  if (trimmed === "[ABSTRACT]") { mode = "abstract"; i++; continue; }
  if (trimmed === "[KEYWORDS]") { mode = "keywords"; i++; continue; }
  if (trimmed === "[ACKNOWLEDGMENT]") {
    docChildren.push(sectionHeading("Acknowledgment"));
    mode = "body"; i++; continue;
  }
  if (trimmed === "[REFERENCES]") {
    docChildren.push(sectionHeading("References"));
    inReferences = true; mode = "references"; i++; continue;
  }
  if (trimmed.match(/^\[SECTION_[IVX]+\]$/)) { mode = "section"; i++; continue; }
  if (trimmed.match(/^\[TABLE_[IVX]+\]$/)) {
    // Next non-empty line is the table caption
    i++;
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i < lines.length) {
      docChildren.push(tableCaptionPara(lines[i].trim()));
      i++;
    }
    continue;
  }
  if (trimmed === "[FIGURE_CAPTION]") { mode = "figure_caption"; i++; continue; }

  // Horizontal rule
  if (trimmed === "---") {
    docChildren.push(hrLine());
    i++; continue;
  }

  // Empty line
  if (trimmed === "") {
    if (mode !== "abstract" && mode !== "keywords")
      docChildren.push(new Paragraph({ text: "", spacing: { after: 40 } }));
    i++; continue;
  }

  // Render by mode
  if (mode === "title") {
    docChildren.push(titlePara(trimmed));
    mode = "body";
  } else if (mode === "authors") {
    docChildren.push(authorPara(trimmed));
  } else if (mode === "abstract") {
    docChildren.push(abstractBlock(trimmed));
    mode = "body";
  } else if (mode === "keywords") {
    docChildren.push(keywordsPara(trimmed));
    mode = "body";
  } else if (mode === "section") {
    // Section heading like "I. INTRODUCTION"
    docChildren.push(sectionHeading(trimmed));
    mode = "body";
  } else if (mode === "figure_caption") {
    docChildren.push(figureCaptionPara(trimmed));
    mode = "body";
  } else if (mode === "references") {
    // Reference entries: [1] Author...
    if (/^\[\d+\]/.test(trimmed)) {
      docChildren.push(referencePara(trimmed));
    }
  } else {
    // Sub-heading: "A. Title" or "B. Title"
    if (/^[A-Z]\.\s/.test(trimmed)) {
      docChildren.push(subHeading(trimmed));
    }
    // Bullet
    else if (trimmed.startsWith("- ")) {
      docChildren.push(bulletPara(trimmed.slice(2)));
    }
    // Normal body
    else {
      docChildren.push(bodyPara(trimmed));
    }
  }

  i++;
}

// Flush trailing table
if (tableBuffer.length) {
  const tbl = parseTable(tableBuffer);
  if (tbl) docChildren.push(tbl);
}

// ─── Build document ───────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Times New Roman", size: 22 },
        paragraph: { spacing: { line: 276 } },
      },
    },
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(1),
          bottom: convertInchesToTwip(1),
          left: convertInchesToTwip(1.25),
          right: convertInchesToTwip(1.25),
        },
      },
    },
    children: docChildren,
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outputPath, buf);
  console.log("Conference paper written to", outputPath);
});
