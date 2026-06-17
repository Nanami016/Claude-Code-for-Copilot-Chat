import * as vscode from 'vscode';

class Logger {
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Claude Code for Copilot');
    }

    info(message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[INFO ${timestamp}] ${message}`);
        if (args.length > 0) {
            this.outputChannel.appendLine(`  ${JSON.stringify(args)}`);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[WARN ${timestamp}] ${message}`);
        if (args.length > 0) {
            this.outputChannel.appendLine(`  ${JSON.stringify(args)}`);
        }
    }

    error(message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[ERROR ${timestamp}] ${message}`);
        if (args.length > 0) {
            this.outputChannel.appendLine(`  ${JSON.stringify(args)}`);
        }
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}

export const logger = new Logger();
