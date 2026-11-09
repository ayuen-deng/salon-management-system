import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseUrl = process.env.PERF_DATABASE_URL;
if (!databaseUrl) throw new Error('Set PERF_DATABASE_URL explicitly to a local scratch PostgreSQL database. .env files are never read.');
if (process.env.PERF_SEED_CONFIRM !== 'YES_CREATE_SCRATCH_DATA') {
  throw new Error('Refusing to seed. Set PERF_SEED_CONFIRM=YES_CREATE_SCRATCH_DATA after confirming this is a disposable scratch database.');
}

let connection;
try {
  connection = new URL(databaseUrl);
} catch {
  throw new Error('PERF_DATABASE_URL must be a PostgreSQL URL.');
}
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
if (connection.protocol !== 'postgres:' && connection.protocol !== 'postgresql:') throw new Error('Only PostgreSQL scratch databases are supported.');
if (!localHosts.has(connection.hostname)) throw new Error('Refusing to seed a remote database. The performance dataset is local scratch only.');
if (connection.searchParams.get('sslmode') === 'require' || connection.searchParams.get('sslmode') === 'verify-full') {
  throw new Error('Refusing a TLS database URL; this script is intended for localhost only.');
}
if (connection.pathname.slice(1) !== 'salon_performance_scratch'
  && !(connection.pathname.slice(1) === 'postgres' && process.env.PERF_LOCAL_SUPABASE_CONFIRM === 'LOCAL_SUPABASE_ONLY')) {
  throw new Error('Database must be named salon_performance_scratch; local Supabase postgres is allowed only with PERF_LOCAL_SUPABASE_CONFIRM=LOCAL_SUPABASE_ONLY.');
}

const env = {
  ...process.env,
  PGHOST: connection.hostname,
  PGPORT: connection.port || '5432',
  PGDATABASE: connection.pathname.slice(1),
  PGUSER: decodeURIComponent(connection.username),
  PGPASSWORD: decodeURIComponent(connection.password),
  PGSSLMODE: 'disable',
};
const seedPath = path.join(root, 'supabase', 'perf', 'seed.sql');
const sql = fs.readFileSync(seedPath, 'utf8');
const psqlArgs = ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', seedPath];
let result = spawnSync('psql', psqlArgs, {
  cwd: root,
  env,
  encoding: 'utf8',
  stdio: ['ignore', 'inherit', 'inherit'],
});

if (result.error?.code === 'ENOENT'
  && connection.pathname.slice(1) === 'postgres'
  && process.env.PERF_LOCAL_SUPABASE_CONFIRM === 'LOCAL_SUPABASE_ONLY') {
  const dockerCandidates = [
    process.env.DOCKER_PATH,
    'docker',
    'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
  ].filter(Boolean);
  let dockerPath;
  for (const candidate of dockerCandidates) {
    const probe = spawnSync(candidate, ['version', '--format', '{{.Server.Version}}'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) {
      dockerPath = candidate;
      break;
    }
  }
  if (!dockerPath) throw new Error('psql is not installed and a Docker CLI/server was not found for the local Supabase database.');
  const container = process.env.PERF_LOCAL_SUPABASE_CONTAINER || 'supabase_db_salon-system';
  result = spawnSync(dockerPath, [
    'exec', '-i', container, 'psql', '--no-psqlrc', '--set', 'ON_ERROR_STOP=1',
    '--username', decodeURIComponent(connection.username), '--dbname', connection.pathname.slice(1),
  ], {
    cwd: root,
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

if (result.error) throw new Error(`Could not start the database client: ${result.error.message}`);
if (result.status !== 0) process.exit(result.status || 1);
