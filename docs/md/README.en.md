[English](docs/md/README.en.md) | 简体中文 | [日本語](docs/md/README.ja.md)

# CC-Switch

在 GitHub Copilot Chat 中直接使用 [Claude Code CLI](https://claude.com/claude-code)。零配置，直接复用你已有的 Claude Code 安装。

## 功能特性

- **直接调用 CLI**：通过 `claude` 命令 + `--output-format stream-json` 实时流式传输
- **思考过程显示**：展示 Claude 的推理/思考过程
- **工具调用**：支持 Claude Code 的工具调用能力
- **零配置**：只要安装了 Claude Code CLI 即可使用
- **百万级上下文**：1,000,000 token 输入上下文窗口

## 前置要求

- 已安装 [Claude Code CLI](https://claude.com/claude-code)，且 `claude` 命令在 PATH 中可用
- VS Code 1.116.0 或更高版本
- GitHub Copilot Chat 扩展

## 安装方式

### 方式一：通过 VSIX 安装（推荐）

1. 从 [Releases](https://github.com/Nanami016/Claude-Code-for-Copilot-Chat/releases) 下载最新的 `.vsix` 文件
2. 安装：
   ```bash
   code --install-extension claude-code-for-copilot-*.vsix
   ```
3. 重载 VS Code（`Cmd+Shift+P` → `Reload Window`）

### 方式二：从源码构建

```bash
git clone https://github.com/Nanami016/Claude-Code-for-Copilot-Chat.git
cd Claude-Code-for-Copilot-Chat
npm install
npm run compile
npm run package -- --allow-missing-repository
code --install-extension claude-code-for-copilot-*.vsix
```

## 使用方法

1. 打开 GitHub Copilot Chat（`Cmd+Shift+I` 或点击侧边栏 Chat 图标）
2. 点击 Chat 顶部的**模型选择器**
3. 选择 **CC-Switch**
4. 开始对话！

## 配置项

| 设置项 | 默认值 | 说明 |
|--------|--------|------|
| `claude-code-copilot.cliPath` | `claude` | Claude Code CLI 可执行文件路径 |
| `claude-code-copilot.defaultModel` | （空） | 默认使用的 Claude 模型（留空使用 CLI 默认值） |
| `claude-code-copilot.permissionMode` | `default` | 权限模式：`default`、`acceptEdits` 或 `plan` |

## 命令

- **Claude Code: Show Logs** — 查看扩展日志
- **Claude Code: Check CLI Status** — 检查 Claude Code CLI 是否可用

## 工作原理

本扩展通过 VS Code 的 `LanguageModelChatProvider` API 注册为模型提供者，使 Claude Code 作为模型选项出现在 GitHub Copilot Chat 中。发送消息时，扩展会：

1. 将聊天消息转换为 Claude Code 格式
2. 调用 `claude -p --output-format stream-json --verbose`
3. 将响应实时流式传输回 VS Code

## 常见问题

### 模型选择器中没有 CC-Switch

1. 检查 Claude Code CLI 是否已安装：`claude --version`
2. 运行命令面板中的 "Claude Code: Check CLI Status"
3. 查看日志："Claude Code: Show Logs"

### 响应时出错

1. 确认 Claude Code CLI 能独立运行：`claude -p "Hello"`
2. 检查你的 API Key 或认证配置
3. 确认 `cliPath` 设置指向正确的可执行文件

## 许可证

MIT
