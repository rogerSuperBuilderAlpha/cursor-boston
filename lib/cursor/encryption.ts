/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export interface EncryptedKey {
  ciphertext: string;
  iv: string;
  authTag: string;
  v: 1;
}

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const rawKey = process.env.CURSOR_KEY_ENC_KEY;
  if (!rawKey) {
    throw new Error("CURSOR_KEY_ENC_KEY not set");
  }

  const key = Buffer.from(rawKey, "base64");
  if (key.length !== 32) {
    throw new Error("CURSOR_KEY_ENC_KEY must be 32 bytes (base64)");
  }

  cachedKey = key;
  return key;
}

export function encryptApiKey(plaintext: string): EncryptedKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    v: 1,
  };
}

export function decryptApiKey(encrypted: EncryptedKey): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(encrypted.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function fingerprintApiKey(plaintext: string): string {
  return `${plaintext.slice(0, 7)}...${plaintext.slice(-4)}`;
}
