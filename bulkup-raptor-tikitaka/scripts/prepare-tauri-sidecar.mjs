import { chmodSync, cpSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");

export function prepareTauriSidecar() {
  const binariesDir = path.join(projectRoot, "src-tauri", "binaries");
  // `tauri dev` validates bundle resource paths even though the dev server
  // does not use the packaged Next standalone server. Keep this outside `.next`
  // because Next dev clears `.next` during startup.
  mkdirSync(path.join(projectRoot, "dist", "next"), { recursive: true });
  const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], {
    encoding: "utf8",
  }).trim();
  const executableSuffix = process.platform === "win32" ? ".exe" : "";
  const sidecarPath = path.join(
    binariesDir,
    `node-${targetTriple}${executableSuffix}`,
  );

  mkdirSync(binariesDir, { recursive: true });
  cpSync(process.execPath, sidecarPath);
  if (process.platform !== "win32") chmodSync(sidecarPath, 0o755);

  console.log(`Prepared Node sidecar for ${targetTriple}.`);
  return sidecarPath;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  prepareTauriSidecar();
}
