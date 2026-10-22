import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { prepareTauriSidecar } from "./prepare-tauri-sidecar.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const nextDistDir = path.join(projectRoot, process.env.PKT_NEXT_DIST_DIR || ".next");
const standaloneDir = path.join(nextDistDir, "standalone");
const staticDir = path.join(nextDistDir, "static");
const publicDir = path.join(projectRoot, "public");
const distDir = path.join(projectRoot, "dist");
const loadingIllustration = path.join(projectRoot, "src-tauri", "assets", "next-loading.png");

function readSeedSummary(database, label) {
  const summary = database
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM playbook_spaces) AS spaces,
        (SELECT COUNT(*) FROM playbook_categories) AS categories,
        (SELECT COUNT(*) FROM playbook_topics) AS topics,
        (SELECT COUNT(*) FROM playbook_documents) AS documents,
        (SELECT COUNT(*) FROM playbook_documents WHERE TRIM(content) <> '') AS documentsWithContent`,
    )
    .get();

  if (
    summary.spaces === 0 ||
    summary.categories === 0 ||
    summary.topics === 0 ||
    summary.documents === 0 ||
    summary.documentsWithContent === 0
  ) {
    throw new Error(
      `${label} is missing playbook data: ${JSON.stringify(summary)}`,
    );
  }

  return summary;
}

if (!existsSync(path.join(standaloneDir, "server.js"))) {
  throw new Error("Next standalone server is missing. Run `next build` first.");
}

// Next standalone does not copy browser assets itself. The tracked local SQLite
// database is the required seed for the installed app. On each release-version
// change, Tauri synchronizes this seed into the user database after backing it up.
rmSync(path.join(standaloneDir, ".data"), { recursive: true, force: true });
const localDatabasePath = path.join(projectRoot, ".data", "pkt-study.db");
if (!existsSync(localDatabasePath)) {
  throw new Error(
    `Required packaged SQLite seed is missing: ${localDatabasePath}`,
  );
}
const localDatabase = new Database(localDatabasePath);
const localSeedSummary = readSeedSummary(localDatabase, "Local SQLite seed");
localDatabase.pragma("wal_checkpoint(TRUNCATE)");
localDatabase.close();

const packagedDatabasePath = path.join(standaloneDir, ".data", "pkt-study.db");
mkdirSync(path.join(standaloneDir, ".data"), { recursive: true });
cpSync(localDatabasePath, packagedDatabasePath);
const packagedDatabase = new Database(packagedDatabasePath, { readonly: true });
const packagedSeedSummary = readSeedSummary(
  packagedDatabase,
  "Packaged SQLite seed",
);
packagedDatabase.close();

if (JSON.stringify(localSeedSummary) !== JSON.stringify(packagedSeedSummary)) {
  throw new Error(
    `Packaged SQLite seed summary differs from local seed: ${JSON.stringify({ localSeedSummary, packagedSeedSummary })}`,
  );
}
console.log(
  `Packaged local SQLite seed: ${localDatabasePath} ${JSON.stringify(packagedSeedSummary)}`,
);
rmSync(path.join(standaloneDir, ".next", "static"), { recursive: true, force: true });
cpSync(staticDir, path.join(standaloneDir, ".next", "static"), { recursive: true });
if (existsSync(publicDir)) {
  rmSync(path.join(standaloneDir, "public"), { recursive: true, force: true });
  cpSync(publicDir, path.join(standaloneDir, "public"), { recursive: true });
}

// Next traces native packages through a symlink under `.next/node_modules`.
// Tauri's resource copy does not preserve that traced symlink, so materialize
// the better-sqlite3 package at every traced package name before packaging.
const sqlitePackageDir = path.join(standaloneDir, "node_modules", "better-sqlite3");
const tracedNodeModulesDir = path.join(standaloneDir, ".next", "node_modules");
if (existsSync(sqlitePackageDir) && existsSync(tracedNodeModulesDir)) {
  for (const packageName of readdirSync(tracedNodeModulesDir)) {
    if (!packageName.startsWith("better-sqlite3-")) continue;
    const tracedPackageDir = path.join(tracedNodeModulesDir, packageName);
    rmSync(tracedPackageDir, { recursive: true, force: true });
    cpSync(sqlitePackageDir, tracedPackageDir, { recursive: true, dereference: true });
  }
}

// Tauri displays this local page while the bundled Next server starts.
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
if (existsSync(loadingIllustration)) {
  cpSync(loadingIllustration, path.join(distDir, "loading.png"));
}
writeFileSync(
  path.join(distDir, "index.html"),
  `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Bulkup Raptor</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:radial-gradient(circle at 50% 42%,#183c68 0,#0a1830 42%,#050914 100%);color:#e6f4ff;font:600 15px system-ui,sans-serif}.shell{text-align:center}.illustration{display:block;width:min(52vw,420px);height:auto;margin:0 auto 18px;border-radius:28px;box-shadow:0 18px 60px #02081799}.spinner{width:22px;height:22px;margin:0 auto 12px;border:3px solid #5b7898;border-top-color:#38bdf8;border-radius:50%;animation:s .8s linear infinite}.status{color:#b8d8ef}@keyframes s{to{transform:rotate(360deg)}}</style><body><main class="shell"><img class="illustration" src="/loading.png" alt="Bulkup Raptor 시작 중"><div class="spinner"></div><div class="status">Bulkup Raptor를 시작하는 중입니다.</div></main></body></html>`,
);

// Keep the packaged server outside `.next`, which is cleared by `next dev`.
cpSync(standaloneDir, path.join(distDir, "next"), { recursive: true });

// Bundle the exact Node runtime used for this native target as a Tauri sidecar.
prepareTauriSidecar();
console.log("Prepared Next standalone server and Node sidecar.");
