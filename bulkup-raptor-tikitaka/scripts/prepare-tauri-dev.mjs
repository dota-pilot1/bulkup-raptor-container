import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextResource = path.join(root, "dist", "next");

// Tauri validates configured resources even for `tauri dev`. The standalone
// build leaves symlinks into .next, which Next dev removes on startup. Keep a
// small, valid resource directory for dev; release preparation recreates it.
fs.mkdirSync(nextResource, { recursive: true });
fs.rmSync(path.join(nextResource, ".next"), { recursive: true, force: true });
