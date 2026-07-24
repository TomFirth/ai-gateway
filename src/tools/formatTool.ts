import { exec } from 'child_process';
import { promisify } from 'util';
import { resolveProjectPath } from '../services/project.js';

const execAsync = promisify(exec);

/**
 * Runs a formatter (prettier, eslint) on a file.
 */
export async function formatFile({ path: filePath }: { path: string }): Promise<string> {
  if (!filePath?.trim()) {
    throw new Error('format_file requires path');
  }

  const safePath = resolveProjectPath(filePath);

  // Try prettier first, then eslint --fix
  try {
    try {
      await execAsync(`npx prettier --write ${safePath}`);
      return `Formatted ${filePath} with Prettier`;
    } catch {
      await execAsync(`npx eslint --fix ${safePath}`);
      return `Formatted ${filePath} with ESLint`;
    }
  } catch (error) {
    return `Error formatting file: ${error instanceof Error ? error.message : String(error)}. Ensure prettier or eslint is installed.`;
  }
}
