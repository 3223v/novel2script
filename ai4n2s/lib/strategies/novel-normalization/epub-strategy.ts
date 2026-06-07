/**
 * EPUB 电子书结构化策略
 *
 * EPUB 本质是 ZIP 压缩包，内含 XHTML 文件和目录结构。
 * 使用 adm-zip 解压 + jsdom 解析 HTML，提取章节标题和正文。
 *
 * 参考文档: docs/epub_strategy.md
 */

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { JSDOM } from 'jsdom';
import type {
  NovelStructuringStrategy,
  NovelStructuringInput,
  StructuringProgress,
} from '@/lib/pipeline/types';
import type { NormalizedNovel, NovelChapter } from '@/lib/types';

export class EpubStructuringStrategy implements NovelStructuringStrategy {
  readonly name = 'epub';
  readonly description = 'EPUB 策略 — 解析 EPUB 电子书，按 spine 顺序提取章节标题和正文';

  async execute(
    input: NovelStructuringInput,
    onProgress?: StructuringProgress
  ): Promise<NormalizedNovel> {
    const { novel } = input;
    const sourceFiles = novel.source_files || [];

    onProgress?.('start', '开始解析 EPUB 文件...');

    // 1. 查找 EPUB 源文件
    const epubFile = sourceFiles.find((f) => f.name.endsWith('.epub'));
    if (!epubFile) {
      throw new Error('未找到 EPUB 源文件。请先上传 .epub 格式的电子书。');
    }

    const storageDir = path.join(process.cwd(), 'data', 'storage');
    const epubPath = path.join(storageDir, novel.id, epubFile.path);

    if (!fs.existsSync(epubPath)) {
      throw new Error(`EPUB 文件不存在: ${epubPath}`);
    }

    // 2. 加载 ZIP
    onProgress?.('extract', '解压 EPUB...');
    const zip = new AdmZip(epubPath);

    // 3. 解析 container.xml → 找根文件路径
    const containerEntry = zip.getEntry('META-INF/container.xml');
    if (!containerEntry) throw new Error('无效的 EPUB: 缺少 META-INF/container.xml');
    const containerXml = containerEntry.getData().toString('utf8');
    const containerDom = new JSDOM(containerXml, { contentType: 'application/xml' });
    const rootfilePath = containerDom.window.document
      .querySelector('rootfile')
      ?.getAttribute('full-path');
    if (!rootfilePath) throw new Error('无法在 container.xml 中找到根文件路径');

    // 4. 解析根文件 (OPF) → 获取元数据 + manifest + spine
    const rootEntry = zip.getEntry(rootfilePath);
    if (!rootEntry) throw new Error(`根文件不存在: ${rootfilePath}`);
    const rootXml = rootEntry.getData().toString('utf8');
    const rootDom = new JSDOM(rootXml, { contentType: 'application/xml' });
    const opfDoc = rootDom.window.document;

    // 元数据
    const metadataEl = opfDoc.querySelector('metadata');
    const epubTitle =
      metadataEl?.querySelector('dc\\:title, title')?.textContent?.trim() ||
      novel.title;
    const epubAuthor =
      metadataEl?.querySelector('dc\\:creator, creator')?.textContent?.trim() ||
      novel.author ||
      '未知';

    onProgress?.('parse', `解析 EPUB 元数据: ${epubTitle} / ${epubAuthor}`);

    // manifest → id → href 映射
    const manifestEl = opfDoc.querySelector('manifest');
    const items: Record<string, string> = {};
    manifestEl?.querySelectorAll('item').forEach((item) => {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href && (href.endsWith('.xhtml') || href.endsWith('.html') || href.endsWith('.htm'))) {
        items[id] = href;
      }
    });

    // spine 阅读顺序
    const spineEl = opfDoc.querySelector('spine');
    const spineIds = spineEl
      ? Array.from(spineEl.querySelectorAll('itemref')).map((ref) => ref.getAttribute('idref') || '')
      : [];

    // 5. 解析目录 (TOC)
    onProgress?.('toc', '解析目录...');
    const toc = this.extractTOC(zip, rootfilePath, opfDoc, manifestEl);

    // 6. 按 spine 顺序提取正文
    onProgress?.('chapters', '提取章节正文...');
    const baseDir = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
    const chapters: NovelChapter[] = [];

