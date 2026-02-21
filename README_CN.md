<div align="center">

![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Docker](https://img.shields.io/badge/docker-ghcr.io-blue.svg)
![CI](https://github.com/jiang925/where-is-my-shit/actions/workflows/ci.yml/badge.svg)

**找不到之前的AI对话了？WIMS 捕获并索引你所有的AI聊天记录，让你即时找到它们。**

[English](README.md) | 中文

</div>

---

## 功能特性

- **多平台捕获** — 通过 Chrome 扩展捕获 ChatGPT、Claude、Gemini、Perplexity 对话
- **开发会话索引** — 通过文件监控捕获 Claude Code 和 Cursor 对话
- **语义搜索** — 向量相似度 + 全文混合搜索，结合相关性排序
- **来源过滤** — 按平台过滤，支持快捷预设（Web 聊天、开发会话、全部）
- **时间线浏览** — 按时间顺序浏览，支持日期范围过滤（今天、本周等）
- **深度链接** — 点击即可跳转回原始对话
- **本地优先** — 所有数据存储在本地，无云端依赖
- **多种嵌入后端** — sentence-transformers（默认）、fastembed、ONNX、OpenAI 兼容 API

---

## 工作原理

WIMS 由三个组件协同工作：

**服务器（FastAPI + LanceDB）：** 核心后端，将文本嵌入为向量，将对话存储在 LanceDB 向量数据库中，并提供基于 React 的搜索/浏览 UI。服务器在本地运行，处理所有索引和检索操作。

**Chrome 扩展（content scripts）：** 从基于 Web 的平台（ChatGPT、Claude、Gemini、Perplexity）抓取 AI 对话，并将其发送到服务器进行索引。访问支持的网站时自动运行。

**文件监控（watchdog）：** 监控本地 AI 工具日志目录（Claude Code、Cursor、Antigravity），捕获开发会话对话。作为后台服务运行，自动获取新对话。

当你搜索时，服务器执行混合搜索，结合向量相似度和全文匹配，然后使用统一评分系统重新排序结果，该系统综合考虑语义相关性、文本重叠、内容质量和精确匹配信号。结果被分为主要（高置信度）和次要（良好匹配）两个层级。

---

## 快速开始

### 方式一：Docker（推荐）

```bash
# 拉取并运行（完整版，模型已预下载）
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest

# 或使用精简版（首次运行时下载模型）
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest-slim
```

**执行过程：**
- 容器在 http://localhost:8000 启动服务器
- 首次运行时自动生成 API 密钥（查看日志：`docker logs wims`）
- 配置和数据存储在 `~/.wims/`（通过卷挂载持久化）

**查看 API 密钥：**
```bash
docker logs wims 2>&1 | grep "API Key"
# 或检查配置文件：
cat ~/.wims/server.json
```

### 方式二：从源码安装

```bash
git clone https://github.com/jiang925/where-is-my-shit.git
cd where-is-my-shit
./setup.sh
./start.sh
```

**执行过程：**
- `setup.sh` 安装 `uv`（如果尚未安装），同步 Python 依赖，预下载默认嵌入模型（BAAI/bge-m3）
- `start.sh` 构建前端（如需要）并在 http://localhost:8000 启动服务器
- 首次运行时，会自动生成 API 密钥并打印到控制台。扩展和监控器需要此密钥。
- 配置存储在 `~/.wims/server.json`

在浏览器中打开 http://localhost:8000 访问搜索界面。

---

## 环境要求

**方式一：Docker（最简单）**
- **Docker** 或 **Docker Desktop**
- **~2GB 磁盘空间**用于嵌入模型（完整版）或 ~200MB（精简版）

**方式二：从源码安装**
- **Python 3.11+**
- **Node.js 20+**（用于前端构建和扩展）
- **macOS 或 Linux**（Windows：推荐使用 WSL）
- **~2GB 磁盘空间**用于嵌入模型

---

## 服务器设置

### 启动服务器

```bash
# 使用包装脚本（推荐）
./start.sh

# 或直接使用 CLI
uv run python -m src.cli start

# 使用自定义设置
uv run python -m src.cli start --host 0.0.0.0 --port 8080 --reload
```

### 服务器选项

- `--host` — 绑定地址（默认：`127.0.0.1`，使用 `0.0.0.0` 进行网络访问）
- `--port` — 端口号（默认：`8000`）
- `--reload` — 启用自动重载（用于开发）
- `--config` — 自定义配置文件路径

### 启动时

服务器将打印：

```
Starting WIMS server on 127.0.0.1:8000
Using config: /Users/you/.wims/server.json

API Key: sk-wims-xxxxxxxxxxxxxxxxxxxxxxxx
```

保存此 API 密钥以供扩展和监控器配置使用。

### API 文档

交互式 API 文档位于：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Docker 设置

Docker 是运行 WIMS 最简单的方式，提供两种镜像变体。

### 镜像变体

**完整版（推荐）：**
- 大小：~800MB
- 模型已预下载（bge-m3，~2GB）
- 即时启动，无需等待模型下载
- 标签：`latest`、`VERSION`、`VERSION-full`

**精简版：**
- 大小：~200MB
- 首次运行时下载模型（~2GB，一次性）
- 更小的镜像体积，首次启动较慢
- 标签：`latest-slim`、`VERSION-slim`

### 使用 Docker 运行

**完整版（即时启动）：**
```bash
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest
```

**精简版（更小镜像）：**
```bash
docker run -d \
  -p 8000:8000 \
  -v ~/.wims:/root/.wims \
  --name wims \
  ghcr.io/jiang925/wims:latest-slim
```

**获取 API 密钥：**
```bash
# 从容器日志
docker logs wims 2>&1 | grep "API Key"

# 或从配置文件
cat ~/.wims/server.json | jq -r '.api_key'
```

### 使用 docker-compose

创建 `docker-compose.yml`：

```yaml
services:
  wims:
    image: ghcr.io/jiang925/wims:latest
    ports:
      - "8000:8000"
    volumes:
      - ~/.wims:/root/.wims
    restart: unless-stopped
```

启动：
```bash
docker compose up -d
```

### Docker 管理

```bash
# 查看日志
docker logs -f wims

# 停止服务器
docker stop wims

# 启动服务器
docker start wims

# 重启服务器
docker restart wims

# 删除容器（数据保留在 ~/.wims）
docker rm -f wims

# 更新到最新版本
docker pull ghcr.io/jiang925/wims:latest
docker rm -f wims
# 然后重新运行 docker run 命令
```

---

## 浏览器扩展设置

Chrome 扩展从基于 Web 的 AI 平台捕获对话。

### 构建扩展

```bash
cd extension
npm install
npm run build
```

这将在 `extension/dist/` 中创建扩展包。

### 在 Chrome 中安装

1. 打开 Chrome 并导航到 `chrome://extensions`
2. 启用"开发者模式"（右上角的开关）
3. 点击"加载已解压的扩展程序"
4. 选择 `extension/dist` 目录

### 配置扩展

1. 点击 Chrome 工具栏中的 WIMS 扩展图标
2. 点击"选项"
3. 输入服务器 URL（例如，`http://localhost:8000`）
4. 输入服务器启动时的 API 密钥
5. 点击"保存"

### 支持的网站

扩展自动从以下网站捕获对话：
- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Gemini (gemini.google.com)
- Perplexity (perplexity.ai)

正常浏览这些网站即可 — 对话会自动捕获。

---

## 文件监控设置

文件监控器监控本地 AI 工具日志并索引开发会话对话。

### 安装依赖

```bash
pip install -r wims-watcher/requirements.txt
```

### 运行监控器

**前台运行（用于测试）：**

```bash
python -m wims-watcher.src.main
```

**作为 systemd 服务安装（Linux）：**

```bash
cd wims-watcher
./install.sh
```

这将创建并启用一个 systemd 服务，自动运行监控器。

### 配置

监控器会自动从 `~/.wims/server.json` 发现配置。无需额外设置 — 只需确保先配置好服务器。

### 支持的工具

监控器从以下工具监控对话：
- Claude Code
- Cursor
- Antigravity

日志目录根据标准工具位置自动检测。

---

## 配置说明

服务器配置存储在 `~/.wims/server.json`，首次运行时自动创建。

### 完整配置示例

```json
{
  "api_key": "sk-wims-xxxxxxxxxxxxxxxxxxxx",
  "port": 8000,
  "host": "127.0.0.1",
  "LOG_LEVEL": "INFO",
  "DB_PATH": "data/wims.lance",
  "AUTH_DB_PATH": "data/auth.db",
  "CORS_ORIGINS": ["http://localhost", "http://127.0.0.1"],
  "EXTENSION_ID": "",
  "embedding": {
    "provider": "sentence-transformers",
    "model": "BAAI/bge-m3",
    "base_url": "http://localhost:11434/v1",
    "dimensions": null,
    "api_key": null,
    "timeout": 30,
    "batch_size": 100
  }
}
```

### 配置字段

**服务器设置：**

- `api_key` — 认证密钥（自动生成，供扩展和监控器使用）
- `port` — 服务器端口（默认：8000）
- `host` — 绑定地址（默认：127.0.0.1，使用 0.0.0.0 进行网络访问）
- `LOG_LEVEL` — 日志详细程度（DEBUG、INFO、WARNING、ERROR、CRITICAL）
- `DB_PATH` — LanceDB 存储路径（默认：data/wims.lance）
- `AUTH_DB_PATH` — 认证数据库路径（默认：data/auth.db）
- `CORS_ORIGINS` — 允许的 CORS 源（URL 数组）
- `EXTENSION_ID` — Chrome 扩展 ID（可选，用于更严格的 CORS 控制）

**嵌入配置：**

- `provider` — 嵌入后端：`sentence-transformers`、`fastembed`、`onnx` 或 `openai`
- `model` — 模型名称（HuggingFace 模型 ID 或 API 模型名称）
- `base_url` — API 端点（仅用于 `openai` provider，支持 Ollama 和 OpenAI 兼容服务器）
- `dimensions` — 向量维度（如果为 null 则自动检测，需要时可覆盖）
- `api_key` — 外部提供商的 API 密钥（本地模型为 null）
- `timeout` — 请求超时（秒）（默认：30）
- `batch_size` — API 提供商的批处理大小（默认：100）

### 热重载

配置更改无需重启服务器即可立即生效。只需编辑 `~/.wims/server.json` 并保存。

### 嵌入提供商

WIMS 支持多种嵌入后端。详细的提供商设置、模型推荐和性能比较，请参见 [docs/embedding-providers.md](docs/embedding-providers.md)。

**快速比较：**

- `sentence-transformers`（默认）— 最佳质量，支持 GPU 加速（如果可用），~1024 维
- `fastembed` — 快速 CPU 推理，适合资源受限环境
- `onnx` — 优化运行时，最快的 CPU 性能（需要 `optimum[onnxruntime]`）
- `openai` — 使用外部 API（Ollama、OpenAI、远程 GPU 服务器）

---

## 命令行工具

### 启动服务器

```bash
uv run python -m src.cli start
```

使用默认设置启动 WIMS 服务器。

### 检查迁移状态

```bash
uv run python -m src.cli reembed --status
```

检查嵌入迁移状态（显示总数、已迁移和剩余文档）。

### 重新嵌入文档

```bash
uv run python -m src.cli reembed
```

使用 `server.json` 中配置的当前嵌入模型重新嵌入所有文档。在切换模型或升级到更好的嵌入后端时很有用。

**选项：**

- `--batch-size N` — 每批文档数（默认：100）
- `--delay N` — 批次间延迟秒数（默认：0.5）
- `--status` — 仅显示迁移状态，不重新嵌入
- `--promote` — 强制将 v2 向量提升到 v1，无需重新嵌入

### 后台自动恢复

如果检测到未完成的迁移，重新嵌入会在服务器启动时自动恢复。你可以使用 `--status` 监控进度。

### 提升已迁移向量

```bash
uv run python -m src.cli reembed --promote
```

手动将 v2 向量提升到 v1 并清理迁移列。通常在迁移完成时自动发生，但此标志允许在恢复场景中手动控制。

### 完整 CLI 参考

详细示例、高级用法和故障排除，请参见 [docs/cli-reference.md](docs/cli-reference.md)。

---

## 使用示例

### 基本搜索工作流

1. **安装并启动服务器：**
   ```bash
   ./setup.sh && ./start.sh
   ```

2. **安装 Chrome 扩展**（见上文"浏览器扩展设置"）

3. **在 ChatGPT、Claude、Gemini 或 Perplexity 上进行对话**

4. **搜索你的对话：**
   - 打开 http://localhost:8000
   - 输入查询（例如，"python asyncio debugging"）
   - 结果显示相关性分数和来源徽章
   - 点击"查看原文"跳转回对话

### 按来源过滤

**快捷预设：**
- "Web 聊天" — 仅 ChatGPT、Claude、Gemini、Perplexity
- "开发会话" — 仅 Claude Code、Cursor
- "全部来源" — 所有内容

**自定义过滤：**
- 点击平台徽章切换单个来源
- URL 自动更新以便分享链接

### 时间线浏览

按时间顺序浏览对话：

1. 点击导航中的"浏览"
2. 选择日期范围（今天、本周、本月、全部时间）
3. 结果按时间线分组（今天、昨天、本周等）
4. 浏览时按来源过滤

### 切换嵌入模型

要升级到更好的嵌入模型：

1. **编辑配置：**
   ```bash
   nano ~/.wims/server.json
   ```

2. **更新嵌入部分：**
   ```json
   "embedding": {
     "provider": "sentence-transformers",
     "model": "BAAI/bge-m3"
   }
   ```

3. **重新嵌入文档：**
   ```bash
   uv run python -m src.cli reembed
   ```

4. **监控进度：**
   ```bash
   uv run python -m src.cli reembed --status
   ```

迁移使用双列方法（v1 和 v2 向量）在后台运行。完成后，v2 自动提升到 v1。

### 使用外部嵌入 API

通过 Ollama 或 OpenAI 兼容端点使用 GPU 加速嵌入：

1. **启动嵌入服务器**（例如，Ollama）：
   ```bash
   ollama serve
   ollama pull nomic-embed-text
   ```

2. **更新配置：**
   ```json
   "embedding": {
     "provider": "openai",
     "model": "nomic-embed-text",
     "base_url": "http://localhost:11434/v1",
     "dimensions": 768
   }
   ```

3. **重启服务器** — 配置更改立即生效

---

## 数据库管理

### 存储位置

默认情况下，数据存储在项目目录中：
- LanceDB: `data/wims.lance/`
- 认证数据库: `data/auth.db`

要使用自定义位置，请编辑 `~/.wims/server.json` 中的 `DB_PATH`。

### 备份和恢复

**备份：**
```bash
# 首先停止服务器
tar -czf wims-backup-$(date +%Y%m%d).tar.gz data/
```

**恢复：**
```bash
# 首先停止服务器
tar -xzf wims-backup-20260215.tar.gz
./start.sh
```

### 数据库维护

LanceDB 在每 100 次写入时自动压缩（可配置）。无需手动维护。

**检查数据库大小：**
```bash
du -sh data/wims.lance/
```

**查看数据库统计：**

访问 http://localhost:8000/docs 并使用 `/api/v1/stats` 端点（即将推出）。

---

## 故障排除

### 服务器无法启动

**端口已被占用：**
```
Error: Port 8000 on 127.0.0.1 is already in use.
```

解决方案：停止现有服务器或使用不同端口：
```bash
uv run python -m src.cli start --port 8001
```

**缺少依赖：**
```
ImportError: No module named 'fastapi'
```

解决方案：重新运行设置：
```bash
./setup.sh
```

### 扩展不捕获对话

**检查扩展权限：**
1. 打开 `chrome://extensions`
2. 找到 WIMS
3. 确保它对 AI 平台网站有权限

**检查服务器连接：**
1. 打开扩展选项
2. 验证服务器 URL 正确（例如，`http://localhost:8000`）
3. 使用内置测试按钮测试连接

**检查 API 密钥：**

确保扩展选项中的 API 密钥与 `~/.wims/server.json` 中的匹配。

### 搜索无结果

**检查数据库是否有数据：**
```bash
# 通过检查服务器日志验证获取是否正常工作
grep "Ingested" logs/wims.log
```

**重新下载嵌入模型：**
```bash
./setup.sh
```

**验证 API 密钥匹配**扩展/监控器和 `~/.wims/server.json` 之间。

### 监控器不索引开发会话

**检查监控器日志：**
```bash
journalctl -u wims-watcher -f    # systemd 服务
python -m wims-watcher.src.main   # 前台模式
```

监控器会自动在标准位置发现 Claude Code 和 Cursor 日志。如果日志在其他位置，请在监控器配置中配置自定义路径。

### 搜索质量差

**尝试更好的嵌入模型：**

默认的 `BAAI/bge-m3` 是多语言且高质量的。对于纯英文内容，可以考虑：
- `sentence-transformers/all-mpnet-base-v2`（768d，非常好的质量）
- `sentence-transformers/all-MiniLM-L12-v2`（384d，更快，仍然不错）

参见 [docs/embedding-providers.md](docs/embedding-providers.md) 以获取推荐。

**配置更改后重新嵌入：**
```bash
uv run python -m src.cli reembed
```

### 迁移卡住或失败

**检查迁移状态：**
```bash
uv run python -m src.cli reembed --status
```

**强制提升以恢复：**
```bash
uv run python -m src.cli reembed --promote
```

这将提升任何已完成的 v2 向量到 v1 并清理迁移状态。

**启动全新迁移：**
```bash
# 如果迁移已损坏，只需重新启动
uv run python -m src.cli reembed
```

迁移系统是幂等的 — 重新运行是安全的。

---

## 架构

WIMS 使用混合搜索架构，结合向量相似度和全文搜索：

**后端：** FastAPI + LanceDB（向量数据库）+ sentence-transformers（嵌入）

**前端：** React + TanStack Query + Vite

**数据流：** 扩展/监控器 → 获取 API → 嵌入 → LanceDB → 搜索/浏览 API → UI

---

## 开发

### 运行测试

```bash
uv pip install -e ".[dev]"
uv run pytest
```

### 代码质量

```bash
uv run ruff check src/ tests/    # 检查
uv run ruff check --fix src/     # 自动修复
```

---

## 贡献

这目前是一个个人项目。如果你发现错误或有功能想法，欢迎在 GitHub 上开启 issue。

---

## 许可证

本项目采用 MIT 许可证。详情请参见 [LICENSE](LICENSE) 文件。

---

**专为经常找不到 AI 对话的开发者打造。**

WIMS 是一个本地优先、注重隐私的工具，旨在消除跨 AI 平台丢失上下文的挫败感。无云端依赖，无订阅费用 — 只是一个把一件事做好的简单工具。
