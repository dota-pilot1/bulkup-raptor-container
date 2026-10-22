import "server-only";

import type Database from "better-sqlite3";

export function applyMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS proof_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS lots (id INTEGER PRIMARY KEY AUTOINCREMENT, lot_code TEXT NOT NULL, process TEXT NOT NULL, product_code TEXT NOT NULL, product_name TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS learning_goals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), group_name TEXT NOT NULL, task TEXT NOT NULL, skill TEXT NOT NULL, progress INTEGER NOT NULL DEFAULT 0, completed INTEGER NOT NULL DEFAULT 0, order_idx INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS work_todos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), space_code TEXT NOT NULL DEFAULT 'COMMON', category_id INTEGER, category_title TEXT, topic_id INTEGER, topic_title TEXT, document_id INTEGER, document_title TEXT, workstream TEXT NOT NULL DEFAULT 'BACKEND', title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'TODO', important INTEGER NOT NULL DEFAULT 0, checklist_json TEXT NOT NULL DEFAULT '[]', acceptance_criteria TEXT NOT NULL DEFAULT '', verification_checks_json TEXT NOT NULL DEFAULT '[]', blocker_reason TEXT NOT NULL DEFAULT '', related_files_json TEXT NOT NULL DEFAULT '[]', related_api_request_ids_json TEXT NOT NULL DEFAULT '[]', verification_summary TEXT NOT NULL DEFAULT '', order_idx INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, updated_by_type TEXT NOT NULL DEFAULT 'USER', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT);
    CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, system_role INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, username TEXT NOT NULL, role_id INTEGER NOT NULL REFERENCES roles(id), active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS permissions (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, category_id INTEGER REFERENCES permission_categories(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS permission_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, display_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS role_permissions (role_id INTEGER NOT NULL REFERENCES roles(id), permission_id INTEGER NOT NULL REFERENCES permissions(id), PRIMARY KEY (role_id, permission_id));
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS playbook_spaces (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS playbook_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, space_id INTEGER NOT NULL REFERENCES playbook_spaces(id), title TEXT NOT NULL, order_idx INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS playbook_topics (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL REFERENCES playbook_categories(id), title TEXT NOT NULL, order_idx INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS playbook_documents (id INTEGER PRIMARY KEY AUTOINCREMENT, topic_id INTEGER NOT NULL REFERENCES playbook_topics(id), parent_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL DEFAULT '{"root":{"children":[]}}', status TEXT NOT NULL DEFAULT 'DRAFT', use_for_chatbot INTEGER NOT NULL DEFAULT 0, order_idx INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_by INTEGER, approved_by INTEGER, approved_at TEXT, share_token TEXT UNIQUE, ai_edit_token_hash TEXT UNIQUE, ai_edit_token_expires_at TEXT, ai_edit_token_used_at TEXT, sample_key TEXT UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS playbook_sample_tombstones (sample_key TEXT PRIMARY KEY, deleted_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS playbook_document_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL REFERENCES playbook_documents(id), parent_id INTEGER, title TEXT, content TEXT NOT NULL, created_by INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);

  for (const statement of [
    "ALTER TABLE permissions ADD COLUMN category_id INTEGER REFERENCES permission_categories(id)",
    "ALTER TABLE playbook_documents ADD COLUMN share_token TEXT",
    "ALTER TABLE playbook_documents ADD COLUMN ai_edit_token_hash TEXT",
    "ALTER TABLE playbook_documents ADD COLUMN ai_edit_token_expires_at TEXT",
    "ALTER TABLE playbook_documents ADD COLUMN ai_edit_token_used_at TEXT",
    "ALTER TABLE playbook_documents ADD COLUMN sample_key TEXT",
    "ALTER TABLE learning_goals ADD COLUMN progress INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE work_todos ADD COLUMN verification_checks_json TEXT NOT NULL DEFAULT '[]'",
    "ALTER TABLE work_todos ADD COLUMN api_specs_json TEXT NOT NULL DEFAULT '[]'",
  ]) {
    try {
      sqlite.exec(statement);
    } catch (error) {
      if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) throw error;
    }
  }
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_documents_share_token ON playbook_documents(share_token)");
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_documents_ai_edit_token_hash ON playbook_documents(ai_edit_token_hash)");
  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_playbook_documents_sample_key ON playbook_documents(sample_key)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_learning_goals_user_order ON learning_goals(user_id, order_idx, id)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_work_todos_user_scope ON work_todos(user_id, topic_id, workstream, status, order_idx, id)");
}
