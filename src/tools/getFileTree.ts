import { readdir, stat } from 'fs/promises';
import path from 'path';
import { getCurrentProjectRoot } from '../services/project.js';

/**
 * Returns a structured project tree with a depth limit.
 */
export async function getFileTree({ depth = 2 }: { depth?: number } = {}): Promise<string> {
  const root = getCurrentProjectRoot();

  async function buildTree(dir: string, currentDepth: number): Promise<string[]> {
    if (currentDepth > depth) return [];

    const entries = await readdir(dir, { withFileTypes: true });
    let tree: string[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(root, fullPath);
      const indent = '  '.repeat(currentDepth);

      if (entry.isDirectory()) {
        tree.push(`${indent}📁 ${entry.name}/`);
        const subTree = await buildTree(fullPath, currentDepth + 1);
        tree.push(...subTree);
      } else {
        tree.push(`${indent}📄 ${entry.name}`);
      }
    }

    return tree;
  }

  try {
    const treeLines = await buildTree(root, 0);
    return treeLines.join('\n') || 'Project root is empty.';
  } catch (error) {
    return `Error building file tree: ${error instanceof Error ? error.message : String(error)}`;
  }
}
