import { listDirectory } from '../tools/listDirectory.js';
import { readFile } from '../tools/readFile.js';
import { searchText } from '../tools/searchText.js';
import { gitStatus, gitDiff, gitLog } from '../tools/git.js';
import { runTests, runNpm, terminal } from '../tools/run.js';
import { openFile, replaceText, renameSymbol } from '../tools/fileOps.js';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: any[];
};

const GENERAL_SYSTEM_PROMPT = `
You are a helpful assistant.

Rules:
- Respond only with natural language.
- Do not output JSON.
- Do not call tools.
`;

const CODING_SYSTEM_PROMPT = `
You are a coding assistant.

Rules:
- Inspect files before making assumptions.
- Use tools when you need project information.
- Do not invent code you have not inspected.

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

When using a tool, output only the tool call.
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
    description: 'Show git diff for the project or a file.',
    run: gitDiff,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string'
        }
      }
    }
  },

  git_log: {
    description: 'Show recent git commit history.',
    run: gitLog,
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number'
        }
      }
    }
  },

  list_directory: {
    description: 'List project files and folders.',
    run: listDirectory,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string'
        }
      }
    }
  },

  open_file: {
    description: 'Open a file and return contents.',
    run: openFile,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string'
        }
      }
    }
  },

  read_file: {
    description: 'Read a text file.',
    run: readFile,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string'
        }
      }
    }
  },

  search_text: {
    description: 'Search text across project files.',
    run: searchText,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string'
        }
      }
    }
  },

  replace_text: {
    description: 'Replace text inside a file.',
    run: replaceText,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string'
        },
        searchText: {
          type: 'string'
        },
        replaceText: {
          type: 'string'
        }
      }
    }
  },

  rename_symbol: {
    description: 'Rename a symbol in a source file.',
    run: renameSymbol,
    parameters: {
      type: 'object',
      properties: {
        oldName: {
          type: 'string'
        },
        newName: {
          type: 'string'
        },
        filePath: {
          type: 'string'
        }
      }
    }
  },

  run_tests: {
    description: 'Run project tests.',
    run: runTests,
    parameters: {
      type: 'object',
      properties: {}
    }
  },

  run_npm: {
    description: 'Run npm commands.',
    run: runNpm,
    parameters: {
      type: 'object',
      properties: {
        args: {
          type: 'string'
        }
      }
    }
  },

  terminal: {
    description: 'Run terminal commands.',
    run: terminal,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string'
        }
      }
    }
  }
} as const;

type ToolName = keyof typeof tools;

export const openAITools = Object.entries(tools).map(([name, tool]) => ({
  type: 'function',
  function: {
    name,
    description: tool.description,
    parameters: tool.parameters
  }
}));

function parseToolCall(text: string) {
  const match = text.match(
    new RegExp(`(${Object.keys(tools).join('|')})\\((.*?)\\)`, 's')
  );

  if (!match) {
    return null;
  }

  return {
    name: match[1] as ToolName,
    args: match[2]
      .split(',')
      .map(x => x.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  };
}

async function callQwenApi(
  messages: ChatMessage[],
  useTools = true,
  stream = false
) {
  const url = process.env.QWEN_URL ?? 'http://192.168.1.81:8080';

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 300000);

  try {
    const response = await fetch(`${url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        connection: 'keep-alive'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'qwen2.5-coder',
        messages,
        temperature: 0.05,
        top_p: 0.9,
        max_tokens: 768,
        stream,
        ...(useTools
          ? {
              tools: openAITools,
              tool_choice: 'auto'
            }
          : {})
      })
    });

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

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await callQwenApi(
      conversation,
      useTools
    );
    const payload = await response.json();

    const assistant = payload.choices?.[0]?.message;

    if (!assistant) {
      throw new Error('Missing assistant response');
    }

    if (assistant.tool_calls?.length) {
      conversation.push({
        role: 'assistant',
        content: null,
        tool_calls: assistant.tool_calls
      });

      for (const call of assistant.tool_calls) {
        const name = call.function.name as ToolName;
        const tool = tools[name];

        if (!tool) {
          continue;
        }

        const args = JSON.parse(call.function.arguments || '{}');

        const result = await (tool.run as any)(
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

    const result = await (tools[fallback.name].run as any)(
      ...fallback.args
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
    throw new Error('No stream body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true
    });

    while (buffer.includes('\n\n')) {
      const index = buffer.indexOf('\n\n');

      const event = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);

      if (!event.startsWith('data:')) {
        continue;
      }

      const data = event.replace(/^data:\s*/, '');

      if (data === '[DONE]') {
        return;
      }

      try {
        const json = JSON.parse(data);

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