import { readFile as fsReadFile, rename as fsRename, writeFile } from 'fs/promises';
import path from 'path';
import { resolveProjectPath, getCurrentProjectRoot } from '../services/project.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

export async function openFile({ path: filePath }: { path: string }): Promise<string> {
  if (!filePath?.trim()) {
    throw new Error('open_file path must not be empty');
  }

  const safePath = resolveProjectPath(filePath);
  return fsReadFile(safePath, 'utf8');
}

export async function replaceText({ path: filePath, searchText, replaceText }: { path: string, searchText: string, replaceText: string }): Promise<string> {
  if (!filePath?.trim() || searchText === undefined || replaceText === undefined) {
    throw new Error('replace_text requires path, searchText, and replaceText');
  }

  const safePath = resolveProjectPath(filePath);
  const content = await fsReadFile(safePath, 'utf8');
  if (!content.includes(searchText)) {
    return `No occurrences of the search text were found in ${filePath}.`;
  }

  const updated = content.split(searchText).join(replaceText);
  await writeFile(safePath, updated, 'utf8');
  return `Updated ${filePath}: replaced ${content.length - updated.length} characters.`;
}

export async function renameSymbol({ oldName, newName, filePath }: { oldName: string, newName: string, filePath?: string }): Promise<string> {
  if (!oldName?.trim() || !newName?.trim()) {
    throw new Error('rename_symbol requires oldName and newName');
  }

  const root = getCurrentProjectRoot();
  const filesToSearch = [] as string[];

  if (filePath?.trim()) {
    filesToSearch.push(resolveProjectPath(filePath));
  } else {
    const walk = async (dir: string): Promise<void> => {
      const entries = await import('fs/promises').then((fs) => fs.readdir(dir, { withFileTypes: true }));
      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(entryPath);
        } else if (/\.(ts|tsx|js|jsx|json|md|txt|html|css|yml|yaml)$/i.test(entry.name)) {
          filesToSearch.push(entryPath);
        }
      }
    };

    await walk(root);
  }

  let changeCount = 0;
  const regex = new RegExp(`\\b${escapeRegExp(oldName)}\\b`, 'g');

  for (const absolutePath of filesToSearch) {
    const content = await fsReadFile(absolutePath, 'utf8');
    const replaced = content.replace(regex, newName);
    if (replaced !== content) {
      await writeFile(absolutePath, replaced, 'utf8');
      changeCount += 1;
    }
  }

  if (changeCount === 0) {
    return `No occurrences of ${oldName} were found.`;
  }

  return `Renamed symbol ${oldName} to ${newName} in ${changeCount} file(s).`;
}
