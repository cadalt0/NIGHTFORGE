import chalk from 'chalk';
export class Logger {
    static success(message) {
        console.log(chalk.green('✓'), message);
    }
    static error(message, error) {
        console.error(chalk.red('✗'), message);
        if (error) {
            console.error(chalk.red(error.message));
            if (process.env.DEBUG) {
                console.error(error.stack);
            }
        }
    }
    static warn(message) {
        console.warn(chalk.yellow('⚠'), message);
    }
    static info(message) {
        console.log(chalk.blue('ℹ'), message);
    }
    static log(message) {
        console.log(message);
    }
    static header(title) {
        const line = '─'.repeat(60);
        console.log();
        console.log(chalk.cyan('╔' + '═'.repeat(62) + '╗'));
        console.log(chalk.cyan('║'), chalk.bold.white(title.padEnd(60)), chalk.cyan('║'));
        console.log(chalk.cyan('╚' + '═'.repeat(62) + '╝'));
        console.log();
    }
    static section(title) {
        console.log();
        console.log(chalk.cyan(`─── ${title} ${'─'.repeat(60 - title.length - 5)}`));
        console.log();
    }
}
//# sourceMappingURL=logger.js.map