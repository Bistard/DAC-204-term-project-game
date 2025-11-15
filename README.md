# DAC-204-term-project-game

A minimal TypeScript + HTML + CSS scaffold that compiles to static assets and ships with a pre-wired GitHub Pages workflow.

## Quick start

```bash
npm install
npm run dev     # rebuild TypeScript on file save
npm run build   # emit static assets into dist/
npm run preview # serve the dist/ folder on http://localhost:4173
```

`npm run build` performs the following steps:

1. run `scripts/clean-dist.cjs` to remove any previous build output
2. use `tsc` to compile `src/main.ts` into native ES modules inside `dist/`
3. copy everything from `public/` (HTML + CSS) into `dist/` so the folder is deployable as-is

After running the build you can open `dist/index.html` directly in a browser or run `npm run preview` for a lightweight local web server.

## GitHub Pages deployment

1. Push changes to `main` (or adjust the branch in `.github/workflows/main.yml`).
2. In GitHub > Settings > Pages, select GitHub Actions as the source the first time.
3. The workflow installs dependencies, runs `npm run build`, uploads `dist/` as an artifact, and publishes it through `actions/deploy-pages`.

The build status and published URL are available from the Actions tab or the Pages settings screen.

## Project layout

```
public/            static HTML/CSS copied to dist/
src/               TypeScript entry point (main.ts)
scripts/           helper scripts used by npm run build
dist/              generated output (gitignored)
package.json       tooling + npm scripts
.github/workflows/ GitHub Pages deployment pipeline
```

Extend the home page by editing `public/index.html`, iterate on styling in `public/styles.css`, and add new game logic inside `src/main.ts` while keeping the stack completely front-end.
