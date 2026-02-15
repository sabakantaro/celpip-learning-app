import fs from "node:fs";
import path from "node:path";

const root = "/Users/ryosukeyano/Projects/english-memory-pwa";
const wordsPath = path.join(root, "data-source", "Words30169f6e439080ca996ff0f0e5fb0367.md");
const phrasalPath = path.join(root, "data-source", "PhrasalVerbs30169f6e4390807a8fade4b166c4517d.md");
const outPath = path.join(root, "src", "data", "learning-content.json");

const wordsRaw = fs.readFileSync(wordsPath, "utf8");
const phrasalRaw = fs.readFileSync(phrasalPath, "utf8");

function cleanInline(text) {
  return text
    .replace(/^[-*]\s*/, "")
    .replace(/^\((adj|verb|noun|adverb|prep|conj)\)\s*/i, "")
    .replace(/^Example:\s*/i, "")
    .replace(/\*+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWords(markdown) {
  const blocks = markdown.split(/\n(?=##\s+\d+\.\s+)/g);
  const items = [];

  for (const block of blocks) {
    const headingMatch = block.match(/^##\s+(\d+)\.\s+(.+)$/m);
    if (!headingMatch) continue;

    const index = Number(headingMatch[1]);
    const term = headingMatch[2].trim();

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);

    const definitionCandidates = [];
    const exampleCandidates = [];

    for (const line of lines) {
      if (line.startsWith("- ")) {
        if (/^-\s*Example:/i.test(line)) {
          exampleCandidates.push(cleanInline(line));
        } else {
          definitionCandidates.push(cleanInline(line));
        }
      }
    }

    const meaning = definitionCandidates.join("; ") || "Definition not provided.";
    const example = exampleCandidates[0] || `Example sentence for ${term}.`;

    items.push({
      id: `w-${String(index).padStart(3, "0")}`,
      type: "word",
      category: "Words",
      term,
      meaning,
      example,
    });
  }

  return items;
}

function parsePhrasal(markdown) {
  const blocks = markdown.split(/\n(?=###\s+\d+\.\s+)/g);
  const items = [];

  for (const block of blocks) {
    const headingMatch = block.match(/^###\s+(\d+)\.\s+(.+)$/m);
    if (!headingMatch) continue;

    const index = Number(headingMatch[1]);
    const term = headingMatch[2].trim();

    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.startsWith("### "));

    const meaningLine = lines.find((line) => !line.startsWith("*"));
    const exampleLine = lines.find((line) => line.startsWith("*"));

    const meaning = cleanInline(meaningLine || "Definition not provided.");
    const example = cleanInline(exampleLine || `Example sentence for ${term}.`);

    items.push({
      id: `pv-${String(index).padStart(3, "0")}`,
      type: "phrasal_verb",
      category: "Phrasal Verbs",
      term,
      meaning,
      example,
    });
  }

  return items;
}

const wordsItems = parseWords(wordsRaw);
const phrasalItems = parsePhrasal(phrasalRaw);
const allItems = [...wordsItems, ...phrasalItems];

const output = {
  generatedAt: new Date().toISOString(),
  counts: {
    words: wordsItems.length,
    phrasalVerbs: phrasalItems.length,
    total: allItems.length,
  },
  items: allItems,
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

console.log(`Generated ${outPath}`);
console.log(output.counts);
