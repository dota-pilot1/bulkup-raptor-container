import type Database from "better-sqlite3";

/** 기존 문서와 카테고리 ID를 유지하며 아키텍처 노트의 범위를 한 번 정리한다. */
export function organizeArchitectureNoteSpaces(sqlite: Database.Database) {
  sqlite.transaction(() => {
    const spaces = sqlite.prepare(
      "SELECT id, code, name FROM playbook_spaces WHERE code IN ('SYSTEM', 'DOMAIN', 'APP_STRUCTURE')",
    ).all() as { id: number; code: string; name: string }[];
    const backend = spaces.find((space) => space.code === "DOMAIN");
    const frontend = spaces.find((space) => space.code === "APP_STRUCTURE");
    if (!backend || !frontend) return;

    // HMR·재시작 시 사용자가 나중에 배치한 문서를 다시 이동하지 않는다.
    const migrate = backend.name === "도메인 설계" || frontend.name === "백엔드·프론트 구조";
    if (!migrate) return;

    const now = new Date().toISOString();
    const system = spaces.find((space) => space.code === "SYSTEM");
    const categories = sqlite.prepare(
      "SELECT id, space_id, title FROM playbook_categories ORDER BY order_idx, id",
    ).all() as { id: number; space_id: number; title: string }[];
    const nextOrder = sqlite.prepare(
      "SELECT COALESCE(MAX(order_idx), -1) + 1 AS value FROM playbook_categories WHERE space_id = ?",
    ).get(backend.id) as { value: number };
    const move = sqlite.prepare(
      "UPDATE playbook_categories SET space_id = ?, order_idx = ?, updated_at = ? WHERE id = ?",
    );
    for (const category of categories) {
      const systemBackend = category.space_id === system?.id && /^백엔드/.test(category.title);
      const legacyBackend = category.space_id === frontend.id && /마이\s*바티스|MyBatis|백엔드/i.test(category.title);
      if (systemBackend || legacyBackend) {
        move.run(backend.id, nextOrder.value++, now, category.id);
      }
    }
    const rename = sqlite.prepare("UPDATE playbook_spaces SET name = ?, updated_at = ? WHERE id = ?");
    rename.run("백엔드 구조", now, backend.id);
    rename.run("프론트엔드 구조", now, frontend.id);
  })();
}
