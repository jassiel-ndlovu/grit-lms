/**
 * Encryption for stored payment secrets (the reusable card authorisation
 * code on Subscription.authorizationCodeEnc). AES-256-GCM with the key in
 * PAYMENT_ENC_KEY (32 bytes, base64). Format: `v1:<iv>:<tag>:<ciphertext>`,
 * each part base64url. Pure (node:crypto only), checked by
 * scripts/check-payments.ts.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyFrom(raw: string | undefined): Buffer {
  const key = Buffer.from(raw ?? "", "base64");
  if (key.length !== 32) throw new Error("PAYMENT_ENC_KEY must be 32 bytes, base64");
  return key;
}

export function encryptSecret(plain: string, rawKey = process.env.PAYMENT_ENC_KEY): string {
  const key = keyFrom(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(":");
}

/** Throws if the value was tampered with or the key is wrong. */
export function decryptSecret(sealed: string, rawKey = process.env.PAYMENT_ENC_KEY): string {
  const [v, iv, tag, ct] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
