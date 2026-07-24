import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { resolveProjectPath, getCurrentProjectRoot } from '../services/project.js';

/**
 * Creates a new project directory and initial files.
 */
export async function createProject({ project_name, documents }: { project_name: string, documents?: string[] }): Promise<string> {
  if (!project_name?.trim()) {
    throw new Error('create_project requires project_name');
  }

  const root = getCurrentProjectRoot();
  const projectPath = path.resolve(root, project_name);

  try {
    await mkdir(projectPath, { recursive: true });

    if (documents && Array.isArray(documents)) {
      for (let i = 0; i < documents.length; i++) {
        const docContent = documents[i];
        if (typeof docContent === 'string') {
          const filePath = path.join(projectPath, `doc_${i}.md`);
          await writeFile(filePath, docContent, 'utf8');
        }
      }
    }

    return `Successfully created project ${project_name} at ${projectPath}`;
  } catch (error) {
    return `Error creating project: ${error instanceof Error ? error.message : String(error)}`;
  }
}
