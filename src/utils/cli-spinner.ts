import ora from 'ora';
import chalk from 'chalk';

export function startSpinner(text: string) {
  return ora({
    text,
    spinner: 'dots',
    color: 'cyan',
  }).start();
}

function convertGerundToPast(text: string): string {
  // Handle common multi-word phrases first
  const special: Record<string, string> = {
    'Setting up': 'Set up',
    'Checking for proof server': 'Proof server ready',
    'Waiting for funds': 'Funds detected',
    'Registering for DUST (if needed)...': 'Registered for DUST',
    'Registering for DUST (if needed)': 'Registered for DUST',
  };
  for (const k of Object.keys(special)) {
    if (text.startsWith(k)) return special[k];
  }

  // Generic gerund -> past tense heuristic (Loading -> Loaded, Syncing -> Synced)
  return text.replace(/\b([A-Za-z]+)ing\b/, (_m, p1) => {
    // handle verbs ending with 'e' like 'Make' -> 'Making' (rare here)
    if (p1.endsWith('e')) return p1 + 'd';
    return p1 + 'ed';
  });
}

export async function withSpinner<T>(text: string, fn: () => Promise<T>, successText?: string): Promise<T> {
  const sp = startSpinner(text);
  try {
    const res = await fn();
    const final = successText ?? convertGerundToPast(text);
    sp.succeed(chalk.green(`${final} ✔`));
    return res;
  } catch (err) {
    sp.fail(chalk.red(`✗ ${text}`));
    throw err;
  }
}

export default { startSpinner, withSpinner };
