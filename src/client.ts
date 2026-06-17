import { logger } from './logger';

/**
 * Stream event types from Claude Code CLI's stream-json output format.
 */
export interface ClaudeStreamEvent {
    type: string;
    subtype?: string;
    message?: {
        id: string;
        type: string;
        role: string;
        model: string;
        content: Array<{
            type: string;
            text?: string;
            thinking?: string;
            signature?: string;
        }>;
        usage?: {
            input_tokens: number;
            output_tokens: number;
        };
    };
    result?: string;
    is_error?: boolean;
    stop_reason?: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
    };
    session_id?: string;
    [key: string]: unknown;
}

export interface ClaudeMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface StreamCallbacks {
    onContent: (text: string) => void;
    onThinking: (text: string) => void;
    onToolCall?: (toolCall: { id: string; name: string; arguments: Record<string, unknown> }) => void;
    onError: (error: Error) => void;
    onDone: () => void;
    onUsage?: (usage: { input_tokens: number; output_tokens: number }) => void;
}

export interface ClaudeClientOptions {
    cliPath?: string;
    model?: string;
    permissionMode?: string;
    cwd?: string;
}

/**
 * Client for interacting with Claude Code CLI using stream-json output format.
 */
export class ClaudeCodeClient {
    private cliPath: string;
    private model?: string;
    private permissionMode: string;
    private cwd?: string;

    constructor(options: ClaudeClientOptions = {}) {
        this.cliPath = options.cliPath || 'claude';
        this.model = options.model;
        this.permissionMode = options.permissionMode || 'default';
        this.cwd = options.cwd;
    }

    /**
     * Stream a chat response from Claude Code CLI.
     * Uses `claude -p --output-format stream-json --verbose` for non-interactive streaming output.
     */
    async streamChat(
        messages: ClaudeMessage[],
        callbacks: StreamCallbacks,
        cancellationToken?: { isCancellationRequested: boolean; onCancellationRequested?: (listener: () => void) => { dispose: () => void } }
    ): Promise<void> {
        const { spawn } = require('child_process');
        const path = require('path');

        // Build the prompt from messages
        const prompt = this.buildPrompt(messages);

        // Build CLI arguments
        const args: string[] = [
            '-p', prompt,
            '--output-format', 'stream-json',
            '--verbose'
        ];

        if (this.model) {
            args.push('--model', this.model);
        }

        if (this.permissionMode && this.permissionMode !== 'default') {
            args.push('--permission-mode', this.permissionMode);
        }

        logger.info(`Spawning Claude CLI: ${this.cliPath} ${args.slice(0, 5).join(' ')}...`);

        const options: Record<string, unknown> = {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env }
        };

        if (this.cwd) {
            options.cwd = this.cwd;
        }

        const child = spawn(this.cliPath, args, options);

        let cancelled = false;
        const cancelListener = cancellationToken?.onCancellationRequested?.(() => {
            cancelled = true;
            child.kill('SIGTERM');
        });

        return new Promise<void>((resolve, reject) => {
            let stdoutBuffer = '';
            let stderrBuffer = '';

            child.stdout.on('data', (data: Buffer) => {
                stdoutBuffer += data.toString();
                const lines = stdoutBuffer.split('\n');
                stdoutBuffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        continue;
                    }

                    try {
                        const event: ClaudeStreamEvent = JSON.parse(trimmed);
                        this.processEvent(event, callbacks);
                    } catch (e) {
                        logger.warn('Failed to parse stream event:', trimmed.substring(0, 200));
                    }
                }
            });

            child.stderr.on('data', (data: Buffer) => {
                stderrBuffer += data.toString();
            });

            child.on('close', (code: number | null) => {
                cancelListener?.dispose();

                // Process any remaining stdout
                if (stdoutBuffer.trim()) {
                    try {
                        const event: ClaudeStreamEvent = JSON.parse(stdoutBuffer.trim());
                        this.processEvent(event, callbacks);
                    } catch (e) {
                        // Ignore parse errors for remaining buffer
                    }
                }

                if (cancelled) {
                    callbacks.onDone();
                    resolve();
                    return;
                }

                if (code !== 0 && code !== null) {
                    const errorMsg = stderrBuffer.trim() || `Claude CLI exited with code ${code}`;
                    logger.error(`Claude CLI error (exit ${code}): ${errorMsg}`);
                    callbacks.onError(new Error(errorMsg));
                    reject(new Error(errorMsg));
                    return;
                }

                callbacks.onDone();
                resolve();
            });

            child.on('error', (error: Error) => {
                cancelListener?.dispose();
                logger.error('Failed to spawn Claude CLI:', error.message);
                callbacks.onError(error);
                reject(error);
            });
        });
    }

    /**
     * Process a single stream event from Claude Code CLI.
     */
    private processEvent(event: ClaudeStreamEvent, callbacks: StreamCallbacks): void {
        switch (event.type) {
            case 'assistant':
                if (event.message?.content) {
                    for (const part of event.message.content) {
                        if (part.type === 'text' && part.text) {
                            callbacks.onContent(part.text);
                        } else if (part.type === 'thinking' && part.thinking) {
                            callbacks.onThinking(part.thinking);
                        }
                    }
                }
                break;

            case 'result':
                if (event.is_error) {
                    callbacks.onError(new Error(event.result || 'Unknown error from Claude CLI'));
                }
                if (event.usage) {
                    callbacks.onUsage?.({
                        input_tokens: event.usage.input_tokens,
                        output_tokens: event.usage.output_tokens
                    });
                }
                break;

            case 'system':
                // System events (init, thinking_tokens, hooks) - log but don't process
                if (event.subtype === 'init') {
                    logger.info('Claude CLI session initialized:', event.session_id);
                }
                break;

            default:
                // Other event types - ignore
                break;
        }
    }

    /**
     * Build a prompt string from an array of messages.
     */
    private buildPrompt(messages: ClaudeMessage[]): string {
        // If there's only one user message, use it directly
        if (messages.length === 1 && messages[0].role === 'user') {
            return messages[0].content;
        }

        // Otherwise, format as a conversation
        const parts: string[] = [];
        for (const msg of messages) {
            if (msg.role === 'system') {
                parts.push(`[System]: ${msg.content}`);
            } else if (msg.role === 'user') {
                parts.push(`[User]: ${msg.content}`);
            } else if (msg.role === 'assistant') {
                parts.push(`[Assistant]: ${msg.content}`);
            }
        }
        return parts.join('\n\n');
    }

    /**
     * Check if Claude Code CLI is available and working.
     */
    async checkStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
        const { spawn } = require('child_process');

        return new Promise((resolve) => {
            const child = spawn(this.cliPath, ['--version'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            child.on('close', (code: number | null) => {
                if (code === 0) {
                    const version = stdout.trim().split('\n')[0];
                    resolve({ available: true, version });
                } else {
                    resolve({
                        available: false,
                        error: stderr.trim() || `CLI exited with code ${code}`
                    });
                }
            });

            child.on('error', (error: Error) => {
                resolve({
                    available: false,
                    error: error.message
                });
            });
        });
    }
}
