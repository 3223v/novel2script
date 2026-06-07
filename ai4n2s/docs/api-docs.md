# AI4N2S API 文档

## 基础地址

```
http://localhost:3000/api
```

## 小说 API

### GET /api/novels
获取所有小说列表（按 updated_at 降序排列）。

### POST /api/novels
创建新小说。
```json
{ "title": "必填", "author": "选填" }
```

### GET /api/novels/{id}
获取小说详情，包含关联的剧本列表。

### PATCH /api/novels/{id}
更新小说状态。
```json
{ "status": "uploading | analyzing | ready | error" }
```

### DELETE /api/novels/{id}
删除小说及其所有关联文件和剧本。

### POST /api/novels/{id}/files
上传源文件。`multipart/form-data`，字段名: `file`。

### GET /api/novels/{id}/normalized
读取结构化小说 JSON 数据。

### PUT /api/novels/{id}/normalized
保存/更新结构化小说 JSON 数据。请求体为完整的 `NormalizedNovel` 对象。

## 剧本 API

### POST /api/scripts
创建剧本。
```json
{ "novelId": "uuid", "version": "string", "data": { "script": { ... } } }
```
完整结构参见 `lib/types.ts` → `ScriptYAML`。

### GET /api/scripts/{id}
获取剧本元数据及完整内容。

### PUT /api/scripts/{id}
更新剧本内容和/或版本号。
```json
{ "data": { "script": { ... } }, "version": "选填" }
```

### DELETE /api/scripts/{id}
删除剧本及关联文件。

### GET /api/scripts/{id}/export-yaml
下载 YAML 格式剧本文件。

### POST /api/scripts/{id}/import-yaml
从 YAML 文本导入剧本。

## 管线 API

### GET /api/pipeline/novels/{id}/structure
获取可用的结构化策略列表。

### POST /api/pipeline/novels/{id}/structure
触发小说结构化管线。
```json
{ "strategy": "default | regex | ai-workflow" }
```

### GET /api/pipeline/scripts/{id}/generate
获取可用的生成策略列表。注意：`{id}` 为小说 ID。

### POST /api/pipeline/scripts/{id}/generate
触发剧本生成管线。
```json
{ "strategy": "default | ai-rag", "version": "v1.0" }
```

## 响应格式

所有接口返回统一格式:
```json
{ "success": true, "data": ... }
// 或
{ "success": false, "error": "错误描述" }
```

HTTP 状态码: 200 (成功), 201 (创建成功), 400 (参数错误), 404 (未找到), 500 (服务器错误)。
