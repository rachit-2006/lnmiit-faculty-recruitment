// Relational Database Engine & SQL Processor Automated Test Suite
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, db } = require('./testHelper');

before(async () => {
  await db.init();
  await db.reset();
});

describe('Relational Backend Database & SQL Studio Test Suite', () => {

  it('should return database engine status with 18 relational tables (GET /api/db/status)', async () => {
    const res = await request({
      method: 'GET',
      url: '/api/db/status'
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ONLINE');
    assert.ok(res.data.engine.includes('Relational Database'));
    assert.ok(res.data.totalTables >= 18, 'Must maintain at least 18 relational tables');
    assert.ok(res.data.totalRows > 0, 'Database must contain populated relational rows');
    assert.ok(res.data.storageFile, 'Must point to active persistent database file on disk');
  });

  it('should return schema definitions for all relational tables (GET /api/db/tables)', async () => {
    const res = await request({
      method: 'GET',
      url: '/api/db/tables'
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data));

    const tableNames = res.data.map(t => t.table);
    const expectedTables = [
      'users', 'sessions', 'applicant_profiles', 'educations', 'experiences',
      'research_papers', 'vacancies', 'eligibility_criteria', 'applications',
      'documents', 'screening_records', 'interviews', 'interview_panel',
      'evaluations', 'hod_reviews', 'appointment_letters', 'notifications', 'audit_logs'
    ];

    for (const exp of expectedTables) {
      assert.ok(tableNames.includes(exp), `Expected table '${exp}' to exist in relational schema.`);
    }
  });

  it('should browse relational table records (GET /api/db/tables/:table)', async () => {
    const res = await request({
      method: 'GET',
      url: '/api/db/tables/users?limit=10'
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.table, 'users');
    assert.ok(Array.isArray(res.data.rows));
    assert.ok(res.data.rows.length > 0);

    const firstUser = res.data.rows[0];
    assert.ok(firstUser.user_id);
    assert.ok(firstUser.name);
    assert.ok(firstUser.email);
    assert.ok(firstUser.role);
  });

  it('should execute SQL queries via query processor (POST /api/db/query)', async () => {
    const res = await request({
      method: 'POST',
      url: '/api/db/query',
      body: {
        query: "SELECT user_id, name, email, role FROM users WHERE role = 'HOD'"
      }
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.rows));
    assert.ok(res.data.rows.length > 0);
    assert.equal(res.data.rows[0].role, 'HOD');
    assert.ok(res.data.executionTimeMs >= 0);
  });

  it('should export complete SQL database dump matching PostgreSQL / SQLite standards (GET /api/db/export/sql)', async () => {
    const res = await request({
      method: 'GET',
      url: '/api/db/export/sql'
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.includes('CREATE TABLE IF NOT EXISTS users'));
    assert.ok(res.body.includes('CREATE TABLE IF NOT EXISTS applications'));
    assert.ok(res.body.includes('INSERT INTO users'));
  });
});
