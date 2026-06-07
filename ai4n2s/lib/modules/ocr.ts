/**
 * OCR 调用模块 — 从图片中提取文字
 *
 * 采用策略模式:
 *   OCRProvider (接口) ← TesseractOCR / CloudOCR / ...
 *
 * 默认使用 NoOpOCR，返回空内容。
 * 扩展时实现 OCRProvider 接口并注册到 OCRFactory。
 */

// ══════════════════════════════════════════════════════
// 类型定义
// ══════════════════════════════════════════════════════

export interface OCRResult {
  /** 识别的文本 */
  text: string;
  /** 置信度 (0-1) */
  confidence: number;
  /** 检测到的语言 */
  language?: string;
  /** 处理耗时 (ms) */
  duration: number;
  /** 按区域划分的文本块 (可选) */
  blocks?: OCRBlock[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  /** 边界框 (百分比坐标) */
  bbox: { x: number; y: number; w: number; h: number };
}

export interface OCROptions {
  /** 目标语言 (ISO 639-1), 默认 'zh' */
  language?: string;
  /** 预处理选项 */
  preprocess?: {
    /** 灰度化 */
    grayscale?: boolean;
    /** 二值化阈值 (0-255) */
    threshold?: number;
    /** 缩放比例 */
    scale?: number;
  };
}

// ══════════════════════════════════════════════════════
// Provider 接口
// ══════════════════════════════════════════════════════

export interface OCRProvider {
  readonly name: string;
  readonly description: string;

  /** 从图片 Buffer 识别文字 */
  recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult>;

  /** 从图片文件路径识别文字 */
  recognizeFromFile(filePath: string, options?: OCROptions): Promise<OCRResult>;
}

// ══════════════════════════════════════════════════════
// No-Op Provider (默认实现)
// ══════════════════════════════════════════════════════

export class NoOpOCRProvider implements OCRProvider {
  readonly name = 'noop';
  readonly description = '空 OCR 提供器 — 返回空内容，需要配置真实 OCR 引擎';

  async recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult> {
    return {
      text: '',
      confidence: 0,
      language: options?.language || 'zh',
      duration: 0,
    };
  }

  async recognizeFromFile(filePath: string, options?: OCROptions): Promise<OCRResult> {
    return {
      text: `[OCR 未配置]\n文件: ${filePath}\n\n请安装 tesseract.js 或配置云 OCR 服务实现文字识别。`,
      confidence: 0,
      language: options?.language || 'zh',
      duration: 0,
    };
  }
}

// ══════════════════════════════════════════════════════
// Tesseract.js Provider 骨架
// ══════════════════════════════════════════════════════

/**
 * Tesseract.js OCR Provider 骨架。
 *
 * 需要安装: npm install tesseract.js
 *
 * 使用方式:
 *   const provider = new TesseractOCRProvider();
 *   OCRFactory.setProvider(provider);
 */
export class TesseractOCRProvider implements OCRProvider {
  readonly name = 'tesseract';
  readonly description = 'Tesseract.js OCR 提供器 — 基于本地 OCR 引擎';

  async recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult> {
    // TODO: 集成 tesseract.js
    // const Tesseract = await import('tesseract.js');
    // const result = await Tesseract.recognize(imageBuffer, options?.language || 'chi_sim');
    // return { text: result.data.text, confidence: result.data.confidence / 100, ... };

    return {
      text: `[Tesseract OCR 未完整实现]\n图片大小: ${imageBuffer.length} bytes\n\n请安装 tesseract.js: npm install tesseract.js`,
      confidence: 0,
      language: options?.language || 'zh',
      duration: 0,
    };
  }

  async recognizeFromFile(filePath: string, options?: OCROptions): Promise<OCRResult> {
    const fs = await import('fs');
    const buffer = fs.readFileSync(filePath);
    return this.recognize(buffer, options);
  }
}

// ══════════════════════════════════════════════════════
// OCR Factory — 全局单例
// ══════════════════════════════════════════════════════

let defaultProvider: OCRProvider = new NoOpOCRProvider();

export const OCRFactory = {
  getProvider(): OCRProvider {
    return defaultProvider;
  },

  setProvider(provider: OCRProvider): void {
    defaultProvider = provider;
  },

  async recognize(imageBuffer: Buffer, options?: OCROptions): Promise<OCRResult> {
    return defaultProvider.recognize(imageBuffer, options);
  },

  async recognizeFromFile(filePath: string, options?: OCROptions): Promise<OCRResult> {
    return defaultProvider.recognizeFromFile(filePath, options);
  },
};
