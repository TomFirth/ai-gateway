import { exec as execCb, execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { getCurrentProjectRoot } from '../services/project.js';

const execFile = promisify(execFileCb);

function parseArgs(args: string): string[] {
  return args
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function execShell(command: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execCb(command, { cwd, shell: true, encoding: 'utf8' } as any, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

export async function runTests(): Promise<string> {
  return runNpm({ args: 'test' });
}

export async function runLint(): Promise<string> {
  return runNpm({ args: 'run lint' });
}

export async function checkErrors(): Promise<string> {
  try {
    return await terminal({ command: 'npx tsc --noEmit' });
  } catch {
    return runNpm({ args: 'run typecheck' });
  }
}

export async function runNpm({ args = 'install' }: { args?: string } = {}): Promise<string> {
  const cwd = getCurrentProjectRoot();
  const argv = parseArgs(args.length ? args : 'install');
  const result = await execFile('npm', argv, { cwd, encoding: 'utf8' });
  return result.stdout.trim() || result.stderr.trim() || 'No output.';
}

export async function terminal({ command }: { command: string }): Promise<string> {
  if (!command?.trim()) {
    throw new Error('terminal command must not be empty');
  }

  const cwd = getCurrentProjectRoot();
  const result = await execShell(command, cwd);
  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
  return output || 'No output.';
}

export async function listDependencies(): Promise<string> {
  return runNpm({ args: 'list --depth=0' });
}

export async function installPackage({ name }: { name: string }): Promise<string> {
  if (!name?.trim()) {
    throw new Error('install_package requires a package name');
  }
  return runNpm({ args: `install ${name}` });
}

export async function removePackage({ name }: { name: string }): Promise<string> {
  if (!name?.trim()) {
    throw new Error('remove_package requires a package name');
  }
  return runNpm({ args: `uninstall ${name}` });
}

export async function buildProject(): Promise<string> {
  return runNpm({ args: 'run build' });
}
