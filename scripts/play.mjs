// One command to get a game running: find a free port, work out this machine's
// address on the network, build and start the container, wait for it to answer
// and open the browser on the address other people can also use.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';

const CONTAINER = 'go-lan';
const CONTAINER_PORT = '8080/tcp';
const FIRST_PORT = 8080;
const LAST_PORT = 8099;
const READY_TIMEOUT_MS = 180_000;

async function main() {
  requireDocker();

  const address = lanAddress();
  const running = alreadyPublishedPort();
  const port = running ?? (await firstFreePort());
  const origin = `http://${address ?? 'localhost'}:${port}`;

  // Rebuilding would replace the container and take any game in progress with
  // it, so leave a healthy one alone. Use `npm run dev` while changing code.
  if (running !== null && containerOrigin() === origin) {
    console.log('go-lan is already running.');
  } else {
    console.log(
      `Starting go-lan on port ${port}. The first run builds the image, so give it a minute.`,
    );

    const started = await run('docker', ['compose', 'up', '-d', '--build'], {
      ...process.env,
      GO_LAN_PORT: String(port),
      GO_LAN_PUBLIC_ORIGIN: origin,
    });
    if (started !== 0) fail('docker compose could not start the app. The output above says why.');
  }

  await waitUntilReady(port);

  console.log('');
  console.log(`  Ready at        ${origin}`);
  if (address) console.log('  Anyone on your network can open that address.');
  else console.log('  No network address found, so only this machine can reach it.');
  console.log('');
  console.log('  Stop it with    npm run stop');
  console.log('');

  openBrowser(origin);
}

function requireDocker() {
  const check = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (check.status !== 0) {
    fail('Docker does not seem to be running. Start Docker Desktop and try again.');
  }
}

/** The address this machine has on the local network, ignoring Docker bridges. */
function lanAddress() {
  const candidates = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (entry.address.startsWith('169.254.')) continue;
      candidates.push(entry.address);
    }
  }

  // Home networks live in these ranges; anything else is likely a VPN or a
  // virtual adapter that the other machines cannot reach.
  const preferred = candidates.find(
    (address) =>
      address.startsWith('192.168.') ||
      address.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(address),
  );

  return preferred ?? candidates[0] ?? null;
}

/** Reuses the port of a container that is already up, so a second run is harmless. */
function alreadyPublishedPort() {
  const result = spawnSync('docker', ['port', CONTAINER, CONTAINER_PORT], { encoding: 'utf8' });
  if (result.status !== 0) return null;

  const match = result.stdout.match(/:(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

/** The address a running container was told to advertise, if any. */
function containerOrigin() {
  const result = spawnSync(
    'docker',
    ['inspect', '--format', '{{range .Config.Env}}{{println .}}{{end}}', CONTAINER],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) return null;

  const line = result.stdout.split('\n').find((entry) => entry.startsWith('GO_LAN_PUBLIC_ORIGIN='));
  return line ? line.slice('GO_LAN_PUBLIC_ORIGIN='.length).trim() || null : null;
}

async function firstFreePort() {
  for (let port = FIRST_PORT; port <= LAST_PORT; port += 1) {
    if (await isFree(port)) return port;
  }
  fail(`Every port between ${FIRST_PORT} and ${LAST_PORT} is busy.`);
}

function isFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '0.0.0.0');
  });
}

function run(command, args, env) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function waitUntilReady(port) {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  fail('The app started but never answered. Check `docker compose logs`.');
}

function openBrowser(url) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(command, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' })
    .on('error', () => {})
    .unref();
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

await main();
