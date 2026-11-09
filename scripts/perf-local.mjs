import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const host = '127.0.0.1';
const port = Number.parseInt(process.env.PERF_LOCAL_PORT || '3100', 10);
const baseUrl = `http://${host}:${port}`;
const cwd = process.cwd();
const nextCli = path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
const server = spawn(process.execPath, [nextCli, 'start', '--hostname', host, '--port', String(port)], {
  cwd,
  env: process.env,
  stdio: 'inherit',
});

let serverExit;
server.once('exit', (code, signal) => { serverExit = { code, signal }; });

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (serverExit) throw new Error(`Local Next server exited before readiness (${JSON.stringify(serverExit)}).`);
    try {
      const response = await fetch(`${baseUrl}/desk`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return;
      lastError = new Error(`Next server readiness returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await delay(300);
  }
  throw new Error(`Local Next server did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

try {
  await waitUntilReady();
  const check = spawn(process.execPath, ['scripts/perf-baseline.mjs', '--check'], {
    cwd,
    env: { ...process.env, PERF_BASE_URL: baseUrl },
    stdio: 'inherit',
  });
  const result = await new Promise((resolve, reject) => {
    check.once('error', reject);
    check.once('exit', (code, signal) => resolve({ code, signal }));
  });
  if (result.signal) throw new Error(`Performance check exited on signal ${result.signal}.`);
  process.exitCode = result.code ?? 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    delay(5000),
  ]);
  if (server.exitCode === null) server.kill('SIGKILL');
}
