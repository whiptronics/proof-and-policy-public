/// <reference types="vitest/config" />
// Local research dashboard. The data under public/data/ is written by `alcohol-data dashboard export`.
//
// Two development-only routes let the owner open files already held on this machine. They are never
// part of `vite build` output:
//   /local-raw/<asset_id>  the cached source file, only for assets the export marks servable
//                          (redistributable public-domain, government-edict or open-licence files)
//   /release/<file>        a file of the locally packaged release in ../dist/<release_version>/
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { basename, join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const repo = resolve(import.meta.dirname, "..");
const dataHome = resolve(process.env.ALCOHOL_DATA_HOME ?? repo);
const dataDir = resolve(import.meta.dirname, "public", "data");

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".zip": "application/zip",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".duckdb": "application/octet-stream",
  ".sha256": "text/plain; charset=utf-8",
};

function send(res: ServerResponse, file: string, asDownload: boolean) {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  res.setHeader("Content-Type", TYPES[ext] ?? "application/octet-stream");
  res.setHeader("Content-Length", String(statSync(file).size));
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (asDownload) res.setHeader("Content-Disposition", `attachment; filename="${basename(file)}"`);
  // A cached web page must not run its scripts inside this app's origin.
  if (ext === ".htm" || ext === ".html") res.setHeader("Content-Security-Policy", "sandbox");
  createReadStream(file).pipe(res);
}

function notFound(res: ServerResponse, why: string) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(why);
}

function localFiles(): Connect.NextHandleFunction {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const raw = /^\/local-raw\/([a-z0-9_]+)$/.exec(url.pathname);
    const rel = /^\/release\/([A-Za-z0-9_.-]+)$/.exec(url.pathname);
    if (!raw && !rel) return next();
    let sources: {
      assets: { asset_id: string; local_copy_servable: boolean; local_filename: string | null }[];
      release: { version: string; files: { name: string }[] } | null;
    };
    try {
      sources = JSON.parse(readFileSync(join(dataDir, "sources.json"), "utf-8"));
    } catch {
      return notFound(res, "Run `alcohol-data dashboard export` first.");
    }
    if (raw) {
      const a = sources.assets.find((x) => x.asset_id === raw[1]);
      if (!a || !a.local_copy_servable || !a.local_filename) {
        return notFound(res, "Not served: this asset is not held locally or is not cleared for redistribution.");
      }
      const file = join(dataHome, "data", "raw", a.asset_id, a.local_filename);
      return existsSync(file) ? send(res, file, false) : notFound(res, "Local copy missing.");
    }
    const release = sources.release;
    const name = rel![1];
    if (!release || !release.files.some((f) => f.name === name)) return notFound(res, "No such release file.");
    const file = join(dataHome, "dist", release.version, name);
    return existsSync(file) ? send(res, file, true) : notFound(res, "Release file missing.");
  };
}

const localFilesPlugin: Plugin = {
  name: "local-source-files",
  configureServer(server) {
    server.middlewares.use(localFiles());
  },
  configurePreviewServer(server) {
    server.middlewares.use(localFiles());
  },
};

export default defineConfig({
  base: "./",
  plugins: [react(), localFilesPlugin],
  server: { port: 5317, strictPort: true, host: "127.0.0.1" },
  preview: { port: 5318, strictPort: true, host: "127.0.0.1" },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
