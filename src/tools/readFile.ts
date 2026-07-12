import { readFile as fsReadFile } from 'fs/promises';
import { resolveProjectPath } from '../services/project.js';

export async function readFile(filePath: string): Promise<string> {
  const safePath = resolveProjectPath(filePath);
  return fsReadFile(safePath, 'utf8');
}
