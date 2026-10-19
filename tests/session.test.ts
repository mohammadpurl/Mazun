import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionToken, passwordMatches, SESSION_TTL_MS, verifySessionToken } from '../src/lib/session';

const SECRET = 'x'.repeat(40);

test('a fresh token verifies with the same secret', async () => {
  const t = await createSessionToken(Date.now(), SECRET);
  assert.equal(await verifySessionToken(t, Date.now(), SECRET), true);
});

test('expired, tampered, wrong-secret and garbage tokens are rejected', async () => {
  const now = Date.now();
  const t = await createSessionToken(now, SECRET);
  assert.equal(await verifySessionToken(t, now + SESSION_TTL_MS + 1, SECRET), false, 'expired');
  const [exp, sig] = t.split('.');
  assert.equal(await verifySessionToken(`${Number(exp) + 1000}.${sig}`, now, SECRET), false, 'extended expiry');
  assert.equal(await verifySessionToken(t, now, 'y'.repeat(40)), false, 'other secret');
  for (const bad of [undefined, '', 'abc', '1.2.3', 'x.y']) assert.equal(await verifySessionToken(bad, now, SECRET), false, String(bad));
});

test('a short SESSION_SECRET is refused rather than used', async () => {
  await assert.rejects(createSessionToken(Date.now(), 'short'));
});

test('passwordMatches compares exactly and refuses an empty configured password', async () => {
  assert.equal(await passwordMatches('open sesame', 'open sesame'), true);
  assert.equal(await passwordMatches('open sesame ', 'open sesame'), false);
  assert.equal(await passwordMatches('', ''), false);
});
