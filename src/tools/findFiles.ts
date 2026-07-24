import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { getCurrentProjectRoot } from '../services/project.js';

const execFile = promisify(execFileCb);

/**
 * Find files by pattern using the `find` command.
 * Optimized for Linux/x64 (Raspberry Pi).
 */
export async function findFiles({ pattern }: { pattern: string }): Promise<string> {
  if (!pattern?.trim()) {
    throw new Error('find_files pattern must not be empty');
  }

  const cwd = getCurrentProjectRoot();

  try {
    // We use -iname for case-insensitive matching by default as it's more user-friendly
    const { stdout, stderr } = await execFile('find', ['.', '-maxdepth', '4', '-not', '-path', '*/.*', '-iname', pattern], {
      cwd,
      timeout: 10000 // 10s timeout to prevent Pi hang on massive projects
    });

    const results = stdout.trim();
    if (!results) {
      return `No files found matching pattern: ${pattern}`;
    }

    return results;
  } catch (error) {
    return `Error finding files: ${error instanceof Error ? error.message : String(error)}`;
  }
}
