import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const exec = promisify(execCb);

/**
 * Returns information about the OS, CPU, and available tools.
 */
export async function environmentInfo(): Promise<string> {
  const info: string[] = [];

  info.push(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
  info.push(`Platform: ${os.platform()}`);
  const cpus = os.cpus();
  if (cpus && cpus.length > 0 && cpus[0]) {
    info.push(`CPUs: ${cpus.length}x ${cpus[0].model}`);
  }
  info.push(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB Total, ${Math.round(os.freemem() / 1024 / 1024 / 1024)}GB Free`);

  const tools = ['node', 'npm', 'git', 'docker', 'python3', 'gcc', 'blender'];
  const availableTools: string[] = [];

  for (const tool of tools) {
    try {
      await exec(`command -v ${tool}`);
      availableTools.push(tool);
    } catch {
      // Tool not found
    }
  }

  info.push(`Available Tools: ${availableTools.join(', ')}`);

  return info.join('\n');
}

/**
 * Checks if a specific command/executable exists in the system path.
 */
export async function checkCommand({ command }: { command: string }): Promise<string> {
  try {
    const { stdout } = await exec(`command -v ${command}`);
    return stdout.trim() ? `${command} is installed at ${stdout.trim()}` : `${command} is not found.`;
  } catch {
    return `${command} is not installed or not in PATH.`;
  }
}

/**
 * Lists Docker containers and images.
 */
export async function dockerStatus(): Promise<string> {
  try {
    const { stdout: containers } = await exec('docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"');
    const { stdout: images } = await exec('docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"');

    return `### Containers\n${containers}\n\n### Images\n${images}`;
  } catch (error) {
    return `Error getting Docker status: ${error instanceof Error ? error.message : String(error)}. Ensure Docker is running and the user has permissions.`;
  }
}
