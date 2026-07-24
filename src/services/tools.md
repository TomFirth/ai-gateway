// Project understanding
project_info
- Detect language, framework, package manager, runtime, dependencies.

find_files
- Find files by glob/pattern.
- Example: "*.ts", "*.cs", "*.blend"

search_code
- Search source code contents.
- Similar to VS Code global search.

get_file_tree
- Return structured project tree with depth limit.


// File editing improvements
apply_patch
- Apply unified diff patches.
- Better than replace_text for complex edits.

insert_text
- Insert content at line/position.

append_file
- Append content to existing files.

delete_file
- Remove file (ideally confirmation required).

copy_file
- Duplicate files/directories.


// Code intelligence
get_symbols
- Extract classes/functions/types from a file.

find_symbol
- Locate where a function/class/variable is defined.

rename_file
- Rename and update imports/references.

format_file
- Run formatter (prettier, eslint, dotnet format, etc.).


// Testing / validation
run_tests
- Execute project test suite.

run_lint
- Execute linting.

build_project
- Build application.

check_errors
- Run compiler/type checker.


// Package management
install_package
- npm/pip/nuget install.

remove_package
- Remove dependency.

list_dependencies
- Show installed packages.

update_dependencies
- Update package versions.


// Git workflow
git_branch
- List/create/switch branches.

git_add
- Stage changes.

git_commit
- Commit changes.

git_checkout
- Restore files.

git_create_patch
- Generate patch from changes.


// Environment
environment_info
- OS, CPU, GPU, installed tools.

check_command
- Check if executable exists.

docker_status
- List containers/images.

docker_run
- Start containers.


// Agent workflow
create_task
- Create tracked task/checklist.

update_task
- Mark progress.

get_task_status
- Retrieve active tasks.

save_memory
- Store project-specific conventions.

load_memory
- Retrieve project context.


// Documentation
generate_readme
- Create/update README.

generate_docs
- Generate API/code docs.

summarize_project
- Produce architecture overview.


// Blender / 3D pipeline
blender_open_file
- Open .blend file.

blender_run_script
- Execute Python inside Blender.

blender_create_scene
- Generate objects/materials/lights.

blender_render
- Render preview image.

blender_export
- Export FBX/GLB/OBJ.

blender_inspect_scene
- List objects/materials/modifiers.

blender_optimize_mesh
- Reduce poly count.


// Asset generation
generate_texture
- Create texture from prompt.

generate_material
- Create PBR material.

generate_asset_metadata
- Generate names/tags/descriptions.


// Your generator-service specific
create_generation_job
- Add model generation request.

get_generation_status
- Check job progress.

cancel_generation_job
- Stop job.

queue_stats
- Show worker queue.

worker_health
- Check Blender workers.


// Communication
send_notification
- Notify Discord/webhook.

request_confirmation
- Ask user before destructive actions.
