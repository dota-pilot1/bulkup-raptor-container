import type Database from "better-sqlite3";

/** ORM 학습 공간을 보장하고 기존 JPA 기본 노트의 ID와 본문을 유지해 이동한다. */
export function ensureOrmNoteSpace(sqlite: Database.Database) {
  sqlite.transaction(() => {
    const now = new Date().toISOString();
    sqlite.prepare(
      "INSERT OR IGNORE INTO playbook_spaces (code, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
    ).run("ORM_DATA_ACCESS", "ORM·데이터 접근", now, now);
    const target = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?")
      .get("ORM_DATA_ACCESS") as { id: number };
    const source = sqlite.prepare("SELECT id FROM playbook_spaces WHERE code = ?")
      .get("DOMAIN") as { id: number } | undefined;
    if (!source) return;

    const destinationCategory = sqlite.prepare(
      "SELECT id FROM playbook_categories WHERE space_id = ? AND title = ?",
    ).get(target.id, "JPA 기본");
    if (destinationCategory) return;

    const count = sqlite.prepare(
      "SELECT COUNT(*) AS count FROM playbook_categories WHERE space_id = ?",
    ).get(target.id) as { count: number };
    sqlite.prepare(
      "UPDATE playbook_categories SET space_id = ?, order_idx = ?, updated_at = ? WHERE space_id = ? AND title = ?",
    ).run(target.id, count.count, now, source.id, "JPA 기본");
  })();
}
