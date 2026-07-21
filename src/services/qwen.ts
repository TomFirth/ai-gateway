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
- Use tools only through function calls.
- Never output XML tool calls manually.

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
    description: 'Replace text in a file.',
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

  for (let i = messages.length - 1; i >= 0; i--) {
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
          messages: [
            messages[0],
            ...trimMessages(messages.slice(1))
          ].filter(Boolean),
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
      throw new Error(await response.text());
    }

    return response;

  } finally {
    clearTimeout(timeout);
  }
}

export async function chat(
  messages: ChatMessage[],
  useTools = false
): Promise<string> {

  const conversation: ChatMessage[] = [
    {
      role: 'system',
      content: useTools
        ? CODING_SYSTEM_PROMPT
        : GENERAL_SYSTEM_PROMPT
    },
    ...messages
  ];

  for (let attempt = 0; attempt < 3; attempt++) {

    const response = await callQwenApi(
      conversation,
      useTools
    );

    const payload = await response.json();

    const assistant =
      payload.choices?.[0]?.message;

    if (!assistant) {
      throw new Error(
        'Missing assistant response'
      );
    }

    if (assistant.tool_calls?.length) {

      conversation.push({
        role: 'assistant',
        content: null,
        tool_calls: assistant.tool_calls
      });

      for (const call of assistant.tool_calls) {

        const name = call.function.name;

        if (!isToolName(name)) {
          continue;
        }

        const tool = tools[name];

        let args: Record<string, unknown> = {};

        try {
          args = JSON.parse(
            call.function.arguments || '{}'
          );
        } catch {
          console.error(
            'Invalid tool args:',
            call.function.arguments
          );
        }

        const result = await (
          tool.run as (...args: any[]) => Promise<string>
        )(
          ...Object.values(args)
        );

        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: String(result)
        });
      }

      continue;
    }

    const text = assistant.content ?? '';

    const fallback = parseToolCall(text);

    if (!fallback) {
      return text;
    }

    const result = await (
      tools[fallback.name].run as (...args: any[]) => Promise<string>
    )(
      ...Object.values(fallback.arguments)
    );

    conversation.push({
      role: 'assistant',
      content: text
    });

    conversation.push({
      role: 'tool',
      content: String(result)
    });
  }

  return 'Unable to complete request.';
}

export async function* chatStream(
  messages: ChatMessage[]
) {
  const response = await callQwenApi(
    [
      {
        role: 'system',
        content: GENERAL_SYSTEM_PROMPT
      },
      ...messages
    ],
    false,
    true
  );

  if (!response.body) {
    throw new Error(
      'No stream body'
    );
  }

  const reader =
    response.body.getReader();

  const decoder =
    new TextDecoder();

  let buffer = '';

  while (true) {

    const {
      done,
      value
    } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(
      value,
      {
        stream: true
      }
    );

    while (buffer.includes('\n\n')) {

      const index =
        buffer.indexOf('\n\n');

      const event =
        buffer.slice(0, index);

      buffer =
        buffer.slice(index + 2);

      if (!event.startsWith('data:')) {
        continue;
      }

      const data =
        event.replace(
          /^data:\s*/,
          ''
        );

      if (data === '[DONE]') {
        return;
      }

      try {

        const json =
          JSON.parse(data);

        const token =
          json.choices?.[0]?.delta?.content;

        if (token) {
          yield token;
        }

      } catch {
        continue;
      }
    }
  }
}