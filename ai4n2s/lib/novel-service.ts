import db from './db';
import { Novel, SourceFile, ApiResponse } from './types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'data', 'storage');

// 确保存储目录存在
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export class NovelService {
  // 创建新小说
  static create(title: string, author: string): ApiResponse<Novel> {
    try {
      const id = uuidv4();
      const now = Date.now();

      const stmt = db.prepare(`
        INSERT INTO novels (id, title, author, created_at, updated_at, status)
        VALUES (?, ?, ?, ?, ?, 'uploading')
      `);

      stmt.run(id, title, author, now, now);

      // 创建小说目录
      const novelDir = path.join(STORAGE_DIR, id);
      fs.mkdirSync(novelDir, { recursive: true });
      fs.mkdirSync(path.join(novelDir, 'sources'), { recursive: true });
      fs.mkdirSync(path.join(novelDir, 'scripts'), { recursive: true });

      const novel = this.getById(id);
      return { success: true, data: novel! };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 获取小说详情
  static getById(id: string): Novel | null {
    const stmt = db.prepare('SELECT * FROM novels WHERE id = ?');
    const row = stmt.get(id) as Novel | undefined;

    if (!row) return null;

    return {
      ...row,
      source_files: JSON.parse(row.source_files as unknown as string),
    };
  }

  // 获取所有小说
  static getAll(): ApiResponse<Novel[]> {
    try {
      const stmt = db.prepare('SELECT * FROM novels ORDER BY updated_at DESC');
      const rows = stmt.all() as Novel[];

      const novels = rows.map(row => ({
        ...row,
        source_files: JSON.parse(row.source_files as unknown as string),
      }));

      return { success: true, data: novels };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 更新小说状态
  static updateStatus(id: string, status: Novel['status']): ApiResponse<void> {
    try {
      const stmt = db.prepare(`
        UPDATE novels SET status = ?, updated_at = ? WHERE id = ?
      `);
      stmt.run(status, Date.now(), id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 添加源文件
  static addSourceFile(id: string, file: SourceFile): ApiResponse<void> {
    try {
      const novel = this.getById(id);
      if (!novel) {
        return { success: false, error: '小说不存在' };
      }

      const sourceFiles = [...novel.source_files, file];
      const stmt = db.prepare(`
        UPDATE novels SET source_files = ?, updated_at = ? WHERE id = ?
      `);
      stmt.run(JSON.stringify(sourceFiles), Date.now(), id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 设置归一化数据路径
  static setNormalizedPath(id: string, normalizedPath: string): ApiResponse<void> {
    try {
      const stmt = db.prepare(`
        UPDATE novels SET normalized_path = ?, status = 'ready', updated_at = ? WHERE id = ?
      `);
      stmt.run(normalizedPath, Date.now(), id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 删除小说
  static delete(id: string): ApiResponse<void> {
    try {
      const stmt = db.prepare('DELETE FROM novels WHERE id = ?');
      stmt.run(id);

      // 删除文件目录
      const novelDir = path.join(STORAGE_DIR, id);
      if (fs.existsSync(novelDir)) {
        fs.rmSync(novelDir, { recursive: true, force: true });
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 获取小说的存储路径
  static getStoragePath(id: string): string {
    return path.join(STORAGE_DIR, id);
  }
}

export default NovelService;
