[English](README.en.md) | [简体中文](../../README.md) | 日本語

# Claude Code CLI

GitHub Copilot Chat で [Claude Code CLI](https://claude.com/claude-code) を直接使用。設定不要、既存の Claude Code インストールをそのまま活用できます。

## 機能

- **CLI 直接呼び出し**：`claude` コマンド + `--output-format stream-json` によるリアルタイムストリーミング
- **思考過程表示**：Claude の推論・思考過程を表示
- **ツール呼び出し**：Claude Code のツール呼び出し機能をサポート
- **設定不要**：Claude Code CLI がインストールされていればそのまま使用可能
- **100万トークンコンテキスト**：1,000,000 トークンの入力コンテキストウィンドウ

## 必要条件

- [Claude Code CLI](https://claude.com/claude-code) がインストールされ、PATH で `claude` コマンドが使用可能
- VS Code 1.116.0 以上
- GitHub Copilot Chat 拡張機能

## インストール方法

### 方法1：VSIX でインストール（推奨）

1. [Releases](https://github.com/Nanami016/Claude-Code-for-Copilot-Chat/releases) から最新の `.vsix` ファイルをダウンロード
2. インストール：
   ```bash
   code --install-extension claude-code-for-copilot-*.vsix
   ```
3. VS Code をリロード（`Cmd+Shift+P` → `Reload Window`）

### 方法2：ソースからビルド

```bash
git clone https://github.com/Nanami016/Claude-Code-for-Copilot-Chat.git
cd Claude-Code-for-Copilot-Chat
npm install
npm run compile
npm run package -- --allow-missing-repository
code --install-extension claude-code-for-copilot-*.vsix
```

## 使い方

1. GitHub Copilot Chat を開く（`Cmd+Shift+I` またはサイドバーの Chat アイコンをクリック）
2. Chat 上部の**モデルセレクター**をクリック
3. **Claude Code CLI** を選択
4. 対話を開始！

## 設定項目

| 設定名 | デフォルト | 説明 |
|--------|-----------|------|
| `claude-code-copilot.cliPath` | `claude` | Claude Code CLI 実行ファイルのパス |
| `claude-code-copilot.defaultModel` | （空） | デフォルトの Claude モデル（空の場合は CLI のデフォルトを使用） |
| `claude-code-copilot.permissionMode` | `default` | 権限モード：`default`、`acceptEdits`、`plan` |

## コマンド

- **Claude Code: Show Logs** — 拡張機能のログを表示
- **Claude Code: Check CLI Status** — Claude Code CLI が利用可能か確認

## 仕組み

本拡張機能は VS Code の `LanguageModelChatProvider` API を通じてモデルプロバイダーとして登録され、Claude Code を GitHub Copilot Chat のモデルオプションとして表示します。メッセージ送信時に：

1. チャットメッセージを Claude Code 形式に変換
2. `claude -p --output-format stream-json --verbose` を実行
3. レスポンスを VS Code にリアルタイムでストリーミング

## トラブルシューティング

### モモデルセレクターに Claude Code CLI が表示されない

1. Claude Code CLI がインストールされているか確認：`claude --version`
2. コマンドパレットで "Claude Code: Check CLI Status" を実行
3. ログを確認："Claude Code: Show Logs"

### レスポンス中にエラーが発生する

1. Claude Code CLI が単独で動作するか確認：`claude -p "Hello"`
2. API Key または認証設定を確認
3. `cliPath` 設定が正しい実行ファイルを指しているか確認

## ライセンス

MIT
