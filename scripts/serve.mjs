import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out"),
  base =
    "/" +
    (
      process.env.NEXT_PUBLIC_BASE_PATH ?? "letterboxd-profile-analyzer"
    ).replace(/^\/+|\/+$/g, ""),
  port = Number(process.env.PORT || 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      let url = decodeURIComponent(new URL(req.url, "http://local").pathname);
      if (url === "/" && base !== "/") {
        res.writeHead(302, { Location: base + "/" });
        res.end();
        return;
      }
      if (base !== "/" && url.startsWith(base + "/"))
        url = url.slice(base.length);
      let file = path.resolve(root, "." + url);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if ((await stat(file)).isDirectory())
        file = path.join(file, "index.html");
      const bytes = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(bytes);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Preview: http://127.0.0.1:${port}${base}/`),
  );
