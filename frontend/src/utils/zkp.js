import { ec as EC } from "elliptic";
import SHA256 from "crypto-js/sha256";

// Initialize the secp256k1 Elliptic Curve
const ec = new EC("secp256k1");

const ZKP_CONFIG = {
  storageKeys: {
    privateKey: "zkp_priv",
  },
};

class ZKPAuth {
  // 1. Generate an Elliptic Curve Key Pair
  async generateKeyPair() {
    console.log("🔐 Generating TRUE Elliptic Curve key pair...");
    const key = ec.genKeyPair();
    return {
      privateKey: key.getPrivate("hex"),
      publicKey: key.getPublic("hex"),
    };
  }

  // 2. Generate the Cryptographic Proof (Fiat-Shamir heuristic)
  async generateProof(userId, serverChallenge) {
    console.log("📐 Starting Schnorr Proof Generation...");
    const privKeyHex = await this.getRawPrivateKeyString(userId);
    if (!privKeyHex) throw new Error("No private key found on this device");

    const key = ec.keyFromPrivate(privKeyHex);
    const publicKeyHex = key.getPublic("hex");

    const k = ec.genKeyPair().getPrivate();
    const R = ec.g.mul(k);
    const R_hex = R.encode("hex");

    const h_input = publicKeyHex + R_hex + serverChallenge;
    const h_hex = SHA256(h_input).toString();
    const h_bn = ec.keyFromPrivate(h_hex).getPrivate();

    const x = key.getPrivate();
    const s = k.add(h_bn.mul(x)).umod(ec.curve.n);

    const proofObj = {
      R: R_hex,
      s: s.toString(16),
    };

    // X-RAY LOG
    console.log("✅ Generated Schnorr Proof Object:", proofObj);
    return proofObj;
  }

  async storePrivateKey(userId, privateKeyHex) {
    localStorage.setItem(
      `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`,
      privateKeyHex,
    );
  }

  async importPrivateKey(userId, privateKeyHex) {
    await this.storePrivateKey(userId, privateKeyHex);
  }

  async exportPublicKey(publicKeyHex) {
    return publicKeyHex;
  }

  hasKeysForUser(userId) {
    return !!localStorage.getItem(
      `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`,
    );
  }

  deleteKeys(userId) {
    localStorage.removeItem(`${ZKP_CONFIG.storageKeys.privateKey}_${userId}`);
  }

  async getRawPrivateKeyString(userId) {
    return localStorage.getItem(
      `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`,
    );
  }

  // ==========================================
  // E2EE DEVICE PAIRING BRIDGE
  // ==========================================

  async generateEphemeralKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
    return {
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
    };
  }

  async exportEphemeralPublicKey(publicKey) {
    const exportedPub = await window.crypto.subtle.exportKey("spki", publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(exportedPub)));
  }

  async generateTempSyncKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
    const exportedPub = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey,
    );
    return {
      tempPrivateKey: keyPair.privateKey,
      tempPublicKeyBase64: btoa(
        String.fromCharCode(...new Uint8Array(exportedPub)),
      ),
    };
  }

  async encryptPayload(publicKeyBase64, payloadString) {
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt"],
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encodedPayload = new TextEncoder().encode(payloadString);
    const encryptedPayload = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encodedPayload,
    );

    const binaryDer = Uint8Array.from(atob(publicKeyBase64), (c) =>
      c.charCodeAt(0),
    );
    const rsaPubKey = await window.crypto.subtle.importKey(
      "spki",
      binaryDer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"],
    );
    const exportedAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKey = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      rsaPubKey,
      exportedAesKey,
    );

    return JSON.stringify({
      encryptedAesKey: btoa(
        String.fromCharCode(...new Uint8Array(encryptedAesKey)),
      ),
      iv: btoa(String.fromCharCode(...iv)),
      payload: btoa(String.fromCharCode(...new Uint8Array(encryptedPayload))),
    });
  }

  async decryptSyncKey(encryptedPackageString, privateKey) {
    const pkg = JSON.parse(encryptedPackageString);

    const encryptedAesKeyBuffer = Uint8Array.from(
      atob(pkg.encryptedAesKey),
      (c) => c.charCodeAt(0),
    );
    const rawAesKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKeyBuffer,
    );
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM" },
      true,
      ["decrypt"],
    );

    const iv = Uint8Array.from(atob(pkg.iv), (c) => c.charCodeAt(0));
    const payloadBuffer = Uint8Array.from(atob(pkg.payload), (c) =>
      c.charCodeAt(0),
    );
    const decryptedPayload = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      payloadBuffer,
    );

    return new TextDecoder().decode(decryptedPayload);
  }

  async decryptPayload(privateKey, encryptedPackageString) {
    return await this.decryptSyncKey(encryptedPackageString, privateKey);
  }
}

export default new ZKPAuth();
