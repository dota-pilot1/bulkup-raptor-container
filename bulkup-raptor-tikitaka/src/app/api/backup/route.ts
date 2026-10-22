import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { checkpointDatabase, databasePath, dataDirectory } from "@/server/database";

export const runtime = "nodejs";

export async function GET() {
  checkpointDatabase();
  const now = new Date();
  const stamp = now.toISOString()
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "_")
    .replace(/:/g, "-");
  const backupDirectory = path.join(dataDirectory, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `pkt-study-sqlite-backup-${stamp}.db`);
  fs.copyFileSync(databasePath, backupPath);
  const file = fs.readFileSync(backupPath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="${path.basename(backupPath)}"`,
      "Cache-Control": "no-store",
    },
  });
}
