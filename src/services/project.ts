import path from 'path';

const BASE_PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? process.cwd();
let currentProjectRoot: string | null = null;

function isPathInsideRoot(root: string, fullPath: string): boolean {
  const relative = path.relative(root, fullPath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function getCurrentProjectRoot(): string {
  return currentProjectRoot ?? BASE_PROJECTS_ROOT;
}

export function setCurrentProject(projectPath: string): string {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new Error('project path must be a non-empty string');
  }

  const resolvedRoot = path.resolve(BASE_PROJECTS_ROOT, projectPath);
  if (!isPathInsideRoot(BASE_PROJECTS_ROOT, resolvedRoot)) {
    throw new Error('Project path is outside the allowed projects root.');
  }

  currentProjectRoot = resolvedRoot;
  return currentProjectRoot;
}

export function resolveProjectPath(requestedPath: string): string {
  const root = getCurrentProjectRoot();
  const fullPath = path.resolve(root, requestedPath);
  if (!isPathInsideRoot(root, fullPath)) {
    throw new Error('Access denied: path is outside the active project root.');
  }

  return fullPath;
}
