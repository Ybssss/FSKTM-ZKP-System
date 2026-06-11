/**
 * Zero-Knowledge Proof Authentication Module
 * RSA-2048 Cryptographic Implementation
 */

const ZKP_CONFIG = {
  algorithm: {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  keyUsages: ['sign', 'verify'],
  storageKeys: {
    privateKey: 'zkp_private_key',
    publicKey: 'zkp_public_key',
    userId: 'zkp_user_id',
  },
};

class ZKPAuth {
  constructor() {
    // Initialize temporary key storage in memory
    if (typeof window !== 'undefined' && !window.zkpTempKeys) {
      window.zkpTempKeys = {};
    }
  }

  /**
   * Generate new cryptographic key pair
   */
  async generateKeyPair() {
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        ZKP_CONFIG.algorithm,
        true,
        ZKP_CONFIG.keyUsages
      );

      return keyPair;
    } catch (error) {
      console.error('Key generation failed:', error);
      throw new Error('Failed to generate cryptographic keys');
    }
  }

  /**
   * Store private key in browser's localStorage (permanent)
   */
  async storePrivateKey(userId, privateKey) {
    try {
      const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', privateKey);

      // Validate JWK format
      if (!privateKeyJwk || !privateKeyJwk.kty) {
        throw new Error('Invalid JWK: missing key type (kty)');
      }
      
      localStorage.setItem(
        `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`,
        JSON.stringify(privateKeyJwk)
      );

      localStorage.setItem(ZKP_CONFIG.storageKeys.userId, userId);

      return true;
    } catch (error) {
      console.error('Failed to store private key:', error);
      throw new Error('Failed to store private key: ' + error.message);
    }
  }

  /**
   * Import private key temporarily (session only - no localStorage)
   */
  importTemporaryKey(userId, keyData) {
    try {
      if (!window.zkpTempKeys) {
        window.zkpTempKeys = {};
      }
      
      let jwkToStore = keyData;
      
      // If keyData is an object with privateKey field (backup file format)
      if (keyData.privateKey && typeof keyData.privateKey === 'string') {
        jwkToStore = JSON.parse(keyData.privateKey);
      }
      
      // Validate it has required fields
      if (!jwkToStore.kty) {
        throw new Error('Invalid JWK format - missing kty field');
      }
      
      window.zkpTempKeys[userId] = jwkToStore;
      
      return true;
    } catch (error) {
      console.error('Failed to import temporary key:', error);
      throw new Error('Failed to import temporary key: ' + error.message);
    }
  }

  /**
   * Export public key to send to server
   */
  async exportPublicKey(publicKey) {
    try {
      const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', publicKey);
      const publicKeyString = JSON.stringify(publicKeyJwk);
      return btoa(publicKeyString);
    } catch (error) {
      console.error('Failed to export public key:', error);
      throw new Error('Failed to export public key');
    }
  }

  /**
   * Import public key from base64 string
   */
  async importPublicKey(publicKeyBase64) {
    try {
      const publicKeyString = atob(publicKeyBase64);
      const publicKeyJwk = JSON.parse(publicKeyString);

      return await window.crypto.subtle.importKey(
        'jwk',
        publicKeyJwk,
        ZKP_CONFIG.algorithm,
        true,
        ['verify']
      );
    } catch (error) {
      console.error('Failed to import public key:', error);
      throw new Error('Failed to import public key');
    }
  }

  /**
   * Retrieve private key from storage
   */
  async getPrivateKey(userId) {
    try {
      if (window.zkpTempKeys && window.zkpTempKeys[userId]) {
        const privateKeyJwk = window.zkpTempKeys[userId];
        
        return await window.crypto.subtle.importKey(
          'jwk',
          privateKeyJwk,
          ZKP_CONFIG.algorithm,
          true,
          ['sign']
        );
      }

      const privateKeyJwkString = localStorage.getItem(
        `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`
      );

      if (!privateKeyJwkString) {
        return null;
      }

      let privateKeyJwk = JSON.parse(privateKeyJwkString);

      if (privateKeyJwk.privateKey && typeof privateKeyJwk.privateKey === 'string') {
        privateKeyJwk = JSON.parse(privateKeyJwk.privateKey);
      }

      if (!privateKeyJwk || !privateKeyJwk.kty) {
        console.error('Invalid JWK format:', privateKeyJwk);
        throw new Error('Corrupted key data - missing required JWK fields. Please re-register or import a valid backup.');
      }

      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        ZKP_CONFIG.algorithm,
        true,
        ['sign']
      );

      return privateKey;
    } catch (error) {
      console.error('Failed to retrieve private key:', error);
      return null;
    }
  }

  /**
   * Check if user has keys on this device
   */
  hasKeysForUser(userId) {
    if (window.zkpTempKeys && window.zkpTempKeys[userId]) {
      return true;
    }

    const keyExists = localStorage.getItem(
      `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`
    );
    
    if (keyExists) {
      return true;
    }

    return false;
  }

  /**
   * Generate cryptographic proof (signature)
   */
  async generateProof(userId, challenge) {
    try {
      const privateKey = await this.getPrivateKey(userId);
      
      if (!privateKey) {
        throw new Error('No private key found for this device');
      }

      const dataToSign = `${userId}:${challenge}`;
      const encoder = new TextEncoder();
      const data = encoder.encode(dataToSign);

      const signature = await window.crypto.subtle.sign(
        ZKP_CONFIG.algorithm.name,
        privateKey,
        data
      );

      const signatureArray = Array.from(new Uint8Array(signature));
      const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

      return signatureBase64;
    } catch (error) {
      console.error('Proof generation failed:', error);
      throw new Error('Failed to generate proof: ' + error.message);
    }
  }

  /**
   * Export private key for backup/transfer
   */
  async exportPrivateKey(userId) {
    try {
      const privateKeyJwkString = localStorage.getItem(
        `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`
      );

      if (!privateKeyJwkString) {
        throw new Error('No private key found');
      }

      return privateKeyJwkString;
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export private key');
    }
  }

  /**
   * Import private key from backup/transfer (permanent)
   */
  async importPrivateKey(userId, privateKeyJwkString) {
    try {
      let dataToStore = privateKeyJwkString;
      let parsedData = JSON.parse(privateKeyJwkString);
      
      if (parsedData.privateKey && typeof parsedData.privateKey === 'string') {
        const actualJwk = JSON.parse(parsedData.privateKey);
        
        if (!actualJwk.kty) {
          throw new Error('Invalid JWK in backup file');
        }
        
        dataToStore = JSON.stringify(actualJwk);
      } else if (!parsedData.kty) {
        throw new Error('Invalid key format - not a valid JWK or backup file');
      }

      localStorage.setItem(
        `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`,
        dataToStore
      );

      return true;
    } catch (error) {
      console.error('Import failed:', error);
      throw new Error('Failed to import private key: ' + error.message);
    }
  }


  /**
   * Delete keys for user
   */
  deleteKeys(userId) {
    try {
      localStorage.removeItem(`${ZKP_CONFIG.storageKeys.privateKey}_${userId}`);
      localStorage.removeItem(ZKP_CONFIG.storageKeys.userId);
      
      if (window.zkpTempKeys && window.zkpTempKeys[userId]) {
        delete window.zkpTempKeys[userId];
      }
      
      return true;
    } catch (error) {
      console.error('Failed to delete keys:', error);
      return false;
    }
  }

  /**
   * Clear all temporary keys from memory
   */
  clearTemporaryKeys() {
    try {
      if (window.zkpTempKeys) {
        window.zkpTempKeys = {};
      }
      return true;
    } catch (error) {
      console.error('Failed to clear temporary keys:', error);
      return false;
    }
  }
}

// Export singleton instance
const zkp = new ZKPAuth();
export default zkp;
