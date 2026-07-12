import { setCurrentProject, getCurrentProjectRoot } from '../services/project.js';

export default async function projectRoutes(fastify: any) {
  fastify.post('/open', async (request: any, reply: any) => {
    const { path } = request.body as { path?: string };

    if (!path || typeof path !== 'string') {
      return reply.status(400).send({ error: 'path is required and must be a string' });
    }

    try {
      const projectRoot = setCurrentProject(path);
      return { status: 'ok', projectRoot };
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  fastify.get('/current', async () => ({ projectRoot: getCurrentProjectRoot() }));
}
