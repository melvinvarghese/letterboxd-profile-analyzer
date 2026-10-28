import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
const root = path.resolve("out"),
  base = (
    process.env.NEXT_PUBLIC_BASE_PATH ?? "letterboxd-profile-analyzer"
  ).replace(/^\/+|\/+$/g, "");
if (!existsSync(path.join(root, "index.html")))
  throw new Error(
    "Static build is missing out/index.html. Rebuild before deployment.",
  );
const html = readFileSync(path.join(root, "index.html"), "utf8");
let checked = 0;
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const ref = m[1];
  if (!ref.startsWith("/") || ref.startsWith("//")) continue;
  let relative = ref.split("?")[0];
  if (base && relative.startsWith("/" + base + "/"))
    relative = relative.slice(base.length + 1);
  const target = path.join(root, relative);
  if (!existsSync(target)) throw new Error("Missing static asset: " + ref);
  checked++;
}
for (const f of [".nojekyll", "404.html", "tmdb.svg"])
  if (!existsSync(path.join(root, f)))
    throw new Error("Missing deployment file: " + f);
console.log(
  `Static paths verified: index.html, ${checked} referenced assets, .nojekyll, 404.html and TMDB logo.`,
);
