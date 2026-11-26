/** Small (256px) copy stored next to every image uploaded since thumbnails were added. */
export const THUMB_KEY_RE = /^[0-9a-f-]{36}\.thumb\.webp$/;
export const thumbKey = (key: string) => key.replace(/\.[a-z]+$/, ".thumb.webp");
