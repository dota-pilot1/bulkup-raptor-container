// Run after npm run build:tauri. Uses an isolated temporary DB, never the user's DB.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const root = path.resolve(import.meta.dirname, '..');
const serverDirectory = path.join(root, 'dist/next');
assert(existsSync(path.join(serverDirectory, 'server.js')), 'Run npm run build:tauri first.');
const dataDirectory = mkdtempSync(path.join(tmpdir(), 'pkt-goal-crud-'));
const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const port = portProbe.address().port;
await new Promise(resolve => portProbe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const email = 'goals-qa@example.test';
const password = randomUUID();
const server = spawn(process.execPath, ['server.js'], {
  cwd: serverDirectory,
  env: { ...process.env, PORT: String(port), HOSTNAME: '127.0.0.1', PKT_STUDY_DESKTOP: '1', PKT_STUDY_DATA_DIR: dataDirectory, PKT_STUDY_BOOTSTRAP_EMAIL: email, PKT_STUDY_BOOTSTRAP_PASSWORD: password },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', chunk => { logs += chunk; });
server.stderr.on('data', chunk => { logs += chunk; });
const request = (url, method = 'GET', body, cookie) => fetch(`${origin}${url}`, {
  method,
  headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const login = async (loginEmail) => {
  const response = await request('/api/auth/login', 'POST', { email: loginEmail, password });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  assert(cookie);
  return cookie;
};

try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await request('/api/health')).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, `Server startup failed: ${logs}`);
  assert.equal((await request('/api/learning-goals')).status, 401);
  const cookie = await login(email);
  const list = async () => { const response = await request('/api/learning-goals', 'GET', undefined, cookie); assert.equal(response.status, 200); return response.json(); };
  assert.deepEqual(await list(), [], 'GET must not create default plans.');
  const input = { groupName: 'CRUD 검증', task: '테스트 계획', skill: '조회·생성·수정·삭제', progress: 100 };
  assert.equal((await request('/api/learning-goals', 'POST', { ...input, task: '  ' }, cookie)).status, 400);
  const created = await request('/api/learning-goals', 'POST', input, cookie);
  assert.equal(created.status, 201);
  const goal = await created.json();
  assert.equal(goal.completed, true, 'Creating a 100% goal must mark it completed.');
  assert.equal((await list()).length, 1);
  const updatedInput = { ...input, task: '수정된 계획', groupName: '수정된 분류', progress: 35 };
  const updatedResponse = await request(`/api/learning-goals/${goal.id}`, 'PATCH', updatedInput, cookie);
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json();
  assert.equal(updated.task, updatedInput.task);
  assert.equal(updated.groupName, updatedInput.groupName);
  assert.equal(updated.progress, 35);
  assert.equal(updated.completed, false);
  assert.equal((await list())[0].task, updatedInput.task);

  // Create a second test user only in this isolated fixture to verify ownership.
  const database = new Database(path.join(dataDirectory, 'pkt-study.db'));
  const role = database.prepare('SELECT role_id FROM users WHERE email=?').get(email);
  const now = new Date().toISOString();
  database.prepare('INSERT INTO users(email,password_hash,username,role_id,active,created_at,updated_at) VALUES(?,?,?,?,1,?,?)')
    .run('goals-other@example.test', bcrypt.hashSync(password, 10), 'QA other', role.role_id, now, now);
  database.close();
  const otherCookie = await login('goals-other@example.test');
  assert.deepEqual(await (await request('/api/learning-goals', 'GET', undefined, otherCookie)).json(), []);
  assert.equal((await request(`/api/learning-goals/${goal.id}`, 'PATCH', input, otherCookie)).status, 404);
  assert.equal((await request(`/api/learning-goals/${goal.id}`, 'DELETE', undefined, otherCookie)).status, 404);
  assert.equal((await request(`/api/learning-goals/${goal.id}`, 'DELETE', undefined, cookie)).status, 204);
  assert.deepEqual(await list(), []);
  assert.deepEqual(await list(), [], 'Deleting the last plan must leave the list empty after another GET.');
  assert.equal((await request(`/api/learning-goals/${goal.id}`, 'DELETE', undefined, cookie)).status, 404);
  for (const task of ['일괄 삭제 A', '일괄 삭제 B']) assert.equal((await request('/api/learning-goals', 'POST', { ...input, task }, cookie)).status, 201);
  assert.equal((await request('/api/learning-goals', 'DELETE', undefined, cookie)).status, 204);
  assert.deepEqual(await list(), [], 'Deleting all plans must not recreate a sample.');
  console.log('PASS: auth, validation, CRUD persistence, completion state, ownership, and empty-list preservation.');
  console.log(`Test database: ${dataDirectory}`);
} finally {
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    const timeout = setTimeout(() => server.kill('SIGKILL'), 3000);
    await exited;
    clearTimeout(timeout);
  }
}
