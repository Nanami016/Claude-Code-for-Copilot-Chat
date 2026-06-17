# CC-Switch

Use [Claude Code CLI](https://claude.com/claude-code) directly in GitHub Copilot Chat. Zero configuration — uses your existing Claude Code installation.

## Features

- **Direct CLI Integration**: Uses `claude` CLI with `--output-format stream-json` for real-time streaming
- **Thinking Support**: Displays Claude's thinking/reasoning process
- **Tool Calling**: Supports Claude Code's tool calling capabilities
- **Zero Config**: Works out of the box if you have Claude Code CLI installed
- **1M Context**: 1,000,000 token input context window

## Requirements

- [Claude Code CLI](https://claude.com/claude-code) installed and available in PATH
- VS Code 1.116.0 or higher
- GitHub Copilot Chat extension

## Installation

### Option 1: Install from VSIX (recommended)

1. Download the latest `.vsix` file from [Releases](https://github.com/Nanami016/Claude-Code-for-Copilot-Chat/releases)
2. Install:
   ```bash
   code --install-extension claude-code-for-copilot-*.vsix
   ```
3. Reload VS Code (`Cmd+Shift+P` → `Reload Window`)

### Option 2: Build from source

```bash
git clone https://github.com/Nanami016/Claude-Code-for-Copilot-Chat.git
cd Claude-Code-for-Copilot-Chat
npm install
npm run compile
npm run package -- --allow-missing-repository
code --install-extension claude-code-for-copilot-*.vsix
```

## Usage

1. Open GitHub Copilot Chat (`Cmd+Shift+I` or click the Chat icon)
2. Click the **model selector** at the top of the chat
3. Select **CC-Switch** from the list
4. Start chatting!

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `claude-code-copilot.cliPath` | `claude` | Path to the Claude Code CLI executable |
| `claude-code-copilot.defaultModel` | (empty) | Default Claude model to use (leave empty for CLI default) |
| `claude-code-copilot.permissionMode` | `default` | Permission mode: `default`, `acceptEdits`, or `plan` |

## Commands

- **Claude Code: Show Logs** — Show the extension's output logs
- **Claude Code: Check CLI Status** — Verify Claude Code CLI is working

## How It Works

This extension registers as a `LanguageModelChatProvider` in VS Code, making Claude Code appear as a model option in GitHub Copilot Chat. When you send a message, it:

1. Converts the chat messages to Claude Code format
2. Spawns `claude -p --output-format stream-json --verbose`
3. Streams the response back to VS Code in real-time

## Troubleshooting

### CC-Switch not appearing in model picker

1. Check if Claude Code CLI is installed: `claude --version`
2. Run "Claude Code: Check CLI Status" command
3. Check the output logs: "Claude Code: Show Logs"

### Errors during response

1. Make sure Claude Code CLI works standalone: `claude -p "Hello"`
2. Check your API key or authentication
3. Verify the `cliPath` setting points to the correct executable

## License

MIT
