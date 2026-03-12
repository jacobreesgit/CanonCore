/**
 * Cryptographic utilities for secure credential storage.
 * Uses AES-256-GCM for authenticated encryption.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Converts Buffer to Uint8Array for Node.js 22 crypto compatibility.
 *
 * @param buffer - Buffer to convert
 * @returns Uint8Array view of the buffer
 */
function toUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * Gets the encryption key from environment variable.
 * Must be 32 bytes (256 bits) for AES-256.
 *
 * @returns Encryption key as Uint8Array
 * @throws If ENCRYPTION_KEY is not set or invalid length
 */
function getEncryptionKey(): Uint8Array {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }

  const keyBuffer = Buffer.from(key, "base64");
  if (keyBuffer.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (256 bits)");
  }

  return toUint8Array(keyBuffer);
}

/**
 * Encrypts a credential string using AES-256-GCM.
 *
 * @param plaintext - The credential to encrypt
 * @returns Base64-encoded encrypted string (IV + AuthTag + Ciphertext)
 *
 * @example
 * const encrypted = encryptCredential("my-secret-token");
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const ivBuffer = randomBytes(IV_LENGTH);
  const iv = toUint8Array(ivBuffer);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encryptedPart1 = cipher.update(plaintext, "utf8");
  const encryptedPart2 = cipher.final();
  const authTag = cipher.getAuthTag();

  // Combine: IV + AuthTag + Encrypted using Buffer for concat
  const combined = Buffer.concat([
    ivBuffer,
    authTag,
    encryptedPart1,
    encryptedPart2,
  ] as readonly Uint8Array[]);
  return combined.toString("base64");
}

/**
 * Decrypts a credential string encrypted with encryptCredential.
 *
 * @param ciphertext - Base64-encoded encrypted string
 * @returns Decrypted plaintext credential
 * @throws If decryption fails (invalid key, tampered data)
 *
 * @example
 * const password = decryptCredential(connection.encryptedCredential);
 */
export function decryptCredential(ciphertext: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(ciphertext, "base64");

  const ivBuffer = combined.subarray(0, IV_LENGTH);
  const authTagBuffer = combined.subarray(
    IV_LENGTH,
    IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encryptedBuffer = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const iv = toUint8Array(ivBuffer);
  const authTag = toUint8Array(authTagBuffer);
  const encrypted = toUint8Array(encryptedBuffer);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decryptedPart1 = decipher.update(encrypted);
  const decryptedPart2 = decipher.final();
  const decrypted = Buffer.concat([
    decryptedPart1,
    decryptedPart2,
  ] as readonly Uint8Array[]);

  return decrypted.toString("utf8");
}
