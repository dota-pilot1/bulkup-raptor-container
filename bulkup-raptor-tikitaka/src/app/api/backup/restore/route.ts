import fs from "node:fs";
import Database from "better-sqlite3";
import { NextResponse } from "next/server";
import { dataDirectory, pendingRestorePath } from "@/server/database";
import { requireAdmin } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ message: "관리자 로그인이 필요합니다." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "SQLite 백업 파일을 선택해 주세요." }, { status: 400 });

  const tempPath = `${pendingRestorePath}.uploading`;
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(tempPath, Buffer.from(await file.arrayBuffer()));
  try {
    const probe = new Database(tempPath, { readonly: true });
    const hasUsers = probe.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    const hasSpaces = probe.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'playbook_spaces'").get();
    probe.close();
    if (!hasUsers || !hasSpaces) throw new Error("Bulkup Raptor 백업 파일이 아닙니다.");
    fs.renameSync(tempPath, pendingRestorePath);
    return NextResponse.json({ message: "복구 파일을 확인했습니다. 앱을 재시작하면 적용됩니다." });
  } catch (error) {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    return NextResponse.json({ message: error instanceof Error ? error.message : "백업 파일을 읽을 수 없습니다." }, { status: 400 });
  }
}
