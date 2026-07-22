import { readdir, readFile as fsReadFile } from 'fs/promises';
import path from 'path';
import { getCurrentProjectRoot, resolveProjectPath } from '../services/project.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function walkDirectory(directory: string, callback: (filePath: string) => Promise<void>): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(resolvedPath, callback);
      continue;
    }

    if (entry.isFile()) {
      await callback(resolvedPath);
    }
  }
}

export async function searchText({ query }: { query: string }): Promise<string> {
  if (!query?.trim()) {
    throw new Error('searchText query must not be empty');
  }

  const projectRoot = getCurrentProjectRoot();
  const pattern = new RegExp(escapeRegExp(query), 'i');
  const matches: string[] = [];

  await walkDirectory(projectRoot, async (filePath) => {
    try {
      const contents = await fsReadFile(filePath, 'utf8');
      const lines = contents.split(/\r?\n/);

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line) {
          continue;
        }

        if (pattern.test(line)) {
          matches.push(`${path.relative(projectRoot, filePath)}:${index + 1}: ${line.trim()}`);
          if (matches.length >= 50) {
            return;
          }
        }
      }
    } catch {
      // Ignore files that cannot be read as text.
    }
  });

  if (matches.length === 0) {
    return `No matches found for query: ${query}`;
  }

  return matches.join('\n');
}
