在 JavaScript 环境下提取 EPUB 文件的结构化数据（章节标题、正文等），主要思路与 Python 类似：EPUB 本质是 ZIP 压缩包，内含 HTML/XHTML 文件、目录文件、元数据等。你需要先解压 EPUB，然后解析内部的 HTML 文件，提取文字和结构。

下面分别给出**浏览器环境**（使用 JSZip）和 **Node.js 环境**（使用 adm-zip 或 yauzl）的示例。

---

## 一、浏览器环境（使用 JSZip + DOMParser）

### 1. 安装 / 引入依赖
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
```

### 2. 提取结构化数据的代码
```javascript
async function extractEpub(epubFile) {  // epubFile 是 File 对象（来自 <input type="file">）
    const zip = await JSZip.loadAsync(epubFile);
    
    // 1. 寻找目录文件（通常是 META-INF/container.xml 指明根文件）
    const containerXml = await zip.file("META-INF/container.xml")?.async("string");
    if (!containerXml) throw new Error("无效的 EPUB 文件");
    
    // 解析 container.xml 获取根文件路径
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, "application/xml");
    const rootfilePath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
    if (!rootfilePath) throw new Error("无法定位根文件");
    
    // 2. 获取根文件（如 content.opf）
    const rootfileContent = await zip.file(rootfilePath)?.async("string");
    const rootDoc = parser.parseFromString(rootfileContent, "application/xml");
    
    // 3. 提取元数据（标题、作者等）
    const metadata = rootDoc.querySelector("metadata");
    const title = metadata?.querySelector("dc\\:title, title")?.textContent || "未知标题";
    const author = metadata?.querySelector("dc\\:creator, creator")?.textContent || "未知作者";
    
    // 4. 获取所有文档条目（item）的 id 和 href
    const manifest = rootDoc.querySelector("manifest");
    const items = {};
    manifest.querySelectorAll("item").forEach(item => {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        if (href && href.endsWith(".xhtml") || href.endsWith(".html")) {
            items[id] = href;
        }
    });
    
    // 5. 获取 spine 阅读顺序
    const spine = rootDoc.querySelector("spine");
    const itemrefs = spine.querySelectorAll("itemref");
    const spineIds = Array.from(itemrefs).map(ref => ref.getAttribute("idref"));
    
    // 6. 解析目录 (nav 或 toc.ncx)
    let toc = [];
    // 方式一：nav.xhtml (EPUB 3)
    const navItem = Array.from(manifest.querySelectorAll("item")).find(
        item => item.getAttribute("properties") === "nav"
    );
    if (navItem) {
        const navHref = navItem.getAttribute("href");
        const navContent = await zip.file( resolvePath(rootfilePath, navHref) )?.async("string");
        if (navContent) {
            const navDoc = parser.parseFromString(navContent, "text/html");
            const navPoints = navDoc.querySelectorAll("nav ol li a");
            navPoints.forEach(a => {
                toc.push({ title: a.textContent, href: a.getAttribute("href") });
            });
        }
    } else {
        // 方式二：toc.ncx (EPUB 2)
        const ncxItem = Array.from(manifest.querySelectorAll("item")).find(
            item => item.getAttribute("media-type") === "application/x-dtbncx+xml"
        );
        if (ncxItem) {
            const ncxHref = ncxItem.getAttribute("href");
            const ncxContent = await zip.file( resolvePath(rootfilePath, ncxHref) )?.async("string");
            if (ncxContent) {
                const ncxDoc = parser.parseFromString(ncxContent, "application/xml");
                const navPoints = ncxDoc.querySelectorAll("navPoint");
                navPoints.forEach(np => {
                    const title = np.querySelector("navLabel text")?.textContent;
                    const href = np.querySelector("content")?.getAttribute("src");
                    if (title && href) toc.push({ title, href });
                });
            }
        }
    }
    
    // 7. 提取正文（按 spine 顺序）
    const chapters = [];
    const baseDir = rootfilePath.substring(0, rootfilePath.lastIndexOf("/") + 1);
    for (const id of spineIds) {
        const href = items[id];
        if (!href) continue;
        const fullHref = resolvePath(baseDir, href);
        const htmlContent = await zip.file(fullHref)?.async("string");
        if (!htmlContent) continue;
        const doc = parser.parseFromString(htmlContent, "text/html");
        // 获取章节标题（优先找 h1/h2 等）
        let title = doc.querySelector("h1, h2, h3")?.textContent?.trim() || "无标题";
        // 获取纯文本（移除 script、style）
        doc.querySelectorAll("script, style").forEach(el => el.remove());
        const text = doc.body?.innerText?.trim() || "";
        chapters.push({ title, text, source: fullHref });
    }
    
    return { title, author, toc, chapters };
    
    // 辅助函数：解析相对路径
    function resolvePath(base, relative) {
        if (!base) return relative;
        const baseParts = base.split("/");
        const relParts = relative.split("/");
        if (relative.startsWith("/")) return relative.substring(1);
        baseParts.pop(); // 去掉文件名
        for (const part of relParts) {
            if (part === "..") baseParts.pop();
            else if (part !== ".") baseParts.push(part);
        }
        return baseParts.join("/");
    }
}

