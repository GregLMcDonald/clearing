// Zero-dependency static server for local testing: npm run serve [-- --port=8077]
// (Service workers need http://localhost, not file://.)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = parseInt((process.argv.find((a) => a.startsWith("--port=")) || "--port=8077").split("=")[1], 10);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml", ".png": "image/png", ".mp3": "audio/mpeg", ".bin": "application/octet-stream",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT) || /[\\/]\.(?!well-known)/.test(path.relative(ROOT, file))) throw Object.assign(new Error(), { code: "ENOENT" });
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch (_) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}`));
