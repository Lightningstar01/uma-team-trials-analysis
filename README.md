# Uma Team Trials Score Auditor

A free, browser-only tool for **Uma Musume: Pretty Derby** (Global) Team Trials. Upload your "Score Info" screenshots, and it reads them with client-side OCR (Tesseract.js), stores only the scores in your browser (IndexedDB), tracks each roster uma's average, and flags the weakest link to upgrade next. Nothing is uploaded to a server.

**Use it:** https://lightningstar01.github.io/uma-team-trials-analysis/

Your data lives only in the browser you use it in, so a phone and a computer each keep their own history. Use **Export backup** and **Import backup** to move it between devices.

## Development

```sh
npm install
npm run dev     # local dev server
npm test        # unit tests (Vitest)
npm run lint
npm run build
```

Project context lives in [CLAUDE.md](CLAUDE.md); game mechanics, roadmap, and decisions are in [docs/](docs/).
