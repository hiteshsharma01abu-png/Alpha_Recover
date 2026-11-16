// `npm run dev:all`: runs the Vite dev server and the API together in one terminal, with each line
// prefixed [web] / [api]. Ctrl+C stops both; if one stops on its own, the other is stopped too.
// Plain Node (no extra packages). MySQL must already be up: `npm run db:up`.
import { spawn } from 'node:child_process';
import { connect } from 'node:net';

const isWindows = process.platform === 'win32';
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const tasks = [
  { name: 'web', script: 'dev', code: 36, port: 5173 },
  // vite.config.ts proxies /api to this port.
  { name: 'api', script: 'dev:api', code: 35, port: 8787 },
];

/** True if something already accepts connections on localhost:port (IPv4 or IPv6). */
const inUse = (port) =>
  Promise.all(
    ['127.0.0.1', '::1'].map(
      (host) =>
        new Promise((resolve) => {
          const socket = connect({ host, port });
          socket.setTimeout(500);
          socket.once('connect', () => (socket.destroy(), resolve(true)));
          socket.once('error', () => resolve(false));
          socket.once('timeout', () => (socket.destroy(), resolve(false)));
        }),
    ),
  ).then((r) => r.some(Boolean));

// tsx watch doesn't exit when the API can't bind its port (it waits for a file change), so a busy
// port would leave a dead API running silently. Check first and say what to do instead.
const busy = [];
for (const t of tasks) if (await inUse(t.port)) busy.push(t);
if (busy.length) {
  for (const t of busy) console.error(`Port ${t.port} is already in use, probably by \`npm run ${t.script}\` in another terminal.`);
  console.error(
    busy.length === tasks.length
      ? 'Both servers seem to be running already: nothing to do.'
      : `Stop it first, or just run \`npm run ${tasks.find((t) => !busy.includes(t)).script}\` for the other one.`,
  );
  process.exit(1);
}

let stopping = false;
const children = tasks.map(({ name, script, code }) => {
  const label = color ? `\x1b[${code}m[${name}]\x1b[0m ` : `[${name}] `;
  // Own process group (POSIX), so stopping npm also stops vite / tsx underneath it.
  const child = spawn(isWindows ? 'npm.cmd' : 'npm', ['run', script], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: !isWindows,
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: color ? '1' : '0' },
  });
  for (const [stream, out] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    let buffered = '';
    stream.on('data', (chunk) => {
      const lines = (buffered + chunk).split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) out.write(label + line + '\n');
    });
    stream.on('end', () => buffered && out.write(label + buffered + '\n'));
  }
  child.on('exit', (exitCode, signal) => {
    if (stopping) return;
    console.error(`${label}stopped (${signal ?? `exit code ${exitCode}`}); stopping the other server.`);
    stopAll(exitCode ?? 1);
  });
  return child;
});

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      if (isWindows) spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      else process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Already gone.
    }
  }
  setTimeout(() => process.exit(exitCode), 500);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
