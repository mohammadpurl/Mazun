import sharp from 'sharp';

/* Pictures for the free try-on model (OOTDiffusion), which reads a 768×1024 portrait of the person and one of the
   garment. Kept out of the route so it can be tested. */

export const FRAME_W = 768, FRAME_H = 1024;
/** Enough for any phone photo; stops a small file that decodes to gigabytes. */
const PIXELS = 24e6;

/** The garment cut-out flattened on white and centred in the 3:4 frame with a margin. */
export async function garmentFrame(src: Buffer): Promise<Buffer> {
  const inner = await sharp(src, { limitInputPixels: PIXELS }).flatten({ background: '#ffffff' })
    .resize(Math.round(FRAME_W * 0.86), Math.round(FRAME_H * 0.94), { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const l = Math.floor((FRAME_W - inner.info.width) / 2), t = Math.floor((FRAME_H - inner.info.height) / 2);
  return sharp(inner.data)
    .extend({ top: t, bottom: FRAME_H - inner.info.height - t, left: l, right: FRAME_W - inner.info.width - l, background: '#ffffff' })
    .jpeg({ quality: 92 }).toBuffer();
}

/** The customer's photo in the same frame. She must stay whole, head to feet, or the model cannot find her: a tall
 *  photo is fitted inside the frame, a wide camera frame keeps its full height and loses only its sides. The photo's
 *  own orientation (EXIF) decides which it is. */
export async function personFrame(data: Buffer): Promise<Buffer> {
  const md = await sharp(data, { limitInputPixels: PIXELS }).metadata();
  const { width = FRAME_W, height = FRAME_H } = md.autoOrient ?? md;
  const tall = width / height < FRAME_W / FRAME_H;
  return sharp(data, { limitInputPixels: PIXELS }).rotate().flatten({ background: '#ececec' })
    .resize(FRAME_W, FRAME_H, tall ? { fit: 'contain', background: '#ececec' } : { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 92 }).toBuffer();
}

/** The model's answer re-encoded as a JPEG, with the same size guard. */
export function toJpeg(data: Buffer): Promise<Buffer> {
  return sharp(data, { limitInputPixels: PIXELS }).jpeg({ quality: 90 }).toBuffer();
}
