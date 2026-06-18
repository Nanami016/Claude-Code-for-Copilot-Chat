[English](README.en.md) | [简体中文](../../README.md) | [日本語](README.ja.md)

# Claude Code CLI

Use [Claude Code CLI](https://claude.com/claude-code) directly in GitHub Copilot Chat. Zero configuration — just reuse your existing Claude Code installation.

## Features

- **Direct CLI Integration**: Stream responses in real-time via `claude` command + `--output-format stream-json`
- **Thinking Process Display**: Shows Claude's reasoning and thinking process
- **Tool Calling**: Supports Claude Code's tool calling capabilities
- **Zero Configuration**: Works out of the box if Claude Code CLI is installed
- **Million-Token Context**: 1,000,000 token input context window

## Prerequisites

- [Claude Code CLI](https://claude.com/claude-code) installed and available in PATH (`claude` command)
- VS Code 1.116.0 or later
- GitHub Copilot Chat extension

## Installation

### Option 1: Install via VSIX (Recommended)

1. Download the latest `.vsix` from [Releases](https://github.com/Nanami016/Claude-Code-for-Copilot-Chat/releases)
2. Install:
   ```bash
   code --install-extension claude-code-for-copilot-*.vsix
   ```
3. Reload VS Code (`Cmd+Shift+P` → `Reload Window`)

### Option 2: Build from Source

```bash
git clone https://github.com/Nanami016/Claude-Code-for-Copilot-Chat.git
cd Claude-Code-for-Copilot-Chat
npm install
npm run compile
npm run package -- --allow-missing-repository
code --install-extension claude-code-for-copilot-*.vsix
```

## Usage

1. Open GitHub Copilot Chat (`Cmd+Shift+I` or click the Chat icon in the sidebar)
2. Click the **model picker** at the top of the Chat panel
3. Select **Claude Code CLI**
4. Start chatting!

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `claude-code-copilot.cliPath` | `claude` | Path to the Claude Code CLI executable |
| `claude-code-copilot.defaultModel` | (empty) | Default Claude model (leave empty for CLI default) |
| `claude-code-copilot.permissionMode` | `default` | Permission mode: `default`, `acceptEdits`, or `plan` |

## Commands

- **Claude Code: Show Logs** — View extension logs
- **Claude Code: Check CLI Status** — Check if Claude Code CLI is available

## How It Works

This extension registers as a model provider via VS Code's `LanguageModelChatProvider` API, making Claude Code appear as a model option in GitHub Copilot Chat. When you send a message, the extension:

1. Converts chat messages into Claude Code format
2. Invokes `claude -p --output-format stream-json --verbose`
3. Streams the response back to VS Code in real-time

## FAQ

### Claude Code CLI not showing in the model picker

1. Check if Claude Code CLI is installed: `claude --version`
2. Run "Claude Code: Check CLI Status" from the Command Palette
3. View logs via "Claude Code: Show Logs"

### Errors when responding

1. Verify Claude Code CLI works standalone: `claude -p "Hello"`
2. Check your API Key or authentication configuration
3. Ensure the `cliPath` setting points to the correct executable

## License

MIT
