import { readdir } from 'fs/promises';
import { resolveProjectPath } from '../services/project.js';

export async function listDirectory(directoryPath: string): Promise<string[]> {
  const safePath = resolveProjectPath(directoryPath);
  return readdir(safePath);
}
