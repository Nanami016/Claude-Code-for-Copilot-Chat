import * as vscode from 'vscode';
import { ClaudeCodeClient, ClaudeMessage } from './client';
import { logger } from './logger';

/**
 * Claude Code Chat Provider — implements vscode.LanguageModelChatProvider so
 * Claude Code models appear directly in the Copilot Chat model picker.
 */
export class ClaudeCodeChatProvider implements vscode.LanguageModelChatProvider {
    private readonly onDidChangeLanguageModelChatInformationEmitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeLanguageModelChatInformation = this.onDidChangeLanguageModelChatInformationEmitter.event;

    private isActive = true;
    private client: ClaudeCodeClient;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.client = this.createClient();

        context.subscriptions.push(
            this.onDidChangeLanguageModelChatInformationEmitter,
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration('claude-code-copilot')) {
                    this.client = this.createClient();
                    this.onDidChangeLanguageModelChatInformationEmitter.fire();
                }
            })
        );
    }

    private createClient(): ClaudeCodeClient {
        const config = vscode.workspace.getConfiguration('claude-code-copilot');
        const cliPath = config.get<string>('cliPath', 'claude');
        const model = config.get<string>('defaultModel', '');
        const permissionMode = config.get<string>('permissionMode', 'default');

        return new ClaudeCodeClient({
            cliPath,
            model: model || undefined,
            permissionMode,
            cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
        });
    }

    // ---- LanguageModelChatProvider ----

    async provideLanguageModelChatInformation(
        _options: vscode.PrepareLanguageModelChatModelOptions,
        _token: vscode.CancellationToken
    ): Promise<vscode.LanguageModelChatInformation[]> {
        if (!this.isActive) {
            return [];
        }

        return [
            {
                id: 'cc-switch',
                name: 'CC-Switch',
                family: 'claude',
                version: '1.0.0',
                detail: 'Claude Code CLI — agentic coding assistant',
                tooltip: 'Uses your local Claude Code CLI installation',
                maxInputTokens: 1000000,
                maxOutputTokens: 32000,
                isBYOK: true,
                isUserSelectable: true,
                capabilities: {
                    toolCalling: true,
                    imageInput: false
                }
            } as any
        ];
    }

    async provideLanguageModelChatResponse(
        modelInfo: vscode.LanguageModelChatInformation,
        messages: readonly vscode.LanguageModelChatRequestMessage[],
        options: vscode.ProvideLanguageModelChatResponseOptions,
        progress: vscode.Progress<vscode.LanguageModelResponsePart>,
        token: vscode.CancellationToken
    ): Promise<void> {
        logger.info(`Processing request for model: ${modelInfo.id}`);

        // Convert VS Code messages to Claude Code format
        const claudeMessages = this.convertMessages(messages);

        return new Promise<void>((resolve, reject) => {
            this.client.streamChat(
                claudeMessages,
                {
                    onContent: (text) => {
                        progress.report(new vscode.LanguageModelTextPart(text));
                    },
                    onThinking: (text) => {
                        // LanguageModelThinkingPart is a proposed API
                        // Use type assertion for compatibility
                        try {
                            progress.report(new (vscode as any).LanguageModelThinkingPart(text));
                        } catch {
                            // Fallback: report thinking as regular text with markers
                            progress.report(new vscode.LanguageModelTextPart(`[Thinking]: ${text}`));
                        }
                    },
                    onToolCall: (toolCall) => {
                        // Tool calls from Claude Code CLI
                        try {
                            progress.report(new vscode.LanguageModelToolCallPart(
                                toolCall.id,
                                toolCall.name,
                                toolCall.arguments
                            ));
                        } catch (e) {
                            logger.warn('Failed to report tool call:', e);
                        }
                    },
                    onError: (error) => {
                        logger.error('Claude Code error:', error.message);
                        reject(error);
                    },
                    onDone: () => {
                        logger.info('Claude Code response completed');
                        resolve();
                    },
                    onUsage: (usage) => {
                        // Report usage data
                        try {
                            progress.report(vscode.LanguageModelDataPart.json(usage, 'usage'));
                        } catch {
                            // Ignore if not supported
                        }
                    }
                },
                token
            );
        });
    }

    async provideTokenCount(
        _modelInfo: vscode.LanguageModelChatInformation,
        text: string | vscode.LanguageModelChatRequestMessage,
        _token: vscode.CancellationToken
    ): Promise<number> {
        // Simple estimation: ~4 chars per token
        if (typeof text === 'string') {
            return Math.max(1, Math.ceil(text.length / 4));
        }

        if (text.content && Array.isArray(text.content)) {
            let total = 0;
            for (const part of text.content) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    total += part.value.length;
                }
            }
            return Math.max(1, Math.ceil(total / 4));
        }

        return 1;
    }

    // ---- Helper methods ----

    private convertMessages(messages: readonly vscode.LanguageModelChatRequestMessage[]): ClaudeMessage[] {
        const result: ClaudeMessage[] = [];

        for (const msg of messages) {
            let content = '';

            if (msg.content && Array.isArray(msg.content)) {
                const textParts: string[] = [];
                for (const part of msg.content) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        textParts.push(part.value);
                    }
                }
                content = textParts.join('\n');
            } else if (typeof msg.content === 'string') {
                content = msg.content;
            }

            if (!content) {
                continue;
            }

            let role: 'user' | 'assistant' | 'system';
            switch (msg.role) {
                case vscode.LanguageModelChatMessageRole.User:
                    role = 'user';
                    break;
                case vscode.LanguageModelChatMessageRole.Assistant:
                    role = 'assistant';
                    break;
                default:
                    role = 'user';
                    break;
            }

            result.push({ role, content });
        }

        return result;
    }

    // ---- Public commands ----

    async checkStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
        return this.client.checkStatus();
    }

    async prepareForDeactivate(): Promise<void> {
        this.isActive = false;
        this.onDidChangeLanguageModelChatInformationEmitter.fire();
    }
}
