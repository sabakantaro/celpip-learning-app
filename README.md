# English Memory Builder (React + Vite PWA)

Spaced multiple-choice review app for:
- Words
- Phrasal Verbs

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy on Vercel

1. Push this folder to GitHub.
2. Import repo on Vercel.
3. Framework preset: `Vite`.
4. Deploy.

## Learning behavior

- All items start at `box 1` (due now).
- Correct answer: move to next box, review later.
- Wrong answer: reset to box 1.
- Due queue naturally gets smaller as items are remembered.
- `Reset All Progress` brings everything back.

## Data

Edit:
- `src/data/learning-content.json`

Or regenerate from your Markdown sources:

```bash
node scripts/generate-learning-data.mjs
```

Source files used:
- `data-source/Words30169f6e439080ca996ff0f0e5fb0367.md`
- `data-source/PhrasalVerbs30169f6e4390807a8fade4b166c4517d.md`

Schema:

```json
{
  "id": "w-001",
  "type": "word",
  "category": "Words",
  "term": "Resilient",
  "meaning": "Able to recover quickly",
  "example": "She remained resilient after failure."
}
```

## PDF source files

Current source PDFs are in:
- `data-source/ec9603bf-7c07-4c5f-9b24-fd884805aac8_Words.pdf`
- `data-source/c1cbd6d7-d8cb-4a89-b9ee-fd7b19e6bc18_Phrasal_Verbs.pdf`

A direct parser is not included yet in this environment because PDF extraction tools are unavailable.
