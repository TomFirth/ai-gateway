import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { getCurrentProjectRoot } from '../services/project.js';

const execFile = promisify(execFileCb);

async function execGit(args: string[]): Promise<string> {
  const cwd = getCurrentProjectRoot();
  const result = await execFile('git', args, { cwd, encoding: 'utf8' });
  return result.stdout.trim() || result.stderr.trim() || 'No output.';
}

export async function gitStatus(): Promise<string> {
  return execGit(['status', '--short']);
}

export async function gitDiff(path?: string): Promise<string> {
  if (path?.trim()) {
    return execGit(['diff', '--', path.trim()]);
  }

  return execGit(['diff']);
}

export async function gitLog(count = '20'): Promise<string> {
  const parsedCount = Number(count);
  const maxCount = Number.isInteger(parsedCount) && parsedCount > 0 ? parsedCount : 20;

  return execGit(['log', '--oneline', `--max-count=${maxCount}`]);
}
