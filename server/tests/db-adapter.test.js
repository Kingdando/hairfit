const test = require('node:test');
const assert = require('node:assert/strict');

if (!process.env.SUPABASE_DB_URL) {
  process.env.SUPABASE_DB_URL = 'postgresql://test:test@localhost:5432/test';
}

const { postgresResult } = require('../src/db');

test('maps PostgreSQL inserts to MySQL-compatible insert metadata', () => {
  const [result] = postgresResult({
    command: 'INSERT',
    rows: [{ id: '42' }],
    rowCount: 1,
  });

  assert.deepEqual(result, { affectedRows: 1, insertId: 42 });
});

test('preserves query rows and affected-row metadata for other statements', () => {
  const rows = [{ id: 42 }];
  assert.equal(postgresResult({ command: 'SELECT', rows, rowCount: 1 })[0], rows);
  assert.deepEqual(postgresResult({ command: 'UPDATE', rows: [], rowCount: 0 })[0], {
    affectedRows: 0,
    insertId: undefined,
  });
});
