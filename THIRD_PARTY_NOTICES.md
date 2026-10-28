# Credits and third-party notices

Original project created and maintained by **Melvin Varghese**, https://melvinvarghese.in. The supplied changes preserve that credit and do not change the original project's ownership. No standalone project license file was present in the audited upstream repository; this package does not invent a new license for the owner's original code.

## Dependencies

Runtime stack: Next.js (MIT), React/React DOM (MIT), fflate (MIT), lucide-react (ISC). Build/development: TypeScript (Apache-2.0), Tailwind CSS (MIT), PostCSS (MIT), Autoprefixer (MIT), Playwright (Apache-2.0), axe-core integration (MPL-2.0), and their transitive dependencies. Exact versions are pinned by `package-lock.json`. Required available license/notice texts are reproduced in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md). Dependency bundles retain their license comments.

The old Recharts runtime was removed in favor of original accessible HTML/CSS charts. No competitor source code or design assets were copied.

## TMDB

This product uses the TMDB API but is not endorsed or certified by TMDB.

- Approved TMDB logo: https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg
- Branding source: https://www.themoviedb.org/about/logos-attribution
- API terms: https://www.themoviedb.org/api-terms-of-use

`public/tmdb.svg` is the unmodified approved asset downloaded from the official source. It is included for attribution, not represented as an independently relicensed icon. Optional film posters/data are fetched by the visitor from TMDB after consent; no movie poster collection is bundled in these archives. TMDB terms and underlying rights apply. Commercial use may require a separate license.

## Letterboxd

Independent of Letterboxd; no official Letterboxd API, passwords or session cookies are used. No Letterboxd logo or proprietary branding artwork is bundled. The product reads the visitor's own account export. Test fixtures are entirely synthetic.

## Original artwork

The Frame by Frame cover composition and film-card fallback designs are built in CSS with Lucide icons. They contain no copied film poster artwork. System fonts are used; there is no remote font service or bundled font-license dependency.