// 使用示例：在 file input 的 change 事件中
document.getElementById("epubInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const data = await extractEpub(file);
    console.log("书名：", data.title);
    console.log("作者：", data.author);
    console.log("目录：", data.toc);
    console.log("第一章内容预览：", data.chapters[0]?.text.slice(0, 200));
});
```

---

## 二、Node.js 环境（使用 adm-zip + jsdom）

### 1. 安装依赖
```bash
npm install adm-zip jsdom
```

### 2. 提取代码
```javascript
const AdmZip = require("adm-zip");
const { JSDOM } = require("jsdom");

async function extractEpub(epubPath) {
    const zip = new AdmZip(epubPath);
    
    // 读取 container.xml
    const containerEntry = zip.getEntry("META-INF/container.xml");
    if (!containerEntry) throw new Error("无效的 EPUB");
    const containerXml = containerEntry.getData().toString("utf8");
    const containerDom = new JSDOM(containerXml, { contentType: "application/xml" });
    const rootfilePath = containerDom.window.document.querySelector("rootfile")?.getAttribute("full-path");
    if (!rootfilePath) throw new Error("无法定位根文件");
    
    // 读取根文件 (OPF)
    const rootEntry = zip.getEntry(rootfilePath);
    const rootContent = rootEntry.getData().toString("utf8");
    const rootDom = new JSDOM(rootContent, { contentType: "application/xml" });
    const doc = rootDom.window.document;
    
    // 元数据
    const metadata = doc.querySelector("metadata");
    const title = metadata?.querySelector("dc\\:title, title")?.textContent || "未知";
    const author = metadata?.querySelector("dc\\:creator, creator")?.textContent || "未知";
    
    // manifest 中的文档
    const manifest = doc.querySelector("manifest");
    const items = {};
    manifest.querySelectorAll("item").forEach(item => {
        const id = item.getAttribute("id");
        const href = item.getAttribute("href");
        if (href && (href.endsWith(".xhtml") || href.endsWith(".html"))) {
            items[id] = href;
        }
    });
    
    // spine 顺序
    const spine = doc.querySelector("spine");
    const spineIds = Array.from(spine.querySelectorAll("itemref")).map(ref => ref.getAttribute("idref"));
    
    // 解析目录（nav 或 ncx）
    const toc = [];
    const navItem = Array.from(manifest.querySelectorAll("item")).find(
        item => item.getAttribute("properties") === "nav"
    );
    if (navItem) {
        const navHref = navItem.getAttribute("href");
        const navEntry = zip.getEntry( resolvePath(rootfilePath, navHref) );
        if (navEntry) {
            const navHtml = navEntry.getData().toString("utf8");
            const navDom = new JSDOM(navHtml);
            const navDoc = navDom.window.document;
            const links = navDoc.querySelectorAll("nav ol li a");
            links.forEach(a => {
                toc.push({ title: a.textContent, href: a.getAttribute("href") });
            });
        }
    } else {
        const ncxItem = Array.from(manifest.querySelectorAll("item")).find(
            item => item.getAttribute("media-type") === "application/x-dtbncx+xml"
        );
        if (ncxItem) {
            const ncxHref = ncxItem.getAttribute("href");
            const ncxEntry = zip.getEntry( resolvePath(rootfilePath, ncxHref) );
            if (ncxEntry) {
                const ncxXml = ncxEntry.getData().toString("utf8");
                const ncxDom = new JSDOM(ncxXml, { contentType: "application/xml" });
                const navPoints = ncxDom.window.document.querySelectorAll("navPoint");
                navPoints.forEach(np => {
                    const title = np.querySelector("navLabel text")?.textContent;
                    const href = np.querySelector("content")?.getAttribute("src");
                    if (title && href) toc.push({ title, href });
                });
            }
        }
    }
    
    // 提取正文
    const chapters = [];
    const baseDir = rootfilePath.substring(0, rootfilePath.lastIndexOf("/") + 1);
    for (const id of spineIds) {
        const href = items[id];
        if (!href) continue;
        const fullHref = resolvePath(baseDir, href);
        const entry = zip.getEntry(fullHref);
        if (!entry) continue;
        const html = entry.getData().toString("utf8");
        const dom = new JSDOM(html);
        const window = dom.window;
        const document = window.document;
        // 删除脚本和样式
        document.querySelectorAll("script, style").forEach(el => el.remove());
        const titleElem = document.querySelector("h1, h2, h3");
        let chapTitle = titleElem ? titleElem.textContent.trim() : "无标题";
        const text = document.body ? document.body.textContent.trim() : "";
        chapters.push({ title: chapTitle, text, source: fullHref });
    }
    
    return { title, author, toc, chapters };
    
    function resolvePath(base, relative) {
        if (!base) return relative;
        const parts = base.split("/");
        const rels = relative.split("/");
        if (relative.startsWith("/")) return relative.slice(1);
        parts.pop(); // 去掉文件名
        for (const p of rels) {
            if (p === "..") parts.pop();
            else if (p !== ".") parts.push(p);
        }
        return parts.join("/");
    }
}

