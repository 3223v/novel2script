import db from './db';
import { Script, ScriptYAML, ApiResponse } from './types';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import NovelService from './novel-service';

const STORAGE_DIR = path.join(process.cwd(), 'data', 'storage');

export class ScriptService {
  // 创建新剧本（novelId 可选 — 允许独立剧本）
  static create(novelId: string | undefined, version: string, scriptData: ScriptYAML): ApiResponse<Script> {
    try {
      if (novelId) {
        const novel = NovelService.getById(novelId);
        if (!novel) return { success: false, error: '小说不存在' };
      }

      const id = uuidv4();
      const now = Date.now();
      const folderId = novelId || 'standalone';
      const fileName = `${id}.json`;
      const filePath = path.join(folderId, 'scripts', fileName);

      // 确保目录存在
      const fullPath = path.join(STORAGE_DIR, filePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // 保存 JSON 文件
      fs.writeFileSync(fullPath, JSON.stringify(scriptData, null, 2), 'utf-8');

      const stmt = db.prepare(`
        INSERT INTO scripts (id, novel_id, version, format, file_path, created_at, updated_at, generation_config)
        VALUES (?, ?, ?, 'json', ?, ?, ?, '{}')
      `);

      stmt.run(id, novelId || null, version, filePath, now, now);

      const script = this.getById(id);
      return { success: true, data: script! };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 获取剧本详情
  static getById(id: string): Script | null {
    const stmt = db.prepare('SELECT * FROM scripts WHERE id = ?');
    const row = stmt.get(id) as Script | undefined;

    if (!row) return null;

    return {
      ...row,
      generation_config: JSON.parse(row.generation_config as unknown as string),
    };
  }

  // 获取小说的所有剧本
  static getByNovelId(novelId: string): ApiResponse<Script[]> {
    try {
      const stmt = db.prepare('SELECT * FROM scripts WHERE novel_id = ? ORDER BY created_at DESC');
      const rows = stmt.all(novelId) as Script[];
      return { success: true, data: rows.map((row) => ({ ...row, generation_config: JSON.parse(row.generation_config as unknown as string) })) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 获取所有独立剧本（novel_id IS NULL）
  static getStandalone(): ApiResponse<Script[]> {
    try {
      const stmt = db.prepare('SELECT * FROM scripts WHERE novel_id IS NULL ORDER BY created_at DESC');
      const rows = stmt.all() as Script[];
      return { success: true, data: rows.map((row) => ({ ...row, generation_config: JSON.parse(row.generation_config as unknown as string) })) };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 获取剧本内容
  static getContent(id: string): ApiResponse<ScriptYAML> {
    try {
      const script = this.getById(id);
      if (!script) {
        return { success: false, error: '剧本不存在' };
      }

      const fullPath = path.join(STORAGE_DIR, script.file_path);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: '剧本文件不存在' };
      }

      const content = fs.readFileSync(fullPath, 'utf-8');
      const data = JSON.parse(content) as ScriptYAML;

      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 更新剧本内容
  static updateContent(id: string, scriptData: ScriptYAML): ApiResponse<void> {
    try {
      const script = this.getById(id);
      if (!script) {
        return { success: false, error: '剧本不存在' };
      }

      const fullPath = path.join(STORAGE_DIR, script.file_path);
      fs.writeFileSync(fullPath, JSON.stringify(scriptData, null, 2), 'utf-8');

      const stmt = db.prepare('UPDATE scripts SET updated_at = ? WHERE id = ?');
      stmt.run(Date.now(), id);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 导出为 YAML
  static exportToYaml(id: string): ApiResponse<string> {
    try {
      const script = this.getById(id);
      if (!script) {
        return { success: false, error: '剧本不存在' };
      }

      const contentResult = this.getContent(id);
      if (!contentResult.success || !contentResult.data) {
        return { success: false, error: contentResult.error || '获取剧本内容失败' };
      }

      const yamlString = yaml.stringify(contentResult.data, {
        indent: 2,
        lineWidth: 0,
        aliasDuplicateObjects: false,
      });

      // 保存 YAML 文件
      const yamlPath = script.file_path.replace('.json', '.yaml');
      const fullYamlPath = path.join(STORAGE_DIR, yamlPath);
      fs.writeFileSync(fullYamlPath, yamlString, 'utf-8');

      // 更新数据库记录
      const stmt = db.prepare('UPDATE scripts SET yaml_path = ? WHERE id = ?');
      stmt.run(yamlPath, id);

      return { success: true, data: yamlString };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 从 YAML 导入
  static importFromYaml(id: string, yamlContent: string): ApiResponse<void> {
    try {
      const script = this.getById(id);
      if (!script) {
        return { success: false, error: '剧本不存在' };
      }

      // 解析 YAML
      const scriptData = yaml.parse(yamlContent) as ScriptYAML;

      // 验证基本结构
      if (!scriptData.script || !scriptData.script.scenes) {
        return { success: false, error: '无效的剧本 YAML 格式' };
      }

      // 更新 JSON 文件
      const fullPath = path.join(STORAGE_DIR, script.file_path);
      fs.writeFileSync(fullPath, JSON.stringify(scriptData, null, 2), 'utf-8');

      // 更新 YAML 路径
      const yamlPath = script.file_path.replace('.json', '.yaml');
      const fullYamlPath = path.join(STORAGE_DIR, yamlPath);
      fs.writeFileSync(fullYamlPath, yamlContent, 'utf-8');

      const stmt = db.prepare('UPDATE scripts SET yaml_path = ?, updated_at = ? WHERE id = ?');
      stmt.run(yamlPath, Date.now(), id);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 更新关联小说
  static updateNovelId(id: string, novelId: string | null): void {
    db.prepare('UPDATE scripts SET novel_id = ?, updated_at = ? WHERE id = ?').run(novelId, Date.now(), id);
  }

  // 更新版本
  static updateVersion(id: string, version: string): ApiResponse<void> {
    try {
      const stmt = db.prepare('UPDATE scripts SET version = ?, updated_at = ? WHERE id = ?');
      stmt.run(version, Date.now(), id);
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // 删除剧本
  static delete(id: string): ApiResponse<void> {
    try {
      const script = this.getById(id);
      if (!script) {
        return { success: false, error: '剧本不存在' };
      }

      // 删除文件
      const jsonPath = path.join(STORAGE_DIR, script.file_path);
      if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
      }

      if (script.yaml_path) {
        const yamlPath = path.join(STORAGE_DIR, script.yaml_path);
        if (fs.existsSync(yamlPath)) {
          fs.unlinkSync(yamlPath);
        }
      }

      // 删除数据库记录
      const stmt = db.prepare('DELETE FROM scripts WHERE id = ?');
      stmt.run(id);

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }
}

export default ScriptService;
