import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'novels.db');

// 确保数据目录存在
import fs from 'fs';
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// 启用 WAL 模式以获得更好的并发性能
db.pragma('journal_mode = WAL');

// 初始化数据库表
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
    novel_id TEXT NOT NULL,
    version TEXT NOT NULL,
    format TEXT DEFAULT 'json',
    file_path TEXT NOT NULL,
    yaml_path TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    generation_config TEXT DEFAULT '{}',
    FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_scripts_novel_id ON scripts(novel_id);
`);

export default db;
