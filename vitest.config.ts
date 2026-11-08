import { defineConfig } from 'vitest/config';
import path from 'node:path';
import fs from 'node:fs';

// Read .env.local into process.env for test runs
const envLocalPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 25000,
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**/*', 'node_modules/**/*'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
