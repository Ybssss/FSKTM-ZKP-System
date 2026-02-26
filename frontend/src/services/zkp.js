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
      console.log('🔐 Generating RSA key pair...');
      
      const keyPair = await window.crypto.subtle.generateKey(
        ZKP_CONFIG.algorithm,
        true,
        ZKP_CONFIG.keyUsages
      );

      console.log('✅ Key pair generated');
      return keyPair;
    } catch (error) {
      console.error('❌ Key generation failed:', error);
      throw new Error('Failed to generate cryptographic keys');
    }
  }

  /**
   * Store private key in browser's localStorage (permanent)
   */
  async storePrivateKey(userId, privateKey) {
    try {
      console.log('💾 Storing private key for:', userId);

      const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', privateKey);

      // Validate JWK format
      if (!privateKeyJwk || !privateKeyJwk.kty) {
        throw new Error('Invalid JWK: missing key type (kty)');
      }
      
      console.log('✅ JWK validated:', {
        kty: privateKeyJwk.kty,
        hasModulus: !!privateKeyJwk.n,
        hasExponent: !!privateKeyJwk.e,
        hasPrivateExponent: !!privateKeyJwk.d
      });

      localStorage.setItem(
        `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`,
        JSON.stringify(privateKeyJwk)
      );

      localStorage.setItem(ZKP_CONFIG.storageKeys.userId, userId);

      console.log('✅ Private key stored permanently');
      return true;
    } catch (error) {
      console.error('❌ Failed to store private key:', error);
      throw new Error('Failed to store private key: ' + error.message);
    }
  }

  /**
   * Import private key temporarily (session only - no localStorage)
   */
  importTemporaryKey(userId, keyData) {
    try {
      console.log('⚠️ Importing temporary key for:', userId);
      
      if (!window.zkpTempKeys) {
        window.zkpTempKeys = {};
      }
      
      let jwkToStore = keyData;
      
      // If keyData is an object with privateKey field (backup file format)
      if (keyData.privateKey && typeof keyData.privateKey === 'string') {
        console.log('📦 Detected backup file format, extracting JWK...');
        jwkToStore = JSON.parse(keyData.privateKey);
      }
      
      // Validate it has required fields
      if (!jwkToStore.kty) {
        throw new Error('Invalid JWK format - missing kty field');
      }
      
      window.zkpTempKeys[userId] = jwkToStore;
      
      console.log('✅ Temporary key imported (session only)');
      return true;
    } catch (error) {
      console.error('❌ Failed to import temporary key:', error);
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
      console.error('❌ Failed to export public key:', error);
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
      console.error('❌ Failed to import public key:', error);
      throw new Error('Failed to import public key');
    }
  }

  /**
   * Retrieve private key from storage
   */
  async getPrivateKey(userId) {
    try {
      console.log('🔍 Retrieving private key for:', userId);

      // Check temporary storage first
      if (window.zkpTempKeys && window.zkpTempKeys[userId]) {
        console.log('⚠️ Using temporary key (session only)');
        const privateKeyJwk = window.zkpTempKeys[userId];
        
        return await window.crypto.subtle.importKey(
          'jwk',
          privateKeyJwk,
          ZKP_CONFIG.algorithm,
          true,
          ['sign']
        );
      }

      // Check localStorage
      const privateKeyJwkString = localStorage.getItem(
        `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`
      );

      if (!privateKeyJwkString) {
        console.log('❌ No private key found');
        return null;
      }

      console.log('✅ Using stored key');
      let privateKeyJwk = JSON.parse(privateKeyJwkString);

      // Check if this is a backup file format (has metadata wrapper)
      if (privateKeyJwk.privateKey && typeof privateKeyJwk.privateKey === 'string') {
        console.log('📦 Detected backup file format, extracting JWK...');
        privateKeyJwk = JSON.parse(privateKeyJwk.privateKey);
      }

      // Validate JWK format before importing
      if (!privateKeyJwk || !privateKeyJwk.kty) {
        console.error('❌ Invalid JWK format:', privateKeyJwk);
        throw new Error('Corrupted key data - missing required JWK fields. Please re-register or import a valid backup.');
      }

      const privateKey = await window.crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        ZKP_CONFIG.algorithm,
        true,
        ['sign']
      );

      console.log('✅ Private key retrieved');
      return privateKey;
    } catch (error) {
      console.error('❌ Failed to retrieve private key:', error);
      return null;
    }
  }

  /**
   * Check if user has keys on this device
   */
  hasKeysForUser(userId) {
    // Check temporary storage
    if (window.zkpTempKeys && window.zkpTempKeys[userId]) {
      console.log('✅ Found temporary key');
      return true;
    }
    
    // Check localStorage
    const keyExists = localStorage.getItem(
      `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`
    );
    
    if (keyExists) {
      console.log('✅ Found stored key');
      return true;
    }
    
    console.log('❌ No keys found');
    return false;
  }

  /**
   * Generate cryptographic proof (signature)
   */
  async generateProof(userId, challenge) {
    try {
      console.log('🔐 Generating proof for challenge...');

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

      console.log('✅ Proof generated');
      return signatureBase64;
    } catch (error) {
      console.error('❌ Proof generation failed:', error);
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
      console.error('❌ Export failed:', error);
      throw new Error('Failed to export private key');
    }
  }

  /**
   * Import private key from backup/transfer (permanent)
   */
  async importPrivateKey(userId, privateKeyJwkString) {
    try {
      console.log('📥 Importing private key...');
      
      let dataToStore = privateKeyJwkString;
      let parsedData = JSON.parse(privateKeyJwkString);
      
      // Check if this is a backup file format (has metadata wrapper)
      if (parsedData.privateKey && typeof parsedData.privateKey === 'string') {
        console.log('📦 Detected backup file format, extracting JWK...');
        // Extract the actual JWK from the wrapper
        const actualJwk = JSON.parse(parsedData.privateKey);
        
        // Validate it's a proper JWK
        if (!actualJwk.kty) {
          throw new Error('Invalid JWK in backup file');
        }
        
        // Store just the JWK (without metadata wrapper)
        dataToStore = JSON.stringify(actualJwk);
        console.log('✅ JWK extracted from backup file');
      } else if (!parsedData.kty) {
        // If it doesn't have kty and isn't a backup file, it's invalid
        throw new Error('Invalid key format - not a valid JWK or backup file');
      }

      localStorage.setItem(
        `${ZKP_CONFIG.storageKeys.privateKey}_${userId}`,
        dataToStore
      );

      console.log('✅ Private key imported permanently');
      return true;
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw new Error('Failed to import private key: ' + error.message);
    }
  }

  /**
   * Import private key temporarily (session only, not saved to localStorage)
   */
  importTemporaryKey(userId, keyData) {
    try {
      console.log('⚠️ Importing key temporarily (session only)...');
      
      // Ensure zkpTempKeys exists
      if (!window.zkpTempKeys) {
        window.zkpTempKeys = {};
      }
      
      // Store in memory only
      window.zkpTempKeys[userId] = keyData;
      
      console.log('✅ Temporary key imported for:', userId);
      return true;
    } catch (error) {
      console.error('❌ Temporary import failed:', error);
      throw new Error('Failed to import temporary key');
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
      
      console.log('✅ Keys deleted for:', userId);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete keys:', error);
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
        console.log('✅ All temporary keys cleared');
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to clear temporary keys:', error);
      return false;
    }
  }
}

// Export singleton instance
const zkp = new ZKPAuth();
export default zkp;
