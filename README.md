# ai-gateway

A small AI gateway project with Fastify, tool execution, and vector store support.

## Prerequisites

- Node.js 20+ and npm
- Git repository configured with a remote origin
- SSH access to `192.168.1.81`
- A valid `.env` file in the project root

## Setup

1. Install dependencies locally:

```bash
npm install
```

2. Create a `.env` file from the template and populate the values.

3. Verify the project compiles:

```bash
npx tsc --noEmit
```

## Running locally

Start the server directly with:

```bash
npx tsx src/server.ts
```

## Deploying to the server

After committing your changes, run:

```bash
./deploy.sh
```

If your remote SSH user is different from your local user, set `REMOTE_USER` first:

```bash
REMOTE_USER=alice ./deploy.sh
```

The deploy script will:

1. Verify the working tree is clean.
2. Push the current branch to `origin`.
3. Copy the local `.env` file to the remote server.
4. SSH into `192.168.1.81` and run `git pull` and `npm install` in `~/ai-gateway`.

## Notes

- Keep `.env` out of source control. It is ignored by `.gitignore`.
- This script assumes the remote repository is already cloned at `~/ai-gateway` and has the same remote origin.
