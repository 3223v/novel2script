import db from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'data', 'storage');

// 确保存储目录存在
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// 示例小说数据
const sampleNovels = [
  {
    title: '三体',
    author: '刘慈欣',
    sourceFiles: [
      { name: '三体第一部.txt', path: 'sources/三体第一部.txt', type: 'text/plain' },
    ],
  },
  {
    title: '活着',
    author: '余华',
    sourceFiles: [
      { name: '活着完整版.docx', path: 'sources/活着完整版.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    ],
  },
  {
    title: '围城',
    author: '钱钟书',
    sourceFiles: [],
  },
];

// 示例剧本数据
const sampleScript = {
  script: {
    metadata: {
      title: '三体·黑暗森林（节选）',
      author: '刘慈欣（原著） / AI 辅助改编',
      based_on: '《三体II：黑暗森林》',
      version: 'draft-0.1',
      date: '2026-06-06',
      logline: '面对三体人的入侵，人类启动面壁计划，四位面壁者展开绝望反击。',
      genre: ['科幻', '剧情'],
    },
    characters: [
      { id: 'luo_ji', name: '罗辑', description: '社会学博士，被选为面壁者。' },
      { id: 'da_shi', name: '大史', description: '资深刑警，罗辑的保镖。' },
    ],
    scenes: [
      {
        id: 'sc_1',
        heading: '外. 杨冬墓前 - 日',
        content: [
          {
            type: 'action',
            text: '荒凉的墓地，只有一块简单的石碑。罗辑独自站在墓前，大史在不远处抽烟。',
          },
          {
            type: 'character',
            name: '罗辑',
            parenthetical: '（低声）',
            dialogue: '你真是个神秘的女人，杨冬。\n直到你死后，我才发现我对你一无所知。',
          },
          {
            type: 'action',
            text: '大史踩灭烟头，走过来。',
          },
          {
            type: 'character',
            name: '大史',
            dialogue: '走吧，罗教授。这里风大。',
          },
          {
            type: 'transition',
            text: '切至：',
          },
        ],
        notes: '第一幕氛围铺垫，后续可加入更多关于"黑暗森林"的隐喻。',
        tags: ['情感', '开场'],
      },
    ],
  },
};

async function seed() {
  console.log('🌱 开始填充示例数据...');

  // 清空现有数据
  db.exec('DELETE FROM scripts');
  db.exec('DELETE FROM novels');

  for (const novelData of sampleNovels) {
    const novelId = uuidv4();
    const now = Date.now();

    // 创建小说记录
    db.prepare(`
      INSERT INTO novels (id, title, author, created_at, updated_at, status, source_files)
      VALUES (?, ?, ?, ?, ?, 'ready', ?)
    `).run(novelId, novelData.title, novelData.author, now, now, JSON.stringify(novelData.sourceFiles));

    // 创建目录
    const novelDir = path.join(STORAGE_DIR, novelId);
    fs.mkdirSync(novelDir, { recursive: true });
    fs.mkdirSync(path.join(novelDir, 'sources'), { recursive: true });
    fs.mkdirSync(path.join(novelDir, 'scripts'), { recursive: true });

    // 为第一本小说添加示例剧本
    if (novelData.title === '三体') {
      const scriptId = uuidv4();
      const fileName = `${scriptId}.json`;
      const filePath = path.join(novelId, 'scripts', fileName);

      // 保存剧本 JSON
      fs.writeFileSync(
        path.join(STORAGE_DIR, filePath),
        JSON.stringify(sampleScript, null, 2),
        'utf-8'
      );

      // 创建剧本记录
      db.prepare(`
        INSERT INTO scripts (id, novel_id, version, format, file_path, created_at, updated_at)
        VALUES (?, ?, ?, 'json', ?, ?, ?)
      `).run(scriptId, novelId, 'v1.0', filePath, now, now);

      console.log(`  ✓ 创建小说: ${novelData.title} (含示例剧本)`);
    } else {
      console.log(`  ✓ 创建小说: ${novelData.title}`);
    }
  }

  console.log('✅ 填充完成！');
  console.log('\n示例数据已创建:');
  console.log('  - 三体 (含1个示例剧本)');
  console.log('  - 活着');
  console.log('  - 围城');
}

seed();
