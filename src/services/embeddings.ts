import { readdir, readFile as fsReadFile } from 'fs/promises';
import path from 'path';
import { getCurrentProjectRoot } from './project.js';

export type EmbeddingMetadata = {
  filePath: string;
  chunkIndex: number;
  projectRoot: string;
};

export type ChunkEntry = {
  id: string;
  text: string;
  embedding: number[];
  metadata: EmbeddingMetadata;
};

const localChunkIndex: ChunkEntry[] = [];
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? 'qwen_embedding';

function normalizeProjectName(root: string): string {
  const name = path.basename(root).replace(/[\W_]+/g, '_');
  return name || 'project';
}

function chunkText(content: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = content.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [content];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const slice = words.slice(start, start + chunkSize).join(' ');
    chunks.push(slice);

    if (start + chunkSize >= words.length) {
      break;
    }

    start += chunkSize - overlap;
  }

  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('http://localhost:8080/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${response.statusText} - ${bodyText}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embedding = payload.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error('Embedding response missing vector data.');
  }

  return embedding;
}

async function walkProjectFiles(root: string, callback: (filePath: string) => Promise<void>): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      await walkProjectFiles(entryPath, callback);
      continue;
    }

    if (entry.isFile()) {
      await callback(entryPath);
    }
  }
}

function isTextFile(filePath: string): boolean {
  return /\.(ts|tsx|js|jsx|json|md|txt|html|css|yml|yaml)$/i.test(filePath);
}

async function storeInChroma(chunks: ChunkEntry[]): Promise<void> {
  const chromaUrl = process.env.CHROMA_URL;
  if (!chromaUrl) {
    return;
  }

  const collectionName = normalizeProjectName(getCurrentProjectRoot());
  const body = {
    ids: chunks.map((chunk) => chunk.id),
    documents: chunks.map((chunk) => chunk.text),
    metadatas: chunks.map((chunk) => chunk.metadata),
    embeddings: chunks.map((chunk) => chunk.embedding),
  };

  const response = await fetch(`${chromaUrl}/collections/${encodeURIComponent(collectionName)}/add`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    console.warn(`Chroma storage failed: ${response.status} ${response.statusText} - ${bodyText}`);
  }
}

async function queryChroma(embedding: number[], topK: number): Promise<ChunkEntry[]> {
  const chromaUrl = process.env.CHROMA_URL;
  if (!chromaUrl) {
    return [];
  }

  const collectionName = normalizeProjectName(getCurrentProjectRoot());
  const response = await fetch(`${chromaUrl}/collections/${encodeURIComponent(collectionName)}/query`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query_embeddings: [embedding],
      n_results: topK,
      include: ['metadatas', 'documents', 'distances'],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    console.warn(`Chroma query failed: ${response.status} ${response.statusText} - ${bodyText}`);
    return [];
  }

  const payload = await response.json() as {
    results?: Array<{
      ids?: string[];
      documents?: string[];
      metadatas?: EmbeddingMetadata[];
      distances?: number[];
    }>;
  };

  const result = payload.results?.[0];
  if (!result?.ids) {
    return [];
  }

  return result.ids.map((id, index) => ({
    id,
    text: result.documents?.[index] ?? '',
    metadata: result.metadatas?.[index] ?? { filePath: '', chunkIndex: 0, projectRoot: getCurrentProjectRoot() },
    embedding,
  }));
}

