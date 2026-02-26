const crypto = require('crypto');
const { buildPoseidon } = require('circomlibjs');

class ZKPService {
  constructor() {
    this.poseidon = null;
    this.FIELD_SIZE = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    this.initPoseidon();
  }

  async initPoseidon() {
    this.poseidon = await buildPoseidon();
  }

  /**
   * Generate a random challenge for ZKP authentication
   */
  generateChallenge() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate public key from userId and secret phrase
   * This is done on client side, but we need it for verification
   */
  async generatePublicKey(userId, secretPhrase) {
    if (!this.poseidon) {
      await this.initPoseidon();
    }

    const userIdField = this.stringToField(userId);
    const secretField = this.stringToField(secretPhrase);
    
    const hash = this.poseidon([userIdField, secretField]);
    return this.poseidon.F.toString(hash);
  }

  /**
   * Verify ZKP proof (simplified version without full zk-SNARK)
   * In production, use full snarkjs verification with circuits
   */
  async verifyProof(userId, challenge, proof, publicKey) {
    if (!this.poseidon) {
      await this.initPoseidon();
    }

    try {
      // Simplified verification for development
      // In production, this would use snarkjs.groth16.verify()
      
      // Verify proof format
      if (!proof || typeof proof !== 'string') {
        return false;
      }

      // Verify challenge hasn't expired
      const proofData = JSON.parse(proof);
      if (proofData.challenge !== challenge) {
        return false;
      }

      // Verify timestamp (challenge should be recent)
      const proofTimestamp = proofData.timestamp;
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      
      if (now - proofTimestamp > fiveMinutes) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Proof verification error:', error);
      return false;
    }
  }

  /**
   * Generate proof on server side for signing evaluations
   * This proves the evaluator's identity
   */
  async signEvaluation(evaluatorId, evaluationData) {
    if (!this.poseidon) {
      await this.initPoseidon();
    }

    const evaluatorField = this.stringToField(evaluatorId);
    const dataHash = this.hashObject(evaluationData);
    
    const signature = this.poseidon([evaluatorField, dataHash]);
    return this.poseidon.F.toString(signature);
  }

  /**
   * Convert string to field element
   */
  stringToField(str) {
    let hash = BigInt(0);
    for (let i = 0; i < str.length; i++) {
      hash = (hash * BigInt(256) + BigInt(str.charCodeAt(i))) % this.FIELD_SIZE;
    }
    return hash;
  }

  /**
   * Hash object to field element
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    return this.stringToField(str);
  }

  /**
   * Full zk-SNARK verification (for production with compiled circuits)
   * This would use the verification key from circuit compilation
   */
  async verifySnarkProof(proof, publicSignals, verificationKey) {
    const snarkjs = require('snarkjs');
    
    try {
      const isValid = await snarkjs.groth16.verify(
        verificationKey,
        publicSignals,
        proof
      );
      return isValid;
    } catch (error) {
      console.error('SNARK verification error:', error);
      return false;
    }
  }
}

module.exports = new ZKPService();
