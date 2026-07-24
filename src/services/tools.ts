import * as t from '../tools/index.js';

export const tools = {
  // Project understanding
  project_info: {
    description: 'Detect language, framework, package manager, runtime, dependencies.',
    run: t.projectInfo,
    parameters: { type: 'object', properties: {} }
  },

  find_files: {
    description: 'Find files by glob/pattern (e.g., "*.ts", "*.cs").',
    run: t.findFiles,
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' }
      },
      required: ['pattern']
    }
  },

  search_code: {
    description: 'Search source code contents. Similar to VS Code global search.',
    run: t.searchText,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },

  get_file_tree: {
    description: 'Return structured project tree with depth limit.',
    run: t.getFileTree,
    parameters: {
      type: 'object',
      properties: {
        depth: { type: 'number', default: 2 }
      }
    }
  },

  // File editing improvements
  create_project: {
    description: 'Create a new project directory and initial files.',
    run: t.createProject,
    parameters: {
      type: 'object',
      properties: {
        project_name: { type: 'string' },
        documents: { type: 'array', items: { type: 'string' } }
      },
      required: ['project_name']
    }
  },

  apply_patch: {
    description: 'Apply unified diff patches. Better than replace_text for complex edits.',
    run: t.applyPatch,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        patch: { type: 'string' }
      },
      required: ['path', 'patch']
    }
  },

  insert_text: {
    description: 'Insert content at line/position.',
    run: t.insertText,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        line: { type: 'number' },
        content: { type: 'string' }
      },
      required: ['path', 'line', 'content']
    }
  },

  append_file: {
    description: 'Append content to existing files.',
    run: t.appendFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        content: { type: 'string' }
      },
      required: ['path', 'content']
    }
  },

  delete_file: {
    description: 'Remove file (requires confirmation).',
    run: t.deleteFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },

  copy_file: {
    description: 'Duplicate files or directories.',
    run: t.copyFile,
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        destination: { type: 'string' }
      },
      required: ['source', 'destination']
    }
  },

  // Code intelligence
  get_symbols: {
    description: 'Extract classes/functions/types from a file.',
    run: t.getSymbols,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },

  find_symbol: {
    description: 'Locate where a function/class/variable is defined.',
    run: t.findSymbol,
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string' }
      },
      required: ['symbol']
    }
  },

  rename_symbol: {
    description: 'Rename symbol and update references.',
    run: t.renameSymbol,
    parameters: {
      type: 'object',
      properties: {
        oldName: { type: 'string' },
        newName: { type: 'string' },
        filePath: { type: 'string' }
      },
      required: ['oldName', 'newName']
    }
  },

  format_file: {
    description: 'Run formatter (prettier, eslint, etc.).',
    run: t.formatFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },

  // Testing / validation
  run_tests: {
    description: 'Execute project test suite.',
    run: t.runTests,
    parameters: { type: 'object', properties: {} }
  },

  run_lint: {
    description: 'Execute linting.',
    run: t.runLint,
    parameters: { type: 'object', properties: {} }
  },

  build_project: {
    description: 'Build application.',
    run: t.buildProject,
    parameters: { type: 'object', properties: {} }
  },

  check_errors: {
    description: 'Run compiler/type checker.',
    run: t.checkErrors,
    parameters: { type: 'object', properties: {} }
  },

  // Package management
  install_package: {
    description: 'Install a dependency (npm/pip/etc).',
    run: t.installPackage,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    }
  },

  remove_package: {
    description: 'Remove a dependency.',
    run: t.removePackage,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      },
      required: ['name']
    }
  },

  list_dependencies: {
    description: 'Show installed packages.',
    run: t.listDependencies,
    parameters: { type: 'object', properties: {} }
  },

  // Git workflow
  git_status: {
    description: 'Get current git repository status.',
    run: t.gitStatus,
    parameters: { type: 'object', properties: {} }
  },

  git_diff: {
    description: 'Show git diff.',
    run: t.gitDiff,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  git_log: {
    description: 'Show git log.',
    run: t.gitLog,
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number' }
      }
    }
  },

  git_add: {
    description: 'Stage changes.',
    run: t.gitAdd,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', default: '.' }
      }
    }
  },

  git_commit: {
    description: 'Commit changes.',
    run: t.gitCommit,
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      },
      required: ['message']
    }
  },

  git_branch: {
    description: 'List or create branches.',
    run: t.gitBranch,
    parameters: { type: 'object', properties: {} }
  },

  git_checkout: {
    description: 'Switch branches.',
    run: t.gitCheckout,
    parameters: {
      type: 'object',
      properties: {
        branch: { type: 'string' }
      },
      required: ['branch']
    }
  },

  // Environment
  environment_info: {
    description: 'OS, CPU, GPU, installed tools.',
    run: t.environmentInfo,
    parameters: { type: 'object', properties: {} }
  },

  docker_status: {
    description: 'List containers/images.',
    run: t.dockerStatus,
    parameters: { type: 'object', properties: {} }
  },

  // Communication
  send_notification: {
    description: 'Notify Discord/webhook.',
    run: t.sendNotification,
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' }
      },
      required: ['message']
    }
  },

  // Basic File Ops (Legacy/Standard)
  list_directory: {
    description: 'List files.',
    run: t.listDirectory,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  },

  open_file: {
    description: 'Open file.',
    run: t.openFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },

  read_file: {
    description: 'Read file.',
    run: t.readFile,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      },
      required: ['path']
    }
  },

  replace_text: {
    description: 'Replace text.',
    run: t.replaceText,
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        searchText: { type: 'string' },
        replaceText: { type: 'string' }
      },
      required: ['path', 'searchText', 'replaceText']
    }
  },

  run_npm: {
    description: 'Run npm command.',
    run: t.runNpm,
    parameters: {
      type: 'object',
      properties: {
        args: { type: 'string' }
      }
    }
  },

  terminal: {
    description: 'Run terminal command.',
    run: t.terminal,
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' }
      },
      required: ['command']
    }
  },

  // Agent workflow
  create_task: {
    description: 'Create tracked task/checklist.',
    run: t.createTask,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' }
      },
      required: ['title']
    }
  },

  update_task: {
    description: 'Mark progress.',
    run: t.updateTask,
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['todo', 'in-progress', 'done'] }
      },
      required: ['id', 'status']
    }
  },

  get_task_status: {
    description: 'Retrieve active tasks.',
    run: t.getTaskStatus,
    parameters: { type: 'object', properties: {} }
  },

  // Documentation
  generate_readme: {
    description: 'Create/update README.',
    run: t.generateReadme,
    parameters: { type: 'object', properties: {} }
  },

  summarize_project: {
    description: 'Produce architecture overview.',
    run: t.summarizeProject,
    parameters: { type: 'object', properties: {} }
  }
} as const;
