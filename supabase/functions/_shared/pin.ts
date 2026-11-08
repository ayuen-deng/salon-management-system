import { isStrongTemporaryPin } from '../../../src/shared/models/pin-rules.ts';

const PIN_ITERATIONS = 210_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export async function hashTemporaryPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PIN_ITERATIONS }, key, 256);
  return `pbkdf2-sha256$${PIN_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(new Uint8Array(bits))}`;
}

export async function verifyTemporaryPin(pin: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationText, saltText, expectedText] = encoded.split('$');
  if (algorithm !== 'pbkdf2-sha256' || !iterationText || !saltText || !expectedText) return false;
  const iterations = Number(iterationText);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 500_000) return false;
  const salt = fromBase64Url(saltText);
  const expected = fromBase64Url(expectedText);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8));
  if (bits.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

export function generateTemporaryPin(phone: string): string {
  const limit = Math.floor(0x1_0000_0000 / 900_000) * 900_000;
  for (let attempt = 0; attempt < 200; attempt++) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    if (random[0] >= limit) continue;
    const pin = String(100_000 + (random[0] % 900_000));
    if (isStrongTemporaryPin(pin, phone)) return pin;
  }
  throw new Error('Unable to generate a temporary PIN.');
}
