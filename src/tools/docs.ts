import { writeFile, readFile } from 'fs/promises';
import path from 'path';
import { resolveProjectPath, getCurrentProjectRoot } from '../services/project.js';
import { projectInfo } from './projectInfo.js';

/**
 * Generates or updates a README.md based on project structure.
 */
export async function generateReadme(): Promise<string> {
  const root = getCurrentProjectRoot();
  const readmePath = path.join(root, 'README.md');
  const info = await projectInfo();

  const template = `# Project Overview\n\n${info}\n\n## Description\nAuto-generated documentation for the AI Gateway agent.\n\n## Tools and Features\n- Automated Task Tracking\n- Multi-model Support\n- Blender Integration Ready\n\n## Setup\n\`\`\`bash\nnpm install\nnpm start\n\`\`\``;

  try {
    await writeFile(readmePath, template, 'utf8');
    return `Successfully generated README.md at ${readmePath}`;
  } catch (error) {
    return `Error generating README: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Produces a brief architecture overview.
 */
export async function summarizeProject(): Promise<string> {
  const info = await projectInfo();
  // We can expand this to read key files in the future
  return `### Architecture Summary\n\n${info}\n\nThis project is a TypeScript-based AI Gateway designed for local LLM orchestration with support for real-time tool execution and streaming.`;
}
