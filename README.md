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
