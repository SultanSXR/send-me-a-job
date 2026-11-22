// Renders a tailored CV and cover letter as .docx from a spec JSON (A4 or US Letter).
// Usage: node make_docs.js spec.json outDir
//    or: const { render } = require("./make_docs.js"); await render(spec, outDir)
// spec = {
//   name, email, phone, location, linkedin,
//   cv: { headline, profile, skills:[..], experience:[{title,company,dates,location,bullets:[..]}],
//         education:[{degree,school,dates}], certifications:[..], educationFirst: true|false },
//   letter: { date, recipient:[lines], company, role, salutation, paragraphs:[..], signoff },
//   fileBase: "Jane_Doe_Company_Role",
//   paper: "A4" | "Letter"   (optional, default A4; use Letter for the US, Canada and Mexico)
// }
const fs = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, BorderStyle,
        TabStopType } = require("docx");

const FONT = "Calibri", ACCENT = "1D4D4F";
const PAPERS = { A4: { width: 11906, height: 16838 }, Letter: { width: 12240, height: 15840 } };
const MARGIN = { top: 1000, bottom: 1000, left: 1100, right: 1100 };
const paperOf = spec => { const k = String(spec.paper || "A4").toLowerCase() === "letter" ? "Letter" : "A4"; return PAPERS[k]; };

const styles = {
  default: { document: { run: { font: FONT, size: 21 }, paragraph: { spacing: { after: 60, line: 264 } } } },
};
const numbering = { config: [{ reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•",
  alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] };

function build(spec) {
  const RIGHT = paperOf(spec).width - MARGIN.left - MARGIN.right;
  const contact = [spec.email, spec.phone, spec.linkedin, spec.location].filter(Boolean).join("  |  ");

  function section(title) {
    return new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 2 } },
      children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: ACCENT, characterSpacing: 20 })] });
  }
  function bullet(t) { return new Paragraph({ numbering: { reference: "b", level: 0 }, spacing: { after: 30 }, children: [new TextRun(t)] }); }
  function lineLR(left, right, opts = {}) {
    return new Paragraph({ keepNext: true, spacing: { before: opts.before ?? 120, after: 20 },
      tabStops: [{ type: TabStopType.RIGHT, position: RIGHT }],
      children: [new TextRun({ text: left, bold: true }), new TextRun({ text: "\t" + (right || ""), color: "555555" })] });
  }

  const cv = spec.cv;
  const cvChildren = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: spec.name, bold: true, size: 36, color: ACCENT })] }),
    cv.headline ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: cv.headline, size: 22 })] }) : null,
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: contact, size: 19, color: "555555" })] }),
    section("Profile"),
    new Paragraph({ children: [new TextRun(cv.profile)] }),
  ];
  if (cv.skills?.length) {
    cvChildren.push(section("Key skills"));
    cvChildren.push(new Paragraph({ children: [new TextRun(cv.skills.join("  •  "))] }));
  }
  const addExp = () => {
  cvChildren.push(section("Experience"));
  cv.experience.forEach((e, i) => {
    cvChildren.push(lineLR(`${e.title}, ${e.company}`, e.dates, { before: i ? 140 : 40 }));
    if (e.location) cvChildren.push(new Paragraph({ keepNext: true, spacing: { after: 40 }, children: [new TextRun({ text: e.location, italics: true, color: "555555", size: 19 })] }));
    (e.bullets || []).forEach(b => cvChildren.push(bullet(b)));
  });
  };
  const addEdu = () => {
  cvChildren.push(section("Education"));
  cv.education.forEach((e, i) => {
    cvChildren.push(lineLR(e.degree, e.dates, { before: i ? 80 : 40 }));
    cvChildren.push(new Paragraph({ children: [new TextRun({ text: e.school, color: "555555" })] }));
  });
  };
  if (cv.educationFirst) { addEdu(); addExp(); } else { addExp(); addEdu(); }
  if (cv.certifications?.length) {
    cvChildren.push(section("Certifications"));
    cv.certifications.forEach(c => cvChildren.push(bullet(c)));
  }

  const L = spec.letter;
  const p = (t, o = {}) => new Paragraph({ spacing: { after: o.after ?? 160 }, children: [new TextRun({ text: t, ...o.run })] });
  const letterChildren = [
    new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: spec.name, bold: true, size: 28, color: ACCENT })] }),
    new Paragraph({ spacing: { after: 240 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 4 } },
      children: [new TextRun({ text: contact, size: 19, color: "555555" })] }),
    p(L.date),
    ...(L.recipient || []).map((r, i, a) => p(r, { after: i === a.length - 1 ? 200 : 0 })),
    p(`Re: ${L.role}`, { run: { bold: true } }),
    p(L.salutation || "Dear Hiring Manager,"),
    ...L.paragraphs.map(t => new Paragraph({ spacing: { after: 160 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun(t)] })),
    p(L.signoff || "Yours sincerely,", { after: 480 }),
    p(spec.name, { run: { bold: true } }),
  ];

  return { cvChildren, letterChildren };
}

const mk = (spec, children) => new Document({ creator: spec.name, styles, numbering,
  sections: [{ properties: { page: { size: paperOf(spec), margin: MARGIN } }, children: children.filter(Boolean) }] });

async function render(spec, outDir = ".") {
  const { cvChildren, letterChildren } = build(spec);
  fs.mkdirSync(outDir, { recursive: true });
  const base = String(spec.fileBase || "CV").replace(/[^A-Za-z0-9_]/g, "_");
  const a = path.join(outDir, `${base}_CV.docx`), b = path.join(outDir, `${base}_Cover_Letter.docx`);
  fs.writeFileSync(a, await Packer.toBuffer(mk(spec, cvChildren)));
  fs.writeFileSync(b, await Packer.toBuffer(mk(spec, letterChildren)));
  return { cv: a, letter: b };
}

module.exports = { render };

if (require.main === module) {
  const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  render(spec, process.argv[3] || ".").then(r => { console.log(r.cv); console.log(r.letter); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
