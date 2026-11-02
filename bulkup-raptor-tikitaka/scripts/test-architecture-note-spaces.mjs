import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Database from "better-sqlite3";
import ts from "typescript";

function load(path) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { organizeArchitectureNoteSpaces } = await load("../src/server/db/architecture-note-spaces.ts");
const { playbookModules, playbookModuleLabelForDomain } = await load("../src/features/hospital-playbook/modules.ts");

test("legacy backend notes move with category, topic and document IDs intact", t => {
  const db = new Database(":memory:");
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE playbook_spaces (id INTEGER PRIMARY KEY, code TEXT, name TEXT, updated_at TEXT);
    CREATE TABLE playbook_categories (id INTEGER PRIMARY KEY, space_id INTEGER, title TEXT, order_idx INTEGER, updated_at TEXT);
    CREATE TABLE playbook_topics (id INTEGER PRIMARY KEY, category_id INTEGER, title TEXT);
    CREATE TABLE playbook_documents (id INTEGER PRIMARY KEY, topic_id INTEGER, parent_id INTEGER, content TEXT, version INTEGER);
    INSERT INTO playbook_spaces VALUES (1, 'SYSTEM', '시스템 구성', ''), (2, 'DOMAIN', '도메인 설계', ''), (3, 'APP_STRUCTURE', '백엔드·프론트 구조', '');
    INSERT INTO playbook_categories VALUES (10, 1, '기획 문서', 0, ''), (11, 1, '백엔드 아키텍쳐', 1, ''), (12, 3, '마이 바티스 기본기', 0, ''), (13, 3, '리액트 구성', 1, '');
    INSERT INTO playbook_topics VALUES (20, 11, 'light ddd'), (21, 12, '페이지 조회');
    INSERT INTO playbook_documents VALUES (30, 20, NULL, 'unchanged content', 4), (31, 20, 30, 'child', 2), (32, 21, NULL, 'query', 1);
  `);
  const documents = db.prepare("SELECT * FROM playbook_documents ORDER BY id").all();
  const topics = db.prepare("SELECT * FROM playbook_topics ORDER BY id").all();
  organizeArchitectureNoteSpaces(db);
  assert.deepEqual(db.prepare("SELECT * FROM playbook_documents ORDER BY id").all(), documents);
  assert.deepEqual(db.prepare("SELECT * FROM playbook_topics ORDER BY id").all(), topics);
  assert.deepEqual(db.prepare("SELECT id, space_id FROM playbook_categories ORDER BY id").all(), [
    { id: 10, space_id: 1 }, { id: 11, space_id: 2 }, { id: 12, space_id: 2 }, { id: 13, space_id: 3 },
  ]);
  assert.equal(db.prepare("SELECT name FROM playbook_spaces WHERE id=2").get().name, "백엔드 구조");
  assert.equal(db.prepare("SELECT name FROM playbook_spaces WHERE id=3").get().name, "프론트엔드 구조");

  // Once migrated, later imports must respect the user's subsequent menu placement.
  db.prepare("UPDATE playbook_categories SET space_id=1 WHERE id=11").run();
  organizeArchitectureNoteSpaces(db);
  assert.equal(db.prepare("SELECT space_id FROM playbook_categories WHERE id=11").get().space_id, 1);
});

test("new menus retain space codes and old menu links open the backend notes", () => {
  assert.equal(playbookModules["시스템 구성"].domain, "SYSTEM");
  assert.equal(playbookModules["백엔드 구조"].domain, "DOMAIN");
  assert.equal(playbookModules["프론트엔드 구조"].domain, "APP_STRUCTURE");
  assert.equal(playbookModules["API 규칙"].domain, "API_RULES");
  assert.equal(playbookModules["도메인 설계"].title, "백엔드 구조");
  assert.equal(playbookModules["백엔드·프론트 구조"].title, "백엔드 구조");
  assert.equal(playbookModuleLabelForDomain("DOMAIN"), "백엔드 구조");
  assert.equal(playbookModuleLabelForDomain("APP_STRUCTURE"), "프론트엔드 구조");
});
