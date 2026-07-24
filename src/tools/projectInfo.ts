import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { getCurrentProjectRoot } from '../services/project.js';

export async function projectInfo(): Promise<string> {
  const root = getCurrentProjectRoot();
  const info: string[] = [`Project Root: ${root}`];

  try {
    const files = await readdir(root);

    // Detect Package Manager / Runtime
    if (files.includes('package.json')) {
      info.push('- Type: Node.js');
      const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
      info.push(`- Name: ${pkg.name || 'unknown'}`);
      info.push(`- Version: ${pkg.version || 'unknown'}`);

      const deps = Object.keys(pkg.dependencies || {}).length;
      const devDeps = Object.keys(pkg.devDependencies || {}).length;
      info.push(`- Dependencies: ${deps} prod, ${devDeps} dev`);

      if (files.includes('package-lock.json')) info.push('- Lockfile: package-lock.json (npm)');
      else if (files.includes('yarn.lock')) info.push('- Lockfile: yarn.lock (yarn)');
    }

    if (files.includes('tsconfig.json')) info.push('- Language: TypeScript');
    if (files.includes('requirements.txt') || files.includes('pyproject.toml')) info.push('- Type: Python');
    if (files.includes('Dockerfile')) info.push('- Infrastructure: Docker detected');
    if (files.includes('.git')) {
      info.push('- Version Control: Git detected');
    }

    return info.join('\n');
  } catch (error) {
    return `Error gathering project info: ${error instanceof Error ? error.message : String(error)}`;
  }
}
