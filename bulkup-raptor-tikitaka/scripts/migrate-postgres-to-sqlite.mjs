#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";

const [, , command, ...args] = process.argv;

const coreTables = [
  "permission_categories",
  "roles",
  "permissions",
  "role_permissions",
  "users",
  "playbook_spaces",
  "playbook_categories",
  "playbook_topics",
  "playbook_documents",
  "playbook_document_comments",
];

const tableColumns = {
  permission_categories: ["id", "code", "name", "description", "display_order", "created_at", "updated_at"],
  roles: ["id", "code", "name", "description", "system_role", "created_at", "updated_at"],
  permissions: ["id", "code", "name", "description", "category_id", "created_at", "updated_at"],
  role_permissions: ["role_id", "permission_id"],
  users: ["id", "email", "password_hash", "username", "role_id", "active", "created_at", "updated_at"],
  playbook_spaces: ["id", "code", "name", "created_at", "updated_at"],
  playbook_categories: ["id", "space_id", "title", "order_idx", "created_at", "updated_at"],
  playbook_topics: ["id", "category_id", "title", "order_idx", "created_at", "updated_at"],
  playbook_documents: [
    "id", "topic_id", "parent_id", "title", "content", "status", "use_for_chatbot", "order_idx", "version",
    "created_by", "share_token", "ai_edit_token_hash", "ai_edit_token_expires_at", "ai_edit_token_used_at",
    "approved_by", "approved_at", "created_at", "updated_at",
  ],
  playbook_document_comments: ["id", "document_id", "parent_id", "title", "content", "created_by", "created_at", "updated_at"],
};

function valueAfter(flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function psql(sql) {
  return execFileSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At", "-q", "-c", sql], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 1024,
  }).trim();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function exportPostgres(outputPath) {
  const tableRows = JSON.parse(psql("SELECT COALESCE(json_agg(tablename ORDER BY tablename), '[]') FROM pg_catalog.pg_tables WHERE schemaname = 'public'"));
  const columnRows = JSON.parse(psql("SELECT COALESCE(json_object_agg(table_name, columns), '{}') FROM (SELECT table_name, json_agg(json_build_object('name', column_name, 'dataType', data_type) ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema = 'public' GROUP BY table_name) t"));
  const tables = {};
  for (const table of tableRows) {
    const identifier = quoteIdentifier(table);
    const rows = psql(`SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM (SELECT * FROM public.${identifier} ORDER BY 1) t`);
    tables[table] = JSON.parse(rows || "[]");
  }
  const payload = {
    format: "pkt-study-postgres-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    postgres: { host: process.env.PGHOST ?? null, database: process.env.PGDATABASE ?? null },
    columns: columnRows,
    tables,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Exported ${Object.keys(tables).length} PostgreSQL tables to ${outputPath}`);
  for (const [table, rows] of Object.entries(tables)) console.log(`${table}: ${rows.length}`);
}

const schemaSql = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS permission_categories (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, display_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, system_role INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, category_id INTEGER REFERENCES permission_categories(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL REFERENCES roles(id), permission_id INTEGER NOT NULL REFERENCES permissions(id), PRIMARY KEY (role_id, permission_id));
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, username TEXT NOT NULL, role_id INTEGER NOT NULL REFERENCES roles(id), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playbook_spaces (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playbook_categories (id INTEGER PRIMARY KEY, space_id INTEGER NOT NULL REFERENCES playbook_spaces(id), title TEXT NOT NULL, order_idx INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playbook_topics (id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES playbook_categories(id), title TEXT NOT NULL, order_idx INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playbook_documents (id INTEGER PRIMARY KEY, topic_id INTEGER NOT NULL REFERENCES playbook_topics(id), parent_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'DRAFT', use_for_chatbot INTEGER NOT NULL DEFAULT 0, order_idx INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_by INTEGER, share_token TEXT UNIQUE, ai_edit_token_hash TEXT UNIQUE, ai_edit_token_expires_at TEXT, ai_edit_token_used_at TEXT, approved_by INTEGER, approved_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS playbook_document_comments (id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL REFERENCES playbook_documents(id), parent_id INTEGER, title TEXT, content TEXT NOT NULL, created_by INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

function sqliteType(dataType) {
  if (["boolean", "smallint", "integer", "bigint"].includes(dataType)) return "INTEGER";
  if (["numeric", "decimal", "real", "double precision"].includes(dataType)) return "REAL";
  return "TEXT";
}

function createGenericTables(sqlite, payload) {
  for (const table of Object.keys(payload.tables)) {
    if (coreTables.includes(table)) continue;
    const columns = payload.columns?.[table] ?? Object.keys(payload.tables[table][0] ?? {}).map((name) => ({ name, dataType: "text" }));
    if (!columns.length) continue;
    sqlite.exec(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table)} (${columns.map((column) => `${quoteIdentifier(column.name)} ${sqliteType(column.dataType)}`).join(", ")})`);
  }
}

function normalizeValue(table, column, value) {
  if (value === undefined) return null;
  if (typeof value === "boolean" || ["system_role", "active", "use_for_chatbot"].includes(column)) return value ? 1 : 0;
  if (typeof value === "object") return value === null ? null : JSON.stringify(value);
  return value;
}

