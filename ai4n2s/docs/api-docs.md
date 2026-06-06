# AI4N2S API 文档

## 概述

AI4N2S 数据管理系统提供 RESTful API 用于管理小说和剧本。

## 基础 URL

```
http://localhost:3000/api
```

## 小说 API

### 获取所有小说

```
GET /api/novels
```

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "三体",
      "author": "刘慈欣",
      "status": "ready",
      "source_files": [],
      "created_at": 1717700000000,
      "updated_at": 1717700000000
    }
  ]
}
```

### 创建小说

```
POST /api/novels
```

**请求体:**
```json
{
  "title": "小说标题",
  "author": "作者名"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "小说标题",
    "author": "作者名",
    "status": "uploading",
    "source_files": [],
    "created_at": 1717700000000,
    "updated_at": 1717700000000
  }
}
```

### 获取小说详情

```
GET /api/novels/{id}
```

**响应包含:** 小说基本信息 + 关联的剧本列表

### 更新小说状态

```
PATCH /api/novels/{id}
```

**请求体:**
```json
{
  "status": "ready"  // uploading | analyzing | ready | error
}
```

### 删除小说

```
DELETE /api/novels/{id}
```

**注意:** 将同时删除关联的剧本和文件

### 上传源文件

```
POST /api/novels/{id}/files
```

**请求:** `multipart/form-data`

| 字段 | 类型 | 说明 |
|------|------|------|
| file | File | 源文件（支持多选） |

## 剧本 API

### 创建剧本

```
POST /api/scripts
```

**请求体:**
```json
{
  "novelId": "小说ID",
  "version": "v1.0",
  "data": {
    "script": {
      "metadata": {
        "title": "剧本标题",
        "author": "编剧",
        "based_on": "原著",
        "version": "v1.0",
        "date": "2026-06-06",
        "logline": "一句话故事梗概",
        "genre": ["科幻", "剧情"]
      },
      "characters": [
        {
          "id": "char_1",
          "name": "角色名",
          "description": "角色描述"
        }
      ],
      "scenes": [
        {
          "id": "sc_1",
          "heading": "内. 地点 - 时间",
          "content": [
            {
              "type": "action",
              "text": "动作描述"
            },
            {
              "type": "character",
              "name": "角色名",
              "parenthetical": "（情绪）",
              "dialogue": "对白内容"
            },
            {
              "type": "transition",
              "text": "切至："
            }
          ],
          "notes": "编剧备注",
          "tags": ["标签1", "标签2"]
        }
      ]
    }
  }
}
```

### 获取剧本详情

```
GET /api/scripts/{id}
```

**响应包含:** 剧本元数据 + 完整内容

### 更新剧本内容

```
PUT /api/scripts/{id}
```

**请求体:**
```json
{
  "data": { /* 完整剧本对象 */ },
  "version": "v1.1"  // 可选
}
```

### 删除剧本

```
DELETE /api/scripts/{id}
```

### 导出为 YAML

```
GET /api/scripts/{id}/export-yaml
```

**响应:** YAML 格式文件下载

### 从 YAML 导入

```
POST /api/scripts/{id}/import-yaml
```

**请求体:** YAML 文本内容

## 错误响应

所有 API 在失败时返回统一格式:

```json
{
  "success": false,
  "error": "错误描述"
}
```

## HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 数据存储

- **数据库:** SQLite (`data/novels.db`)
- **文件存储:** `data/storage/{novelId}/`
  - `sources/` - 原始源文件
  - `scripts/` - 剧本 JSON/YAML 文件
