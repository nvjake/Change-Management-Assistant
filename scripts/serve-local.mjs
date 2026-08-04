import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, request as requestHttp } from "node:http";
import path from "node:path";
import { startProdServer } from "../node_modules/vinext/dist/server/prod-server.js";

const host = "127.0.0.1";
const publicPort = Number.parseInt(process.env.PORT || "3000", 10);
const appPort = publicPort + 1;
const projectRoot = process.cwd();
const clientRoot = path.resolve(projectRoot, "dist", "client");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

await startProdServer({
  port: appPort,
  host,
  outDir: path.resolve(projectRoot, "dist"),
});

async function staticFileFor(urlValue) {
  const pathname = decodeURIComponent(new URL(urlValue, `http://${host}`).pathname);
  const relative = pathname.replace(/^\/+/, "").replaceAll("/", path.sep);
  const candidate = path.resolve(clientRoot, relative);
  if (!candidate.startsWith(clientRoot + path.sep)) return null;
  try {
    const info = await stat(candidate);
    return info.isFile() ? { candidate, info } : null;
  } catch {
    return null;
  }
}

const server = createServer(async (incoming, outgoing) => {
  const staticFile = await staticFileFor(incoming.url || "/");
  if (staticFile) {
    const extension = path.extname(staticFile.candidate).toLowerCase();
    outgoing.writeHead(200, {
      "Content-Type": contentTypes.get(extension) || "application/octet-stream",
      "Content-Length": String(staticFile.info.size),
      "Cache-Control": extension === ".js" || extension === ".css"
        ? "public, max-age=31536000, immutable"
        : "no-store",
    });
    if (incoming.method === "HEAD") outgoing.end();
    else createReadStream(staticFile.candidate).pipe(outgoing);
    return;
  }

  const upstream = requestHttp({
    hostname: host,
    port: appPort,
    path: incoming.url,
    method: incoming.method,
    headers: incoming.headers,
  }, (response) => {
    outgoing.writeHead(response.statusCode || 502, response.headers);
    response.pipe(outgoing);
  });
  upstream.on("error", (error) => {
    outgoing.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    outgoing.end(`Local prototype unavailable: ${error.message}`);
  });
  incoming.pipe(upstream);
});

server.listen(publicPort, host, () => {
  console.log(`Chewy Change Activation Assistant running at http://${host}:${publicPort}`);
});
