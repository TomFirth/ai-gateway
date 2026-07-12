import { mkdir, readFile as fsReadFile, writeFile } from 'fs/promises';
import path from 'path';
import { getCurrentProjectRoot } from './project.js';

const STORAGE_FILE = path.resolve(process.env.HOME ?? '.', '.local', 'share', 'ai-gateway', 'conversations.json');
let conversationsCache: ConversationRecord[] | null = null;

export type ConversationRole = 'user' | 'assistant' | 'system';

export type ConversationMessage = {
  role: ConversationRole;
  content: string;
  createdAt: string;
};

export type ConversationRecord = {
  id: string;
  projectRoot: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
};

async function ensureStoreFile(): Promise<void> {
  const dir = path.dirname(STORAGE_FILE);
  await mkdir(dir, { recursive: true });

  try {
    await fsReadFile(STORAGE_FILE, 'utf8');
  } catch (error) {
    await writeFile(STORAGE_FILE, '[]', 'utf8');
  }
}

async function loadConversations(): Promise<void> {
  if (conversationsCache !== null) {
    return;
  }

  await ensureStoreFile();
  const raw = await fsReadFile(STORAGE_FILE, 'utf8');

  try {
    conversationsCache = JSON.parse(raw) as ConversationRecord[];
  } catch {
    conversationsCache = [];
  }
}

async function saveConversations(): Promise<void> {
  if (conversationsCache === null) {
    conversationsCache = [];
  }

  await writeFile(STORAGE_FILE, JSON.stringify(conversationsCache, null, 2), 'utf8');
}

export async function getAllConversations(): Promise<ConversationRecord[]> {
  await loadConversations();
  return (conversationsCache ?? []).slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getConversation(id: string): Promise<ConversationRecord | null> {
  await loadConversations();
  return conversationsCache?.find((conversation) => conversation.id === id) ?? null;
}

export async function createConversation(projectRoot?: string, initialMessages: Omit<ConversationMessage, 'createdAt'>[] = []): Promise<ConversationRecord> {
  await loadConversations();
  const root = projectRoot ?? getCurrentProjectRoot();
  const now = new Date().toISOString();

  const conversation: ConversationRecord = {
    id: crypto.randomUUID(),
    projectRoot: root,
    messages: initialMessages.map((message) => ({
      ...message,
      createdAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  };

  conversationsCache?.push(conversation);
  await saveConversations();
  return conversation;
}

export async function appendMessage(
  conversationId: string,
  message: Omit<ConversationMessage, 'createdAt'>,
): Promise<ConversationRecord> {
  await loadConversations();

  const conversation = conversationsCache?.find((item) => item.id === conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const entry: ConversationMessage = {
    ...message,
    createdAt: new Date().toISOString(),
  };

  conversation.messages.push(entry);
  conversation.updatedAt = new Date().toISOString();
  await saveConversations();
  return conversation;
}

export async function updateConversationProject(conversationId: string, projectRoot: string): Promise<ConversationRecord> {
  await loadConversations();

  const conversation = conversationsCache?.find((item) => item.id === conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  conversation.projectRoot = projectRoot;
  conversation.updatedAt = new Date().toISOString();
  await saveConversations();
  return conversation;
}
