# GitHub Pages deployment

This repository deploys a static Next.js export to GitHub Pages using GitHub Actions.

## One-time setup

1. Push the repository contents to the `main` branch.
2. In repository Settings → Pages, set Build and deployment source to **GitHub Actions**.
3. Push a commit or manually run the `Deploy Letterboxd Profile Analyzer to GitHub Pages` workflow.
4. Open the URL shown by the successful `deploy` job.

The workflow builds with `NEXT_PUBLIC_BASE_PATH` set to the repository name. Do not add API secrets to this variable or any `NEXT_PUBLIC_*` variable; these are exposed to the browser.

## Static hosting limits

GitHub Pages cannot run Next.js server components that require a server runtime, API routes, Python, a database, or secret-bearing proxy requests. Keep the core data processing client-side. Any future external metadata integration must either use a provider-approved browser-compatible credential approach or a separate backend service that protects secrets.

## Local commands

```bash
npm install
npm test
npm run build
```

The static output is written to `out/`.


## User-provided TMDB key

The import dialog includes an optional password-style field for a user's own TMDB v3 API key. If supplied, the browser searches up to 100 imported film titles directly against TMDB. The key is not stored in local storage or sent to an app backend, but it is present in the browser and in the TMDB request URL. This is appropriate only when the user knowingly chooses to provide their own key; do not put a project owner's secret key into the static site. Core analytics still work with the field blank.