// 使用示例
extractEpub("./红拂夜奔.epub").then(data => {
    console.log("书名:", data.title);
    console.log("作者:", data.author);
    console.log("目录条目数:", data.toc.length);
    console.log("第一章内容预览:", data.chapters[0]?.text.slice(0, 300));
}).catch(console.error);
```

---

## 三、提取后可以做的结构化存储

无论浏览器还是 Node.js，提取后得到的数据可以存为 JSON 文件或导入数据库，例如：

```json
{
  "title": "红拂夜奔",
  "author": "王小波",
  "chapters": [
    { "number": 1, "title": "第一章", "content": "在本章里一再提到一个名称“领导上”……" },
    { "number": 2, "title": "第二章", "content": "因为本章里提到红拂申请自杀指标的事……" }
  ]
}
```

---

## 四、注意事项

1. **路径处理**：EPUB 内部文件的相对路径可能包含 `../`，需要正确解析。
2. **命名空间**：解析 XML 时注意 `dc:` 等命名空间，上述示例中使用了通配符选择器或直接查询标签名，可兼容大多数 EPUB。
3. **正文清洗**：提取的文本可能包含导航、页眉页脚等噪声，可根据需要进一步过滤（例如剔除 `.nav` 类元素）。
4. **性能**：对于大体积 EPUB，浏览器中处理大量文本可能导致内存压力，建议分批或使用 Web Worker。

使用上述 JavaScript 代码，即可从《红拂夜奔》这类 EPUB 文件中提取出章节标题、正文、目录等结构化数据，方便进一步分析或检索。