import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { clothLength, easeAngle, inside, sleevePolygon, sleeveTurn, stretch, wrap } from '../src/lib/mirror-fit';
import { FRAME_H, FRAME_W, garmentFrame, personFrame } from '../src/lib/tryon-frames';

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('wrap and easeAngle take the short way round', () => {
  close(wrap(3 * Math.PI / 2), -Math.PI / 2);
  // From just under +π to just over -π is a small step, not a full turn back through 0.
  const eased = easeAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5);
  assert.ok(Math.abs(Math.abs(eased) - Math.PI) < 0.01, String(eased));
});

test('clothLength prefers ankles, then hips, then shoulder width', () => {
  const mid = { x: 0, y: 0 };
  close(clothLength(mid, 100, { x: 0, y: 500 }, { x: 0, y: 200 }), 520);
  close(clothLength(mid, 100, null, { x: 0, y: 200 }), 540);
  close(clothLength(mid, 100, null, null), 380);
});

test('stretch keeps the cloth within believable proportions', () => {
  close(stretch(1, 2000, 100), 1.9);
  close(stretch(1, 10, 100), 0.85);
  close(stretch(1, 120, 100), 1.2);
});

test('sleeveTurn follows the arm, accounts for the stretch, and never turns inside out', () => {
  // A sleeve hanging straight down, arm straight down: no turn.
  close(sleeveTurn(Math.PI / 2, { dx: 0, dy: 1 }, 1, 1), 0);
  // Arm raised level to the side from a hanging sleeve: a quarter turn.
  close(sleeveTurn(0, { dx: 0, dy: 1 }, 1, 1), -Math.PI / 2);
  // A sleeve hanging at 45° in the photo hangs steeper once stretched tall, so it needs less turn to reach 90°.
  assert.ok(Math.abs(sleeveTurn(Math.PI / 2, { dx: 1, dy: 1 }, 1, 2)) < Math.abs(sleeveTurn(Math.PI / 2, { dx: 1, dy: 1 }, 1, 1)));
  assert.ok(Math.abs(sleeveTurn(-Math.PI / 2, { dx: 0, dy: 1 }, 1, 1)) <= 2.4);
});

test('the sleeve cut keeps the skirt with the body', () => {
  const f = { row: 60, cx: 250, span: 260 };
  const left = sleevePolygon(-1, f, 500, 1000);
  // Upper sleeve, outside the torso: cut.
  assert.ok(inside({ x: 60, y: 150 }, left));
  // Torso: kept.
  assert.ok(!inside({ x: 250, y: 150 }, left));
  // Skirt flaring out below the armpit, near the bottom of the cut: kept.
  assert.ok(!inside({ x: 120, y: 480 }, left));
  // The right-hand cut mirrors it.
  assert.ok(inside({ x: 440, y: 150 }, sleevePolygon(1, f, 500, 1000)));
});

test('try-on frames are exactly the model size, whatever the photo shape', async () => {
  const pic = (w: number, h: number, alpha = false) => sharp({ create: { width: w, height: h, channels: alpha ? 4 : 3, background: alpha ? { r: 90, g: 20, b: 30, alpha: 0.5 } : '#884455' } }).png().toBuffer();
  for (const [w, h] of [[400, 1000], [1280, 720], [768, 1024]]) {
    for (const out of [await personFrame(await pic(w, h)), await garmentFrame(await pic(w, h, true))]) {
      const md = await sharp(out).metadata();
      assert.deepEqual([md.width, md.height], [FRAME_W, FRAME_H], `${w}x${h}`);
    }
  }
});
