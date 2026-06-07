/**
 * 文件处理模块 — 从各种格式中提取文本内容
 *
 * 支持格式: TXT, PDF, DOCX, Markdown, HTML, 直接粘贴文本
 *
 * 采用策略模式:
 *   FileExtractor (接口) ← TextExtractor / PDFExtractor / DOCXExtractor / ...
 *
 * 默认支持 TXT 和直接文本。
 * PDF 和 DOCX 提供骨架实现，需要安装对应依赖。
 */

import fs from 'fs';
import path from 'path';

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

export type SupportedFormat = 'txt' | 'pdf' | 'docx' | 'md' | 'html' | 'text';

export interface ExtractedContent {
  /** 提取的纯文本 */
  text: string;
  /** 原始格式 */
  format: SupportedFormat;
  /** 文件大小 (bytes) */
  size: number;
  /** 估计字数 (中文字符数) */
  estimatedChars: number;
  /** 额外元数据 */
  metadata: Record<string, unknown>;
}

export interface FileExtractor {
  readonly name: string;
  /** 支持的 MIME 类型列表 */
  readonly supportedTypes: string[];
  /** 支持的扩展名列表 */
  readonly supportedExtensions: string[];

  /** 从 Buffer 提取文本 */
  extractFromBuffer(buffer: Buffer, fileName: string): Promise<ExtractedContent>;

  /** 从文件路径提取文本 */
  extractFromFile(filePath: string): Promise<ExtractedContent>;

  /** 检查是否能处理此文件 */
  canHandle(fileName: string, mimeType?: string): boolean;
}

// ══════════════════════════════════════════════════════
// 编码检测工具
// ══════════════════════════════════════════════════════

/**
 * 自动检测文本编码并解码为 UTF-8 字符串。
 *
 * 检测顺序:
 *   1. BOM 标记 (UTF-8 / UTF-16 LE / UTF-16 BE)
 *   2. GBK/GB2312/GB18030 启发式检测
 *   3. 默认 UTF-8
 *
 * @param buffer 原始字节
 * @returns 解码后的字符串和检测到的编码名称
 */