    for (let i = 0; i < spineIds.length; i++) {
      const id = spineIds[i];
      const href = items[id];
      if (!href) continue;

      const fullHref = this.resolvePath(baseDir, href);
      const entry = zip.getEntry(fullHref);
      if (!entry) continue;

      const html = entry.getData().toString('utf8');
      const dom = new JSDOM(html);
      const doc = dom.window.document;

      // 清理脚本和样式
      doc.querySelectorAll('script, style, nav').forEach((el) => el.remove());

      // 章节标题: 优先 h1, 其次 h2/h3, 最后用目录匹配
      let chapTitle =
        doc.querySelector('h1')?.textContent?.trim() ||
        doc.querySelector('h2')?.textContent?.trim() ||
        doc.querySelector('h3')?.textContent?.trim() ||
        toc[i]?.title ||
        `第 ${i + 1} 章`;

      // 正文
      const text = doc.body?.textContent?.trim() || '';

      if (text.length > 50) {
        chapters.push({
          index: i,
          title: chapTitle,
          summary: '',
          content: this.cleanText(text),
          characters: [],
          locations: [],
        });
      }
    }

    // 7. 如果用 TOC 有更多条目，以 TOC 为准（spine 可能比 TOC 粗）
    if (chapters.length === 0 && toc.length > 0) {
      for (const tocItem of toc) {
        chapters.push({
          index: chapters.length,
          title: tocItem.title,
          summary: '',
          content: tocItem.content || '',
          characters: [],
          locations: [],
        });
      }
    }

    onProgress?.('summary', '生成摘要...');
    const totalChars = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
    const plot_summary = [
      `《${epubTitle}》，作者 ${epubAuthor}。`,
      `EPUB 电子书，共 ${chapters.length} 章，约 ${totalChars.toLocaleString()} 字。`,
    ].join('');

    onProgress?.('done', `EPUB 解析完成: ${chapters.length} 章`);

    return {
      metadata: {
        title: epubTitle,
        author: epubAuthor,
        word_count: totalChars,
        analysis_date: Date.now(),
      },
      characters: [],
      plot_summary,
      chapters,
    };
  }

  // ── 目录提取 ──

  private extractTOC(
    zip: AdmZip,
    rootfilePath: string,
    opfDoc: Document,
    manifestEl: Element | null
  ): Array<{ title: string; href?: string; content?: string }> {
    const toc: Array<{ title: string; href?: string; content?: string }> = [];
    const baseDir = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);
    if (!manifestEl) return toc;

    // EPUB 3: nav.xhtml
    const navItem = Array.from(manifestEl.querySelectorAll('item')).find(
      (item) => item.getAttribute('properties') === 'nav'
    );
    if (navItem) {
      const navHref = navItem.getAttribute('href');
      if (navHref) {
        const fullPath = this.resolvePath(baseDir, navHref);
        const entry = zip.getEntry(fullPath);
        if (entry) {
          const html = entry.getData().toString('utf8');
          const dom = new JSDOM(html);
          const links = dom.window.document.querySelectorAll('nav ol li a, nav li a');
          links.forEach((a) => {
            const title = a.textContent?.trim();
            if (title) toc.push({ title, href: a.getAttribute('href') || undefined });
          });
        }
      }
    }

    // EPUB 2: toc.ncx
    if (toc.length === 0) {
      const ncxItem = Array.from(manifestEl.querySelectorAll('item')).find(
        (item) => item.getAttribute('media-type') === 'application/x-dtbncx+xml'
      );
      if (ncxItem) {
        const ncxHref = ncxItem.getAttribute('href');
        if (ncxHref) {
          const fullPath = this.resolvePath(baseDir, ncxHref);
          const entry = zip.getEntry(fullPath);
          if (entry) {
            const xml = entry.getData().toString('utf8');
            const dom = new JSDOM(xml, { contentType: 'application/xml' });
            const points = dom.window.document.querySelectorAll('navPoint');
            points.forEach((np) => {
              const title = np.querySelector('navLabel text')?.textContent?.trim();
              const href = np.querySelector('content')?.getAttribute('src') || undefined;
              if (title) toc.push({ title, href });
            });
          }
        }
      }
    }

    return toc;
  }

  // ── 路径解析 ──

  private resolvePath(base: string, relative: string): string {
    if (!base) return relative;
    if (relative.startsWith('/')) return relative.slice(1);

    const baseParts = base.split('/');
    const relParts = relative.split('/');
    baseParts.pop(); // 去掉文件名

    for (const part of relParts) {
      if (part === '..') baseParts.pop();
      else if (part !== '.') baseParts.push(part);
    }

    return baseParts.join('/');
  }

  // ── 文本清洗 ──

  private cleanText(text: string): string {
    return text
      // 合并连续空白行
      .replace(/\n{3,}/g, '\n\n')
      // 移除行首尾空格
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim();
  }
}
