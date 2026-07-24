import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getCurrentProjectRoot } from '../services/project.js';

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'done';
  description: string | undefined;
  createdAt: string;
  updatedAt: string;
}

const TASKS_FILE_NAME = '.ai_tasks.json';

async function getTasksPath(): Promise<string> {
  const root = getCurrentProjectRoot();
  return path.join(root, TASKS_FILE_NAME);
}

async function loadTasks(): Promise<Task[]> {
  const filePath = await getTasksPath();
  try {
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

async function saveTasks(tasks: Task[]): Promise<void> {
  const filePath = await getTasksPath();
  await writeFile(filePath, JSON.stringify(tasks, null, 2), 'utf8');
}

/**
 * Create a new tracked task.
 */
export async function createTask({ title, description }: { title: string; description?: string }): Promise<string> {
  if (!title?.trim()) {
    throw new Error('create_task requires a title');
  }

  const tasks = await loadTasks();
  const now = new Date().toISOString();
  const newTask: Task = {
    id: Math.random().toString(36).substring(2, 9),
    title,
    description,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  };

  tasks.push(newTask);
  await saveTasks(tasks);

  return `Task created: [${newTask.id}] ${newTask.title}`;
}

/**
 * Update the status of an existing task.
 */
export async function updateTask({ id, status }: { id: string; status: 'todo' | 'in-progress' | 'done' }): Promise<string> {
  const tasks = await loadTasks();
  const task = tasks.find(t => t.id === id);

  if (!task) {
    return `Task with ID ${id} not found.`;
  }

  task.status = status;
  task.updatedAt = new Date().toISOString();
  await saveTasks(tasks);

  return `Updated task ${id} status to ${status}`;
}

/**
 * Retrieve current active tasks.
 */
export async function getTaskStatus(): Promise<string> {
  const tasks = await loadTasks();
  if (tasks.length === 0) {
    return 'No tasks tracked yet.';
  }

  return tasks.map(t => {
    const icon = t.status === 'done' ? '✅' : t.status === 'in-progress' ? '⏳' : '⬜';
    return `${icon} [${t.id}] ${t.title} (${t.status})`;
  }).join('\n');
}
