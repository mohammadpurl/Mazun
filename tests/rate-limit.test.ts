import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allow, clientIp } from '../src/lib/rate-limit';

const req = (headers: Record<string, string>) => new Request('http://localhost/api/orders', { headers });

test('clientIp trusts the hop the proxy appended, not a forged first entry', () => {
  assert.equal(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(req({ 'x-forwarded-for': '203.0.113.9' })), '203.0.113.9');
  assert.equal(clientIp(req({ 'x-vercel-forwarded-for': '198.51.100.4', 'x-forwarded-for': '6.6.6.6, 198.51.100.4' })), '198.51.100.4');
  assert.equal(clientIp(req({ 'x-real-ip': '192.0.2.1' })), '192.0.2.1');
  assert.equal(clientIp(req({})), 'local');
});

test('allow counts within the window and starts over after it', () => {
  const key = `t:${Math.random()}`;
  assert.ok(allow(key, 2, 1000, 0));
  assert.ok(allow(key, 2, 1000, 10));
  assert.ok(!allow(key, 2, 1000, 20));
  assert.ok(allow(key, 2, 1000, 1500));
});
