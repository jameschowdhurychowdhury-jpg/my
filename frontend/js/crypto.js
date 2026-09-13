/**
 * Zero-Knowledge Client-Side Encryption Module
 * Standard: AES-GCM (256-bit key) with PBKDF2 derivation
 */

const CryptoEngine = {
  derivedKey: null,
  fixedSalt: new TextEncoder().encode("lantern-secret-salt-2026"),

  /**
   * Derive a 256-bit AES-GCM encryption key from a user-provided passphrase
   */
  async initKey(passphrase) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    this.derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: this.fixedSalt,
        iterations: 100000,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );

    return true;
  },

  /**
   * Encrypt plaintext string into an AES-GCM payload with an initialization vector (IV)
   */
  async encrypt(text) {
    if (!this.derivedKey) throw new Error("Key not initialized");

    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit recommended IV for GCM
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      this.derivedKey,
      enc.encode(text)
    );

    return {
      iv: Array.from(iv),
      cipher: Array.from(new Uint8Array(ciphertext))
    };
  },

  /**
   * Decrypt ciphertext bytes back into a readable string
   */
  async decrypt(encryptedObj) {
    if (!this.derivedKey) throw new Error("Key not initialized");

    try {
      const iv = new Uint8Array(encryptedObj.iv);
      const cipher = new Uint8Array(encryptedObj.cipher);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        this.derivedKey,
        cipher
      );

      const dec = new TextDecoder();
      return dec.decode(decrypted);
    } catch (err) {
      console.error("Decryption failed:", err);
      return "⚠️ Decryption error: Invalid passphrase or corrupted packet.";
    }
  }
};