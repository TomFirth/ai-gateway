import { readdir } from 'fs/promises';
import { resolveProjectPath } from '../services/project.js';

export async function listDirectory({ path: directoryPath = '.' }: { path?: string } = {}): Promise<string[]> {
  const safePath = resolveProjectPath(directoryPath);
  return readdir(safePath);
}
