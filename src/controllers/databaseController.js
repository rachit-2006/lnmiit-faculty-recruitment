// Database Controller for Database Studio & SQL Console
const relationalDb = require('../db/relationalDb');
const fs = require('fs');

/**
 * Get Database Status, Storage Info & Table Row Counts
 */
async function getStatus(req, res, next) {
  try {
    const status = relationalDb.getDatabaseStatus();
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}

/**
 * Get List of Relational Tables and Columns
 */
async function getTables(req, res, next) {
  try {
    const schema = relationalDb.getSchema();
    const tables = Object.entries(schema).map(([tableName, meta]) => {
      const rows = relationalDb.select(tableName);
      return {
        table: tableName,
        primaryKey: meta.primaryKey,
        columns: meta.columns,
        rowCount: rows.length
      };
    });
    res.status(200).json(tables);
  } catch (err) {
    next(err);
  }
}

/**
 * Browse Rows of a Specific Table
 */
async function getTableData(req, res, next) {
  try {
    const tableName = req.params.table.toLowerCase();
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    const allRows = relationalDb.select(tableName);
    const paginated = allRows.slice(offset, offset + limit);

    res.status(200).json({
      table: tableName,
      totalCount: allRows.length,
      limit,
      offset,
      rows: paginated
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Execute SQL Query
 */
async function executeQuery(req, res, next) {
  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        status: 400,
        code: 'MISSING_QUERY',
        message: 'SQL query string is required.'
      });
    }

    const result = relationalDb.query(query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Export Database as Executable SQL Script
 */
async function exportSqlDump(req, res, next) {
  try {
    relationalDb.generateSqlDump();
    const dumpFile = relationalDb.sqlDumpPath;

    if (!fs.existsSync(dumpFile)) {
      return res.status(404).json({
        status: 404,
        code: 'FILE_NOT_FOUND',
        message: 'SQL dump file could not be found.'
      });
    }

    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', 'attachment; filename="lnmiit_recruitment_database_dump.sql"');
    const stream = fs.createReadStream(dumpFile);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  getTables,
  getTableData,
  executeQuery,
  exportSqlDump
};
