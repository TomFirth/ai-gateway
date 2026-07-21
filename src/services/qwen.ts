import { listDirectory } from '../tools/listDirectory.js';
import { readFile } from '../tools/readFile.js';
import { searchText } from '../tools/searchText.js';
import { gitStatus, gitDiff, gitLog } from '../tools/git.js';
import { runTests, runNpm, terminal } from '../tools/run.js';
import { openFile, replaceText, renameSymbol } from '../tools/fileOps.js';

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

const SYSTEM_PROMPT = `You have access to these tools:

git_status()

git_diff(path)

git_log(count)

list_directory(path)

open_file(path)

read_file(path)

search_text(query)

replace_text(path, searchText, replaceText)

rename_symbol(oldName, newName, filePath)

run_tests()

run_npm(args)

terminal(command)

If you need them, ask for them.`;

const tools = {
  git_status: {
    description: 'Show git status for the active project.',
    run: gitStatus,
  },
  git_diff: {
    description: 'Show git diff for the active project or a specific file.',
    run: gitDiff,
  },
  git_log: {
    description: 'Show recent git history for the active project.',
    run: gitLog,
  },
  list_directory: {
    description: 'List files and directories under the active project root.',
    run: listDirectory,
  },
  open_file: {
    description: 'Open a file under the active project root and return its content.',
    run: openFile,
  },
  read_file: {
    description: 'Read the contents of a text file under the active project root.',
    run: readFile,
  },
  search_text: {
    description: 'Search text across files under the active project root.',
    run: searchText,
  },
  replace_text: {
    description: 'Replace matching text inside a file under the active project root.',
    run: replaceText,
  },
  rename_symbol: {
    description: 'Rename a symbol across project files under the active project root.',
    run: renameSymbol,
  },
  run_tests: {
    description: 'Run the project test suite using npm test.',
    run: runTests,
  },
  run_npm: {
    description: 'Run an npm command in the active project root.',
    run: runNpm,
  },
  terminal: {
    description: 'Run an arbitrary shell command in the active project root.',
    run: terminal,
  },
} as const;

type ToolName = keyof typeof tools;

type ToolInvocation = {
  name: ToolName;
  args: string[];
};

function parseToolInvocation(text: string): ToolInvocation | null {
  const toolNames = Object.keys(tools).join('|');
  const match = text.match(new RegExp(`\\b(${toolNames})\\s*\\(\\s*([\s\S]*?)\\s*\\)`, 'i'));
  if (!match) {
    return null;
  }

  const rawName = match[1];
  const argsText = match[2] ?? '';
  if (!rawName) {
    return null;
  }

  const name = rawName.toLowerCase() as ToolName;
  const args: string[] = [];
  const argRegex = /(['"])(.*?)\1|([^,\s]+)/g;
  let argMatch: RegExpExecArray | null;

  while ((argMatch = argRegex.exec(argsText)) !== null) {
    const value = argMatch[2] ?? argMatch[3];
    if (typeof value === 'string' && value.trim() !== '') {
      args.push(value.trim());
    }
  }

  return { name, args };
}

async function callQwenApi(
  messages: ChatMessage[],
  tools?: any[]
): Promise<string> {
  const QWEN_URL = process.env.QWEN_URL ?? 'http://192.168.1.81:8080';
  const response = await fetch(`${QWEN_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen2.5-coder',
      messages,
      ...(tools ? { tools } : {})
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Qwen request failed: ${response.status} ${response.statusText} - ${bodyText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const firstChoice = payload.choices?.[0];
  const text = firstChoice?.message?.content;

  if (!text) {
    throw new Error('Qwen response missing a completion message');
  }

  return text;
}

export async function chat(
  messages: ChatMessage[],
  openaiTools?: any[]
): Promise<string> {
  const conversation: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages,
  ];

  for (let loop = 0; loop < 3; loop += 1) {
    const assistantResponse = await callQwenApi(
      conversation,
      openaiTools
    );
    const toolInvocation = parseToolInvocation(assistantResponse);

    if (!toolInvocation) {
      return assistantResponse;
    }

    const tool = tools[toolInvocation.name];
    const toolOutput = await (tool.run as (...args: string[]) => Promise<string>)(...toolInvocation.args);

    conversation.push({ role: 'assistant', content: assistantResponse });
    conversation.push({
      role: 'system',
      content: `Tool ${toolInvocation.name} returned:\n${toolOutput}`,
    });
  }

  return callQwenApi(conversation);
}