async function ensureQdrantCollection(collectionName: string, vectorSize: number): Promise<void> {
  const qdrantUrl = process.env.QDRANT_URL;
  if (!qdrantUrl) {
    return;
  }

  await fetch(`${qdrantUrl}/collections/${encodeURIComponent(collectionName)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    }),
  });
}

async function storeInQdrant(chunks: ChunkEntry[]): Promise<void> {
  const qdrantUrl = process.env.QDRANT_URL;
  if (!qdrantUrl || chunks.length === 0) {
    return;
  }

  const collectionName = normalizeProjectName(getCurrentProjectRoot());
  const firstChunk = chunks[0];
  if (!firstChunk) {
    return;
  }

  await ensureQdrantCollection(collectionName, firstChunk.embedding.length);

  const points = chunks.map((chunk) => ({
    id: chunk.id,
    vector: chunk.embedding,
    payload: chunk.metadata,
  }));

  const response = await fetch(`${qdrantUrl}/collections/${encodeURIComponent(collectionName)}/points?wait=true`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ points }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    console.warn(`Qdrant storage failed: ${response.status} ${response.statusText} - ${bodyText}`);
  }
}

async function queryQdrant(embedding: number[], topK: number): Promise<ChunkEntry[]> {
  const qdrantUrl = process.env.QDRANT_URL;
  if (!qdrantUrl) {
    return [];
  }

  const collectionName = normalizeProjectName(getCurrentProjectRoot());
  const response = await fetch(`${qdrantUrl}/collections/${encodeURIComponent(collectionName)}/points/search`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      vector: embedding,
      top: topK,
      with_payload: true,
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    console.warn(`Qdrant query failed: ${response.status} ${response.statusText} - ${bodyText}`);
    return [];
  }

  const payload = await response.json() as {
    result?: Array<{ id: string; payload?: EmbeddingMetadata; score?: number }>;
  };

  return payload.result?.map((item) => ({
    id: item.id,
    text: '',
    metadata: item.payload ?? { filePath: '', chunkIndex: 0, projectRoot: getCurrentProjectRoot() },
    embedding,
  })) ?? [];
}

async function storeInPgvector(chunks: ChunkEntry[]): Promise<void> {
  const connectionString = process.env.PGVECTOR_DATABASE_URL;
  if (!connectionString || chunks.length === 0) {
    return;
  }

  try {
    // @ts-ignore
    const { Client } = await import('pg');
    // @ts-ignore
    const { Vector } = await import('pgvector');
    const client = new Client({ connectionString });
    await client.connect();

    const tableName = `chunks_${normalizeProjectName(getCurrentProjectRoot())}`;
    const firstChunk = chunks[0];
    if (!firstChunk) {
      await client.end();
      return;
    }
    const dimension = firstChunk.embedding.length;

    await client.query(`CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL,
      embedding vector(${dimension}) NOT NULL
    )`);

    for (const chunk of chunks) {
      const vector = new Vector(chunk.embedding);
      await client.query(
        `INSERT INTO ${tableName} (id, content, metadata, embedding)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id)
         DO UPDATE SET content = EXCLUDED.content, metadata = EXCLUDED.metadata, embedding = EXCLUDED.embedding`,
        [chunk.id, chunk.text, chunk.metadata, vector],
      );
    }

    await client.end();
  } catch (error) {
    console.warn('pgvector storage skipped or failed:', error instanceof Error ? error.message : String(error));
  }
}

async function queryPgvector(embedding: number[], topK: number): Promise<ChunkEntry[]> {
  const connectionString = process.env.PGVECTOR_DATABASE_URL;
  if (!connectionString) {
    return [];
  }

  try {
    // @ts-ignore
    const { Client } = await import('pg');
    // @ts-ignore
    const { Vector } = await import('pgvector');
    const client = new Client({ connectionString });
    await client.connect();

    const tableName = `chunks_${normalizeProjectName(getCurrentProjectRoot())}`;
    const vector = new Vector(embedding);
    const query = `SELECT id, content, metadata, 1 - (embedding <#> $1) as score FROM ${tableName} ORDER BY embedding <#> $1 ASC LIMIT $2`;
    const result = await client.query(query, [vector, topK]);

    await client.end();

    return result.rows.map((row: any) => ({
      id: row.id,
      text: row.content,
      metadata: row.metadata,
      embedding,
    }));
  } catch (error) {
    console.warn('pgvector query skipped or failed:', error instanceof Error ? error.message : String(error));
    return [];
  }
}

async function storeChunksAcrossStores(chunks: ChunkEntry[]): Promise<void> {
  await Promise.allSettled([
    storeInChroma(chunks),
    storeInQdrant(chunks),
    storeInPgvector(chunks),
  ]);
}

export async function indexCurrentProject(): Promise<void> {
  localChunkIndex.length = 0;
  const projectRoot = getCurrentProjectRoot();

  await walkProjectFiles(projectRoot, async (absolutePath) => {
    if (!isTextFile(absolutePath)) {
      return;
    }

    const content = await fsReadFile(absolutePath, 'utf8');
    const chunks = chunkText(content);
    const relativeFile = path.relative(projectRoot, absolutePath);

    const processedChunks: ChunkEntry[] = [];

    for (const [index, text] of chunks.entries()) {
      if (!text) {
        continue;
      }

      const embedding = await generateEmbedding(text);
      const entry: ChunkEntry = {
        id: `${relativeFile}#${index + 1}`,
        text,
        embedding,
        metadata: {
          filePath: relativeFile,
          chunkIndex: index + 1,
          projectRoot,
        },
      };
      processedChunks.push(entry);
      localChunkIndex.push(entry);
    }

    await storeChunksAcrossStores(processedChunks);
  });
}

export async function retrieveRelevantChunks(query: string, topK = 10): Promise<ChunkEntry[]> {
  if (!query.trim()) {
    throw new Error('Query must not be empty');
  }

  const queryEmbedding = await generateEmbedding(query);
  const results = await Promise.allSettled([
    queryChroma(queryEmbedding, topK),
    queryQdrant(queryEmbedding, topK),
    queryPgvector(queryEmbedding, topK),
  ]);

  const scoredResults: ChunkEntry[] = [];
  for (const settled of results) {
    if (settled.status === 'fulfilled') {
      scoredResults.push(...settled.value);
    }
  }

  if (localChunkIndex.length > 0) {
    const localResults = localChunkIndex
      .map((entry) => ({
        ...entry,
        score: cosineSimilarity(queryEmbedding, entry.embedding),
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, topK)
      .map((entry) => ({
        id: entry.id,
        text: entry.text,
        metadata: entry.metadata,
        embedding: entry.embedding,
      }));

    scoredResults.push(...localResults);
  }

  return scoredResults
    .sort((a, b) => {
      const scoreA = (a as any).score ?? 0;
      const scoreB = (b as any).score ?? 0;
      return scoreB - scoreA;
    })
    .slice(0, topK);
}
