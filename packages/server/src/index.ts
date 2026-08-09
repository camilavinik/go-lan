import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { WebSocketServer } from 'ws';
import { Gateway } from './gateway.js';
import { RoomRegistry } from './rooms.js';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const SHUTDOWN_GRACE_MS = 5000;

const webDist = process.env.WEB_DIST ?? fileURLToPath(new URL('../../web/dist', import.meta.url));

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
const registry = new RoomRegistry();
const gateway = new Gateway(registry, shareOrigin());

app.get('/healthz', async () => ({ status: 'ok', games: registry.size }));

if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
  // Deep links such as /g/ABC123 are client side routes, so they get the app shell.
  app.setNotFoundHandler((_request, reply) => reply.sendFile('index.html'));
} else {
  app.log.warn(`No frontend build at ${webDist}; serving the API only`);
}

const websockets = new WebSocketServer({ server: app.server, path: '/ws' });
websockets.on('connection', (socket) => gateway.handleConnection(socket));

const sweeper = setInterval(() => {
  const removed = registry.sweep();
  if (removed > 0) app.log.info(`Cleared ${removed} idle game(s)`);
}, SWEEP_INTERVAL_MS);
const heartbeat = setInterval(() => gateway.checkHeartbeats(), HEARTBEAT_INTERVAL_MS);

await app.listen({ port: PORT, host: HOST });
for (const address of localAddresses()) {
  app.log.info(`Reachable on http://${address}:${PORT}`);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    clearInterval(sweeper);
    clearInterval(heartbeat);

    // Open game connections would otherwise keep the HTTP server from closing,
    // so a container with a player in it would hang until Docker gave up on it.
    for (const socket of websockets.clients) socket.terminate();
    websockets.close();

    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
    void app.close().then(() => process.exit(0));
  });
}

/**
 * The address to put in invite links. Inside a container we only see the Docker
 * bridge address, which is useless to anyone else, so there it has to be handed
 * to us by whoever started the container.
 */
function shareOrigin(): string | null {
  const configured = process.env.GO_LAN_PUBLIC_ORIGIN?.trim();
  if (configured) return configured;

  if (existsSync('/.dockerenv')) return null;

  const [address] = localAddresses();
  return address ? `http://${address}:${PORT}` : null;
}

/** The addresses other machines in the house can use. */
function localAddresses(): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}
