import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

if (process.platform !== "darwin") {
  process.exit(0);
}

const identity = process.env.APPLE_SIGNING_IDENTITY;
if (!identity) {
  if (process.env.CI) {
    throw new Error("APPLE_SIGNING_IDENTITY is required for macOS release signing");
  }
  console.warn("Skipping native macOS signing: APPLE_SIGNING_IDENTITY is not set");
  process.exit(0);
}

const root = join(process.cwd(), "dist", "next");
const nativeFiles = [];

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }

    if (entry.name.endsWith(".node") || entry.name.endsWith(".dylib")) {
      nativeFiles.push(path);
    }
  }
}

if (statSync(root, { throwIfNoEntry: false })) {
  walk(root);
}

for (const path of nativeFiles.sort((a, b) => b.length - a.length)) {
  execFileSync("codesign", [
    "--force",
    "--options",
    "runtime",
    "--timestamp",
    "--sign",
    identity,
    path,
  ], { stdio: "inherit" });
}

console.log(`Signed ${nativeFiles.length} native macOS resource(s)`);
