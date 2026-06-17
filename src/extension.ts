import * as vscode from 'vscode';
import { ClaudeCodeChatProvider } from './provider';
import { logger } from './logger';

let activeProvider: ClaudeCodeChatProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
    logger.info('Activating Claude Code for Copilot extension');

    try {
        const provider = new ClaudeCodeChatProvider(context);
        activeProvider = provider;

        context.subscriptions.push(
            vscode.commands.registerCommand('claude-code-copilot.showLogs', () => {
                logger.show();
            }),
            vscode.commands.registerCommand('claude-code-copilot.checkStatus', async () => {
                const status = await provider.checkStatus();
                if (status.available) {
                    vscode.window.showInformationMessage(
                        `Claude Code CLI is available. Version: ${status.version}`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `Claude Code CLI is not available: ${status.error}`
                    );
                }
            }),
            vscode.lm.registerLanguageModelChatProvider('claude-code-cli', provider)
        );

        logger.info('Claude Code for Copilot extension activated');
    } catch (error) {
        activeProvider = undefined;
        logger.error('Failed to activate Claude Code extension:', error);
        vscode.window.showErrorMessage(
            'Claude Code for Copilot failed to activate. Run "Claude Code: Show Logs" for details.'
        );
        throw error;
    }
}

export async function deactivate(): Promise<void> {
    try {
        await activeProvider?.prepareForDeactivate();
    } catch (error) {
        logger.warn('Failed to prepare Claude Code provider for deactivate:', error);
    } finally {
        activeProvider = undefined;
        logger.info('Claude Code for Copilot extension deactivated');
        logger.dispose();
    }
}
