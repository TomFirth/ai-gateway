import { appendFile as fsAppendFile, unlink, writeFile } from 'fs/promises';
import { resolveProjectPath } from '../services/project.js';

/**
 * Append content to an existing file.
 */
export async function appendFile({ path: filePath, content }: { path: string; content: string }): Promise<string> {
  if (!filePath?.trim() || content === undefined) {
    throw new Error('append_file requires path and content');
  }

  const safePath = resolveProjectPath(filePath);
  try {
    await fsAppendFile(safePath, content, 'utf8');
    return `Successfully appended content to ${filePath}`;
  } catch (error) {
    return `Error appending to file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Delete a file.
 */
export async function deleteFile({ path: filePath }: { path: string }): Promise<string> {
  if (!filePath?.trim()) {
    throw new Error('delete_file requires path');
  }

  const safePath = resolveProjectPath(filePath);
  try {
    await unlink(safePath);
    return `Successfully deleted ${filePath}`;
  } catch (error) {
    return `Error deleting file: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Insert text at a specific line.
 */
export async function insertText({ path: filePath, line, content }: { path: string; line: number; content: string }): Promise<string> {
  if (!filePath?.trim() || line === undefined || content === undefined) {
    throw new Error('insert_text requires path, line, and content');
  }

  const safePath = resolveProjectPath(filePath);
  try {
    const fileContent = await import('fs/promises').then(fs => fs.readFile(safePath, 'utf8'));
    const lines = fileContent.split(/\r?\n/);

    // Line is 1-based
    const index = Math.max(0, line - 1);
    lines.splice(index, 0, content);

    await writeFile(safePath, lines.join('\n'), 'utf8');
    return `Successfully inserted text at line ${line} in ${filePath}`;
  } catch (error) {
    return `Error inserting text: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Apply a unified diff patch to the project.
 */
export async function applyPatch({ patch }: { patch: string }): Promise<string> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  const { writeFile, unlink } = await import('fs/promises');

  const tempPatchPath = resolveProjectPath(`.temp_${Date.now()}.patch`);

  try {
    await writeFile(tempPatchPath, patch, 'utf8');

    // Try git apply first as it handles unified diffs well
    try {
      const { stdout, stderr } = await execAsync(`git apply ${tempPatchPath}`, { cwd: resolveProjectPath('.') });
      await unlink(tempPatchPath);
      return `Patch applied successfully:\n${stdout}\n${stderr}`;
    } catch (gitError) {
      // Fallback to patch command if git fails or isn't a repo
      try {
        const { stdout, stderr } = await execAsync(`patch -p1 < ${tempPatchPath}`, { cwd: resolveProjectPath('.') });
        await unlink(tempPatchPath);
        return `Patch applied successfully (via patch):\n${stdout}\n${stderr}`;
      } catch (patchError) {
        await unlink(tempPatchPath);
        return `Failed to apply patch.\nGit error: ${String(gitError)}\nPatch error: ${String(patchError)}`;
      }
    }
  } catch (error) {
    return `Error processing patch: ${error instanceof Error ? error.message : String(error)}`;
  }
}
