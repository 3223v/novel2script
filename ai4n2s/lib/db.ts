import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'novels.db');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 如果旧数据库存在则删除，重新建表
if (fs.existsSync(DB_PATH)) {
  const oldDb = new Database(DB_PATH);
  // 检查是否需要重建：如果 scripts 表的 novel_id 还有 NOT NULL 约束
  const tableInfo = oldDb.prepare("PRAGMA table_info('scripts')").all() as Array<{ name: string; notnull: number }>;
  const novelIdCol = tableInfo.find((c) => c.name === 'novel_id');
  oldDb.close();

  if (novelIdCol && novelIdCol.notnull === 1) {
    // 旧表有 NOT NULL 约束 → 删除重建
    fs.unlinkSync(DB_PATH);
    // 同时清理 WAL 文件
    try { fs.unlinkSync(DB_PATH + '-shm'); } catch { /* */ }
    try { fs.unlinkSync(DB_PATH + '-wal'); } catch { /* */ }
  }
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── 建表（novel_id 为 NULLABLE — 剧本是独立实体）──

db.exec(`
  CREATE TABLE IF NOT EXISTS novels (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    status TEXT DEFAULT 'uploading',
    source_files TEXT DEFAULT '[]',
    normalized_path TEXT
  );

  CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    novel_id TEXT,
    version TEXT NOT NULL,
    format TEXT DEFAULT 'json',
    file_path TEXT NOT NULL,
    yaml_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    generation_config TEXT DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_scripts_novel_id ON scripts(novel_id);
`);

export default db;
