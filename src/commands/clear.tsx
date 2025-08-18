// src/commands/clear.tsx
import figures from 'figures';
import { terminal } from 'terminal-kit';
import { Branding } from '../components/Branding.js';
import { clearBuildLogs, resetConfig } from '../utils/config.js';
import { findProjectRoot } from '../utils/findProjectRoot.js';
const clearOptions = [
  { label: 'Clear local build logs', value: 'local' },
  { label: 'Clear shared build logs', value: 'shared' },
  { label: 'Reset config and logs to initial defaults', value: 'full_reset' },
];

export default async function Clear() {
  const term = terminal;

  try {
    // Initialize branding
    const branding = new Branding(term, { subtitle: '🧹 Maintenance' });
    branding.mount();

    const projectRoot = await findProjectRoot();

    await showInteractiveSelection(projectRoot, term);
  } catch (error) {
    term('\n');
    term.red('❌ Error accessing project:\n');
    term.red(error instanceof Error ? error.message : String(error));
    term('\n');
    process.exit(1);
  }
}

async function handleClearAction(value: string, projectRoot: string, term: any): Promise<void> {
  try {
    term('\n');
    term.yellow('⏳ Processing...\n');

    switch (value) {
      case 'local':
        await clearBuildLogs(projectRoot, 'local');
        term.green(`${figures.tick} Cleared local build logs\n`);
        break;
      case 'shared':
        await clearBuildLogs(projectRoot, 'shared');
        term.green(`${figures.tick} Cleared shared build logs\n`);
        break;
      case 'full_reset':
        await resetConfig(projectRoot);
        await clearBuildLogs(projectRoot, 'both');
        term.green(`${figures.tick} Reset config and cleared all build logs\n`);
        break;
      default:
        throw new Error('Invalid option');
    }

    term.green(`${figures.tick} Reset complete\n`);
    process.exit(0);
  } catch (err) {
    term('\n');
    term.red(
      `${figures.cross} Failed to clear: ${err instanceof Error ? err.message : String(err)}\n`
    );
    process.exit(1);
  }
}

async function showInteractiveSelection(projectRoot: string, term: any): Promise<void> {
  let currentIndex = 0;

  function renderScreen() {
    term.clear();

    // Render branding again
    const branding = new Branding(term, { subtitle: '🧹 Maintenance' });
    branding.mount();

    term('\n');
    term('Select what to clear:\n\n');

    clearOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const prefix = isCurrent ? '▶ ' : '  ';

      if (isCurrent) {
        term.cyan.bold(`${prefix}${option.label}\n`);
      } else {
        term(`${prefix}${option.label}\n`);
      }
    });

    // Controls
    term('\n');
    term.dim('Use arrow keys to navigate, Enter to select, q to quit\n');
  }

  // Set up keyboard input handling
  term.grabInput();
  term.on('key', async (key: string) => {
    if (key === 'q' || key === 'CTRL_C') {
      term.processExit(0);
    } else if (key === 'UP') {
      currentIndex = Math.max(0, currentIndex - 1);
      renderScreen();
    } else if (key === 'DOWN') {
      currentIndex = Math.min(clearOptions.length - 1, currentIndex + 1);
      renderScreen();
    } else if (key === 'ENTER') {
      const selectedOption = clearOptions[currentIndex];
      if (selectedOption) {
        await handleClearAction(selectedOption.value, projectRoot, term);
      }
    }
  });

  // Initial render
  renderScreen();

  // Keep the process alive
  process.on('SIGINT', () => {
    term.processExit(0);
  });
}
