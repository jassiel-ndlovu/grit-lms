import { AVATAR_COUNT } from "./generated/registry";

/**
 * Stable default-avatar pick: FNV-1a (32-bit) over the id's UTF-16 code units,
 * modulo the number of busts. Pure, so server and client agree and a person
 * keeps the same bust across sessions. Adding busts reshuffles everyone, so
 * only append to the set with that in mind.
 */
export function avatarIndexFor(userId: string, count: number = AVATAR_COUNT): number {
  if (!Number.isInteger(count) || count < 1) throw new RangeError("count must be a positive integer");
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % count;
}
