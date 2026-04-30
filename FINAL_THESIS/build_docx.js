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
const outputPath = path.join(__dirname, "thesis_draft.docx");

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

// Main parse loop
const docChildren = [];

let i = 0;
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

  // Headings
  const h1 = line.match(/^# (.+)/);
  const h2 = line.match(/^## (.+)/);
  const h3 = line.match(/^### (.+)/);
  const h4 = line.match(/^#### (.+)/);

  if (h1) {
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
    docChildren.push(makeBody(trimmed));
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