function detectAndDecode(buffer: Buffer): { text: string; encoding: string } {
  if (buffer.length === 0) return { text: '', encoding: 'utf-8' };

  // 1. BOM 检测
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { text: buffer.toString('utf-8', 3), encoding: 'utf-8-bom' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return { text: buffer.toString('utf16le', 2), encoding: 'utf-16le' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE: swap each 16-bit word to LE, then decode
    const swapped = Buffer.alloc(buffer.length - 2);
    for (let i = 2; i < buffer.length - 1; i += 2) {
      swapped[i - 2] = buffer[i + 1];
      swapped[i - 1] = buffer[i];
    }
    return { text: swapped.toString('utf16le'), encoding: 'utf-16be' };
  }

  // 2. UTF-8 有效性检查 — TextDecoder fatal 模式精确判定
  try {
    const td = new TextDecoder('utf-8', { fatal: true });
    return { text: td.decode(buffer), encoding: 'utf-8' };
  } catch { /* 不是合法 UTF-8，继续尝试 GBK */ }

  // 3. 尝试 GB18030（兼容 GBK/GB2312）
  try {
    const td = new TextDecoder('gb18030', { fatal: true });
    return { text: td.decode(buffer), encoding: 'gb18030' };
  } catch { /* 也不是 GB 系列 */ }

  // 4. 兜底: UTF-8 宽松模式（可能产生 �）
  return { text: buffer.toString('utf-8'), encoding: 'utf-8' };
}

// ══════════════════════════════════════════════════════
// TXT / 文本提取器
// ══════════════════════════════════════════════════════

export class TextExtractor implements FileExtractor {
  readonly name = 'text-extractor';
  readonly supportedTypes = ['text/plain', 'text/markdown', 'text/html', 'application/octet-stream'];
  readonly supportedExtensions = ['.txt', '.md', '.html', '.htm', '.csv', '.log'];

  canHandle(fileName: string, _mimeType?: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  async extractFromBuffer(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
    const decoded = detectAndDecode(buffer);
    return this.buildResult(decoded.text, fileName, buffer.length, decoded.encoding);
  }

  async extractFromFile(filePath: string): Promise<ExtractedContent> {
    const buffer = fs.readFileSync(filePath);
    return this.extractFromBuffer(buffer, path.basename(filePath));
  }

  private buildResult(text: string, fileName: string, size: number, encoding?: string): ExtractedContent {
    const ext = path.extname(fileName).toLowerCase();
    let format: SupportedFormat = 'txt';

    if (ext === '.md') format = 'md';
    else if (ext === '.html' || ext === '.htm') format = 'html';
    if (!ext || ext === '') format = 'text';

    return {
      text,
      format,
      size,
      estimatedChars: text.replace(/\s/g, '').length,
      metadata: { fileName, encoding: encoding || 'utf-8' },
    };
  }
}

// ══════════════════════════════════════════════════════
// PDF 提取器骨架
// ══════════════════════════════════════════════════════

/**
 * PDF 文本提取器骨架。
 *
 * 需要安装: npm install pdf-parse
 * 或者使用 pdf.js / pdfjs-dist
 *
 * 当前返回空文本并附带提示信息。
 */
export class PDFExtractor implements FileExtractor {
  readonly name = 'pdf-extractor';
  readonly supportedTypes = ['application/pdf'];
  readonly supportedExtensions = ['.pdf'];

  canHandle(fileName: string, mimeType?: string): boolean {
    if (mimeType === 'application/pdf') return true;
    const ext = path.extname(fileName).toLowerCase();
    return ext === '.pdf';
  }

  async extractFromBuffer(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
    // TODO: 集成 pdf-parse 或 pdfjs-dist
    // const pdfParse = await import('pdf-parse');
    // const data = await pdfParse(buffer);
    // return { text: data.text, ... };

    return {
      text: `[PDF 提取未配置]\n文件: ${fileName}\n大小: ${buffer.length} bytes\n\n请安装 pdf-parse 或 pdfjs-dist 并实现 PDFExtractor 的文本提取逻辑。`,
      format: 'pdf',
      size: buffer.length,
      estimatedChars: 0,
      metadata: {
        fileName,
        warning: 'PDF 提取器未完整实现。安装 pdf-parse: npm install pdf-parse',
      },
    };
  }

  async extractFromFile(filePath: string): Promise<ExtractedContent> {
    const buffer = fs.readFileSync(filePath);
    return this.extractFromBuffer(buffer, path.basename(filePath));
  }
}

// ══════════════════════════════════════════════════════
// DOCX 提取器骨架
// ══════════════════════════════════════════════════════

/**
 * DOCX 文本提取器骨架。
 *
 * 需要安装: npm install mammoth
 *
 * 当前返回空文本并附带提示信息。
 */
export class DOCXExtractor implements FileExtractor {
  readonly name = 'docx-extractor';
  readonly supportedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  readonly supportedExtensions = ['.docx', '.doc'];

  canHandle(fileName: string, mimeType?: string): boolean {
    if (mimeType && this.supportedTypes.includes(mimeType)) return true;
    const ext = path.extname(fileName).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  async extractFromBuffer(buffer: Buffer, fileName: string): Promise<ExtractedContent> {
    // TODO: 集成 mammoth
    // const mammoth = await import('mammoth');
    // const result = await mammoth.extractRawText({ buffer });
    // return { text: result.value, ... };

    return {
      text: `[DOCX 提取未配置]\n文件: ${fileName}\n大小: ${buffer.length} bytes\n\n请安装 mammoth 并实现 DOCXExtractor 的文本提取逻辑。`,
      format: 'docx',
      size: buffer.length,
      estimatedChars: 0,
      metadata: {
        fileName,
        warning: 'DOCX 提取器未完整实现。安装 mammoth: npm install mammoth',
      },
    };
  }

  async extractFromFile(filePath: string): Promise<ExtractedContent> {
    const buffer = fs.readFileSync(filePath);
    return this.extractFromBuffer(buffer, path.basename(filePath));
  }
}

// ══════════════════════════════════════════════════════
// 文件处理工厂
// ══════════════════════════════════════════════════════

export class FileProcessor {
  private extractors: FileExtractor[] = [];
  private fallbackExtractor: FileExtractor;

  constructor() {
    this.fallbackExtractor = new TextExtractor();
    // 注册默认提取器
    this.register(new TextExtractor());
    this.register(new PDFExtractor());
    this.register(new DOCXExtractor());
  }

  /** 注册新的提取器 */
  register(extractor: FileExtractor): void {
    this.extractors.unshift(extractor); // 新注册的优先
  }

  /** 查找能处理此文件的提取器 */
  findExtractor(fileName: string, mimeType?: string): FileExtractor | null {
    return this.extractors.find(e => e.canHandle(fileName, mimeType)) || null;
  }

  /** 从文件路径提取文本 */
  async extractFromFile(filePath: string): Promise<ExtractedContent> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    const extractor = this.findExtractor(fileName) || this.fallbackExtractor;
    return extractor.extractFromFile(filePath);
  }

  /** 从 Buffer 提取文本 */
  async extractFromBuffer(buffer: Buffer, fileName: string, mimeType?: string): Promise<ExtractedContent> {
    const extractor = this.findExtractor(fileName, mimeType) || this.fallbackExtractor;
    return extractor.extractFromBuffer(buffer, fileName);
  }

  /** 从直接粘贴的文本创建 ExtractedContent */
  async extractFromText(text: string): Promise<ExtractedContent> {
    return {
      text,
      format: 'text',
      size: Buffer.byteLength(text, 'utf-8'),
      estimatedChars: text.replace(/\s/g, '').length,
      metadata: { source: 'pasted-text' },
    };
  }

  /** 获取已注册的提取器列表 */
  getExtractors(): { name: string; extensions: string[] }[] {
    return this.extractors.map(e => ({
      name: e.name,
      extensions: e.supportedExtensions,
    }));
  }
}

// 全局单例
export const fileProcessor = new FileProcessor();
