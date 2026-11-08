/* Reading a customer's photo, or one frame of a short video, in the browser. Nothing leaves the device here. */
/** Downscales a photo to a JPEG data URL so uploads stay small. The photo never leaves memory except for the AI call. */
export function toDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', 0.88));
    };
    const url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image')); };
    img.src = url;
  });
}

/** A video gives one still, taken a moment in so the customer has settled. Stays in the browser like a photo. */
export function videoFrame(file: File, max = 1024): Promise<string> {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
      URL.revokeObjectURL(url);
      v.removeAttribute('src');
      v.load();
    };
    const fail = () => finish(() => rej(new Error('video')));
    const timer = setTimeout(fail, 10000);
    const grab = () => finish(() => {
      try {
        if (!v.videoWidth || !v.videoHeight) throw new Error('video');
        const s = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
        c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.88));
      } catch (err) { rej(err); }
    });
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.onerror = fail;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.onloadeddata = async () => {
      await v.play().catch(() => {}); // iOS decodes no frame until played
      v.pause();
      const at = Math.min(1, (Number.isFinite(v.duration) ? v.duration : 0) / 2);
      if (at > 0) { v.onseeked = grab; v.currentTime = at; } else grab();
    };
    v.src = url;
  });
}

/** A photo, or one frame of a short video, as the downscaled JPEG the try-on uses. */
export function readPhotoOrVideo(file: File): Promise<string> {
  const video = /^video\/(mp4|webm|quicktime)$/.test(file.type) || (!file.type && /\.(mp4|webm|mov)$/i.test(file.name));
  if (!video && !/^image\/(jpeg|png|webp)$/.test(file.type)) return Promise.reject(new Error('type'));
  return video ? videoFrame(file) : toDataUrl(file);
}
