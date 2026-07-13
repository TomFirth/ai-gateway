import Fastify from 'fastify';
import cors from '@fastify/cors';
import chatRouter from './routes/chat.js';
import projectRouter from './routes/project.js';
import conversationsRouter from './routes/conversations.js';

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3000);

await app.register(cors, {
  origin: true,
});

app.register(chatRouter, { prefix: '/chat' });
app.register(projectRouter, { prefix: '/project' });
app.register(conversationsRouter, { prefix: '/conversations' });

app.get('/health', async () => ({ status: 'ok' }));

app.get('/', async () => ({ status: 'ok', message: 'AI Gateway API is running' }));

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.status(500).send({
    error: 'Internal server error',
    message: error instanceof Error ? error.message : String(error),
  });
});

await app.listen({ port, host: '0.0.0.0' });
