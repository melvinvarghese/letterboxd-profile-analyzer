# Deploy to the existing GitHub Pages address

Target: **https://melvinvarghese.github.io/letterboxd-profile-analyzer/**

## Recommended: source ZIP + GitHub Actions

1. Extract `Letterboxd-Profile-Analyzer-2.0.zip`.
2. Upload the **contents** to the root of the existing repository, including the `.github` folder. `package.json` and `README.md` must be visible at the repository root. Do not upload the ZIP itself or a parent folder.
3. Commit to `main`.
4. In **Settings → Pages**, choose **GitHub Actions** as the source.
5. In **Actions**, check the deployment workflow. It runs `npm ci`, the 2.0 test list, the type check, the static build, Chromium browser checks, and Pages artifact upload/deploy. The workflow supplies the actual repository name as the build base path.
6. Open the site after the green deployment. A hard refresh may be useful if your browser still shows the old version.

No secret, environment file or API key is needed to deploy or use the core analyzer. Optional TMDB credentials are entered by each visitor in the app.

GitHub's web uploader overwrites matching files but does not delete obsolete files. The 2.0 package explicitly lists the tests it runs, so the old `tests/theme-contract.test.mjs` and `tests/ui-contract.test.mjs` cannot break the new workflow if they remain. They can be deleted through GitHub later. Old Next.js source/spec files are not deployed unless imported by the new application. No repository-wide wipe or history rewrite is needed.

## Alternative: ready-built deployment ZIP

`Letterboxd-Profile-Analyzer-2.0-GitHub-Pages.zip` contains `index.html`, `_next/`, `tmdb.svg`, `404.html`, `.nojekyll`, notices and deployment instructions at its root. It is already built for `/letterboxd-profile-analyzer/`.

Use this when you want to host static files without an automated build:

1. Extract the deployment ZIP.
2. Create a dedicated **gh-pages** branch in the existing repository (or use another empty deployment branch).
3. Upload its extracted contents to that branch's root, including `.nojekyll` and `_next/`. Commit them.
4. In **Settings → Pages**, choose **Deploy from a branch → gh-pages → /(root)**.
5. Disable the existing automatic Pages deployment workflow if you adopt this method. Do not leave two deployment methods competing for the same site.

The complete source remains in the other ZIP. The deployment ZIP is not a replacement for maintainable source, test fixtures or the lockfile.

## Local build / preview

Node 22 LTS and npm:

```bash
npm ci
npm test
npm run lint
npm run build:pages
npm run preview
```

Preview at `http://127.0.0.1:4173/letterboxd-profile-analyzer/`. Production files are in `out/`; all browser work, including the import worker, is static. No localhost dependency is present in the production bundle. Navigation uses local view state rather than server routes, so refreshing the repository URL works.

To host at a different repository path, set `NEXT_PUBLIC_BASE_PATH` to its name **before building**. `npm run build:pages` defaults to `letterboxd-profile-analyzer` for convenience. For a root-domain build, use `NEXT_PUBLIC_BASE_PATH=` with `npm run build:pages`. These are hosting paths, never credential variables.

## Browser and network requirements

A current browser with Web Workers, native dialogs and IndexedDB is expected. Core processing needs no outside requests after the static assets load. This is not an installed offline/PWA cache: you must load the site normally. Metadata needs internet access to `api.themoviedb.org`; optional poster images use `image.tmdb.org`. If TMDB is blocked or unavailable, all core import/analytics features still work.