function importSqlite(inputPath, targetPath) {
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (payload.format !== "pkt-study-postgres-export") throw new Error("Unsupported export format");
  if (fs.existsSync(targetPath) && !args.includes("--replace")) throw new Error(`Target exists; choose another path or pass --replace: ${targetPath}`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const sqlite = new Database(targetPath);
  sqlite.exec(schemaSql);
  createGenericTables(sqlite, payload);
  // Insert known foreign-key parents first; generic MES tables follow afterward.
  const migratedTables = [
    ...coreTables.filter((table) => Object.hasOwn(payload.tables, table)),
    ...Object.keys(payload.tables).filter((table) => !coreTables.includes(table)),
  ];
  const clear = [...migratedTables].reverse().map((table) => `DELETE FROM ${quoteIdentifier(table)}`).join(";");
  sqlite.exec(clear);
  const transaction = sqlite.transaction(() => {
    for (const table of migratedTables) {
      const rows = payload.tables[table] ?? [];
      const columns = tableColumns[table] ?? (payload.columns?.[table] ?? []).map((column) => column.name);
      if (!columns.length) continue;
      const placeholders = columns.map(() => "?").join(", ");
      const statement = sqlite.prepare(`INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${placeholders})`);
      for (const row of rows) {
        const values = columns.map((column) => normalizeValue(table, column, row[column]));
        try {
          statement.run(...values);
        } catch (error) {
          console.error(`Failed to import ${table}`, columns, values.map((value) => `${typeof value}:${String(value)}`));
          throw error;
        }
      }
    }
  });
  transaction();
  const counts = Object.fromEntries(migratedTables.map((table) => [table, sqlite.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count]));
  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_check").all();
  sqlite.close();
  if (foreignKeys.length) throw new Error(`Foreign key check failed: ${JSON.stringify(foreignKeys)}`);
  console.log(`Imported ${migratedTables.length} tables into ${targetPath}`);
  for (const [table, count] of Object.entries(counts)) console.log(`${table}: ${count}`);
  console.log("All exported PostgreSQL tables were imported into the verification database.");
}

function verify(inputPath, targetPath) {
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const sqlite = new Database(targetPath, { readonly: true });
  const mismatches = [];
  for (const table of Object.keys(payload.tables)) {
    const sourceCount = (payload.tables[table] ?? []).length;
    const targetCount = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count;
    if (sourceCount !== targetCount) mismatches.push(`${table}: source=${sourceCount}, target=${targetCount}`);
  }
  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_check").all();
  sqlite.close();
  if (mismatches.length || foreignKeys.length) {
    console.error([...mismatches, foreignKeys.length ? `foreign_key_check=${foreignKeys.length}` : ""].filter(Boolean).join("\n"));
    process.exitCode = 1;
    return;
  }
  console.log(`Migration verification passed for ${Object.keys(payload.tables).length} tables.`);
}

function mergePlaybook(inputPath, targetPath, backupPath) {
  const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  if (payload.format !== "pkt-study-postgres-export") throw new Error("Unsupported export format");
  if (fs.existsSync(targetPath)) fs.copyFileSync(targetPath, backupPath);
  const sqlite = new Database(targetPath);
  sqlite.exec(schemaSql);
  sqlite.exec("PRAGMA foreign_keys = OFF; DELETE FROM playbook_document_comments; DELETE FROM playbook_documents; DELETE FROM playbook_topics; DELETE FROM playbook_categories; DELETE FROM playbook_spaces; PRAGMA foreign_keys = ON;");
  const tables = ["playbook_spaces", "playbook_categories", "playbook_topics", "playbook_documents", "playbook_document_comments"];
  const transaction = sqlite.transaction(() => {
    for (const table of tables) {
      const rows = payload.tables[table] ?? [];
      const columns = tableColumns[table];
      const statement = sqlite.prepare(`INSERT INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
      for (const row of rows) statement.run(...columns.map((column) => normalizeValue(table, column, row[column])));
    }
  });
  transaction();
  const foreignKeys = sqlite.prepare("PRAGMA foreign_key_check").all();
  sqlite.close();
  if (foreignKeys.length) throw new Error(`Foreign key check failed: ${JSON.stringify(foreignKeys)}`);
  console.log(`Merged ${tables.length} playbook tables into ${targetPath}`);
  console.log(`Backup: ${backupPath}`);
}

if (command === "export") exportPostgres(valueAfter("--output", "./.data/postgres-export.json"));
else if (command === "import") importSqlite(valueAfter("--input", "./.data/postgres-export.json"), valueAfter("--target", "./.data/postgres-import-check.db"));
else if (command === "verify") verify(valueAfter("--input", "./.data/postgres-export.json"), valueAfter("--target", "./.data/postgres-import-check.db"));
else if (command === "merge-playbook") mergePlaybook(valueAfter("--input", "./.data/postgres-export.json"), valueAfter("--target", "./.data/pkt-study.db"), valueAfter("--backup", "./.data/pkt-study.before-playbook-import.db"));
else {
  console.error("Usage: node scripts/migrate-postgres-to-sqlite.mjs <export|import|verify|merge-playbook> [--input path] [--output path] [--target path] [--backup path] [--replace]");
  process.exitCode = 2;
}
