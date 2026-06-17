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
            id?: string;
            name?: string;
            input?: Record<string, unknown>;
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
    delta?: {
        text?: string;
        thinking?: string;
        partial_json?: string;
    };
    content_block?: {
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
    };
    hook_name?: string;
    hook_event?: string;
    direction?: string;
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
    /** Use interactive stdin mode (default: true) to enable plugins and hooks.
     * Set to false to use `-p` print mode (faster, but no plugin/hook support). */
    interactiveMode?: boolean;
}

/**
 * Client for interacting with Claude Code CLI using stream-json output format.
 *
 * Two execution modes are supported:
 * - **Interactive stdin mode** (default): Spawns Claude Code without `-p`, writes the prompt
 *   to stdin, and reads stream-json from stdout. This mode loads plugins and fires lifecycle
 *   hooks (SessionStart, Stop, PreCompact, etc.), enabling integrations like nowledge-mem.
 * - **Print mode** (`interactiveMode: false`): Uses `claude -p` for lightweight one-shot
 *   queries. Faster startup but plugins and hooks are not loaded.
 */
export class ClaudeCodeClient {
    private cliPath: string;
    private model?: string;
    private permissionMode: string;
    private cwd?: string;
    private interactiveMode: boolean;

    constructor(options: ClaudeClientOptions = {}) {
        this.cliPath = options.cliPath || 'claude';
        this.model = options.model;
        this.permissionMode = options.permissionMode || 'acceptEdits';
        this.cwd = options.cwd;
        this.interactiveMode = options.interactiveMode !== undefined ? options.interactiveMode : true;
    }

    /**
     * Stream a chat response from Claude Code CLI.
     *
     * In interactive mode (default), uses stdin-based communication so Claude Code
     * loads plugins and fires hooks (e.g. nowledge-mem SessionStart/Stop).
     * In print mode, uses `claude -p` for fast one-shot queries.
     */
    async streamChat(
        messages: ClaudeMessage[],
        callbacks: StreamCallbacks,
        cancellationToken?: { isCancellationRequested: boolean; onCancellationRequested?: (listener: () => void) => { dispose: () => void } }
    ): Promise<void> {
        if (this.interactiveMode) {
            return this.streamChatInteractive(messages, callbacks, cancellationToken);
        }
        return this.streamChatPrint(messages, callbacks, cancellationToken);
    }

    /**
     * Interactive stdin mode: spawns `claude --output-format stream-json --verbose`,
     * writes the prompt to stdin, closes stdin, and reads response events.
     * This enables plugins and lifecycle hooks (SessionStart, Stop, PreCompact).
     */
    private async streamChatInteractive(
        messages: ClaudeMessage[],
        callbacks: StreamCallbacks,
        cancellationToken?: { isCancellationRequested: boolean; onCancellationRequested?: (listener: () => void) => { dispose: () => void } }
    ): Promise<void> {
        const { spawn } = require('child_process');

        const prompt = this.buildPrompt(messages);

        // Build CLI args for interactive mode — no `-p` flag so plugins load
        const args: string[] = [
            '--output-format', 'stream-json',
            '--verbose',
            '--include-hook-events'
        ];

        if (this.model) {
            args.push('--model', this.model);
        }

        if (this.permissionMode && this.permissionMode !== 'default') {
            args.push('--permission-mode', this.permissionMode);
        }

        logger.info(`Spawning Claude CLI (interactive stdin): ${this.cliPath} ${args.join(' ')}`);

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

        // Write prompt to stdin and close it so Claude knows input is complete
        child.stdin.write(prompt);
        child.stdin.end();

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
                    } catch (_e) {
                        // Interactive mode may emit non-JSON lines (welcome banners, etc.)
                        logger.info('Non-JSON stdout line:', trimmed.substring(0, 200));
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
                    } catch (_e) {
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
     * Print mode: uses `claude -p` for fast non-interactive one-shot queries.
     * Plugins and hooks are NOT loaded in this mode.
     */
    private async streamChatPrint(
        messages: ClaudeMessage[],
        callbacks: StreamCallbacks,
        cancellationToken?: { isCancellationRequested: boolean; onCancellationRequested?: (listener: () => void) => { dispose: () => void } }
    ): Promise<void> {
        const { spawn } = require('child_process');

        const prompt = this.buildPrompt(messages);

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

        logger.info(`Spawning Claude CLI (print mode): ${this.cliPath} ${args.slice(0, 5).join(' ')}...`);

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
                    } catch (_e) {
                        logger.warn('Failed to parse stream event:', trimmed.substring(0, 200));
                    }
                }
            });

            child.stderr.on('data', (data: Buffer) => {
                stderrBuffer += data.toString();
            });

            child.on('close', (code: number | null) => {
                cancelListener?.dispose();

                if (stdoutBuffer.trim()) {
                    try {
                        const event: ClaudeStreamEvent = JSON.parse(stdoutBuffer.trim());
                        this.processEvent(event, callbacks);
                    } catch (_e) {
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
     * Handles assistant messages, results, system events (including hooks),
     * and content block streaming events.
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
                        } else if (part.type === 'tool_use') {
                            // Tool use within assistant content block
                            const toolId = part.id || '';
                            const toolName = part.name || 'unknown';
                            const toolInput = part.input || {};
                            if (toolId && callbacks.onToolCall) {
                                callbacks.onToolCall({
                                    id: toolId,
                                    name: toolName,
                                    arguments: toolInput
                                });
                            }
                        }
                    }
                }
                break;

            case 'content_block_start':
                if (event.subtype === 'tool_use' && callbacks.onToolCall) {
                    const block = event.content_block || {};
                    callbacks.onToolCall({
                        id: block.id || '',
                        name: block.name || 'unknown',
                        arguments: block.input || {}
                    });
                }
                break;

            case 'content_block_delta':
                if (event.subtype === 'text_delta' && event.delta?.text) {
                    callbacks.onContent(event.delta.text);
                } else if (event.subtype === 'thinking_delta' && event.delta?.thinking) {
                    callbacks.onThinking(event.delta.thinking);
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
                if (event.subtype === 'init') {
                    logger.info('Claude CLI session initialized:', event.session_id);
                } else if (event.subtype === 'hook') {
                    logger.info('Claude CLI hook event:', event.hook_name, event.hook_event);
                }
                break;

            case 'hook':
                logger.info('Claude CLI hook:', event.hook_name, event.hook_event, event.direction);
                break;

            case 'user':
                // User message confirmation in stream-json
                break;

            case 'stream_event':
            case 'ping':
                // Internal protocol events — ignore
                break;

            default:
                // Other event types — log for debugging
                logger.info('Unknown stream event type:', event.type);
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
