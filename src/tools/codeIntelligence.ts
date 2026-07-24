import { readFile } from 'fs/promises';
import { resolveProjectPath, getCurrentProjectRoot } from '../services/project.js';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

/**
 * Extract classes/functions/types from a file using regex.
 */
export async function getSymbols({ path: filePath }: { path: string }): Promise<string> {
  if (!filePath?.trim()) {
    throw new Error('get_symbols requires path');
  }

  const safePath = resolveProjectPath(filePath);
  try {
    const content = await readFile(safePath, 'utf8');
    const symbols: string[] = [];

    // Simple regex for JS/TS symbols
    const patterns = [
      { type: 'class', regex: /class\s+([a-zA-Z0-9_$]+)/g },
      { type: 'function', regex: /function\s+([a-zA-Z0-9_$]+)/g },
      { type: 'const-fn', regex: /const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g },
      { type: 'interface', regex: /interface\s+([a-zA-Z0-9_$]+)/g },
      { type: 'type', regex: /type\s+([a-zA-Z0-9_$]+)/g }
    ];

    for (const p of patterns) {
      let match;
      while ((match = p.regex.exec(content)) !== null) {
        symbols.push(`${p.type}: ${match[1]}`);
      }
    }

    return symbols.length > 0 ? symbols.join('\n') : `No symbols found in ${filePath}`;
  } catch (error) {
    return `Error getting symbols: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Locate where a symbol is defined using grep.
 */
export async function findSymbol({ symbol }: { symbol: string }): Promise<string> {
  if (!symbol?.trim()) {
    throw new Error('find_symbol requires a symbol name');
  }

  const root = getCurrentProjectRoot();
  try {
    // Search for definition-like patterns
    const pattern = `\\b(class|function|const|let|var|interface|type)\\s+${symbol}\\b`;
    const { stdout } = await execFile('grep', ['-rnE', pattern, '.', '--exclude-dir=node_modules'], { cwd: root });

    return stdout.trim() || `Could not find definition for symbol: ${symbol}`;
  } catch (error) {
    // Grep returns exit code 1 if nothing is found
    return `Could not find definition for symbol: ${symbol}`;
  }
}
