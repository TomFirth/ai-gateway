import { listDirectory } from '../tools/listDirectory.js';
import { readFile } from '../tools/readFile.js';
import { searchText } from '../tools/searchText.js';
import { gitStatus, gitDiff, gitLog } from '../tools/git.js';
import { runTests, runNpm, terminal } from '../tools/run.js';
import { openFile, replaceText, renameSymbol } from '../tools/fileOps.js';

type ToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

const GENERAL_SYSTEM_PROMPT = `
You are a helpful assistant.

Rules:
- Respond naturally.
- Do not output JSON.
- Do not call tools.
`;

const CODING_SYSTEM_PROMPT = `
You are a coding assistant running locally.

Rules:
- Inspect files before making assumptions.
- Use tools when project information is required.
- Never invent file contents.
- Prefer small safe changes.
- Use tool calls only through the provided functions.
- Never output XML or JSON manually for tools.

Available tools:
git_status()
git_diff(path)
git_log(count)
list_directory(path)
open_file(path)
read_file(path)
search_text(query)
replace_text(path, searchText, replaceText)
rename_symbol(oldName,newName,filePath)
run_tests()
run_npm(args)
terminal(command)
`;

const tools = {
  git_status: {
    description: 'Get current git repository status.',
    run: gitStatus,
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  git_diff: {
    description: 'Show git diff.',
    run: gitDiff,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  git_log: {
    description: 'Show recent git commits.',
    run: gitLog,
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number' }
      }
    }
  },

  list_directory: {
    description: 'List project files.',
    run: listDirectory,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  open_file: {
    description: 'Open a file.',
    run: openFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  read_file: {
    description: 'Read a file.',
    run: readFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  search_text: {
    description: 'Search project text.',
    run: searchText,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      }
    }
  },

  replace_text: {
    description: 'Replace text inside a file.',
    run: replaceText,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        searchText: { type: 'string' },
        replaceText: { type: 'string' }
      }
    }
  },

  rename_symbol: {
    description: 'Rename symbol.',
    run: renameSymbol,
    parameters: {
      type: 'object',
      properties: {
        oldName: { type: 'string' },
        newName: { type: 'string' },
        filePath: { type: 'string' }
      }
    }
  },

  run_tests: {
    description: 'Run tests.',
    run: runTests,
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  run_npm: {
    description: 'Run npm.',
    run: runNpm,
    parameters: {
      type: 'object',
      properties: {
        args: { type: 'string' }
      }
    }
  },

  terminal: {
    description: 'Run terminal command.',
    run: terminal,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' }
      }
    }
  }
} as const;

type ToolName = keyof typeof tools;

export const openAITools = Object.entries(tools).map(
  ([name, tool]) => ({
    type: 'function',
    function: {
      name,
      description: tool.description,
      parameters: tool.parameters
    }
  })
);

function isToolName(value: string): value is ToolName {
  return value in tools;
}

function parseToolCall(text: string) {
  const match = text.match(
    /<tool_call>\s*(.*?)\s*<\/tool_call>/s
  );

  if (!match?.[1]) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1]);

    if (
      typeof parsed.name !== 'string' ||
      !isToolName(parsed.name)
    ) {
      return null;
    }

    return {
      name: parsed.name,
      arguments: parsed.arguments ?? {}
    };
  } catch {
    return null;
  }
}

function trimMessages(
  messages: ChatMessage[],
  maxChars = 5000
) {
  let total = 0;
  const result: ChatMessage[] = [];

  for (
    let i = messages.length - 1;
    i >= 0;
    i--
  ) {
    const message = messages[i];

    if (!message) {
      continue;
    }

    const size = message.content?.length ?? 0;

    if (total + size > maxChars) {
      break;
    }

    result.unshift(message);
    total += size;
  }

  return result;
}

async function callQwenApi(
  messages: ChatMessage[],
  useTools = false,
  stream = false
) {
  const url =
    process.env.QWEN_URL ??
    'http://192.168.1.81:8080';

  console.log('QWEN URL:', url);

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 600000);

  try {
    const response = await fetch(
      `${url}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'qwen2.5-coder',
          messages: trimMessages(messages),
          temperature: useTools ? 0.05 : 0.2,
          top_p: 0.9,
          max_tokens: 256,
          stream,
          ...(useTools
            ? {
                tools: openAITools,
                tool_choice: 'auto'
              }
            : {})
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        await response.text()
      );
    }

    return response;

  } finally {
    clearTimeout(timeout);
  }
}