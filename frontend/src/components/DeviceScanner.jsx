import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ShieldCheck, XCircle, Loader2, Camera, CheckCircle2 } from 'lucide-react';
import { authAPI } from '../services/api';
import zkp from '../utils/zkp';
import { useAuth } from '../contexts/AuthContext';

const DeviceScanner = ({ onClose }) => {
  const { user } = useAuth(); // Get currently logged in user
  const [step, setStep] = useState('scanning'); // scanning, processing, success, error
  const [errorMessage, setErrorMessage] = useState('');

  const handleScan = async (result) => {
    // Prevent multiple scans while processing
    if (step !== 'scanning' || !result || result.length === 0) return;
    
    const qrText = result[0].rawValue;

    try {
      setStep('processing');
      setErrorMessage('');

      // 1. Parse the QR code payload
      const payload = JSON.parse(qrText);
      const { userId: scannedUserId, pairingCode, tempPublicKeyBase64 } = payload;

      if (!scannedUserId || !pairingCode || !tempPublicKeyBase64) {
        throw new Error('Invalid QR code format.');
      }

      // 2. Security Check: Ensure they are scanning a QR code meant for THEIR account
      if (scannedUserId !== user.userId) {
        throw new Error(`Account mismatch! This QR code is for ${scannedUserId}, but you are logged in as ${user.userId}.`);
      }

      // 3. Get the raw ZKP private key string from this device's localStorage
      const rawPrivateKey = zkp.getRawPrivateKeyString(user.userId);

      // 4. Encrypt the private key using the Lab PC's temporary public key
      const encryptedPayloadBase64 = await zkp.encryptKeyForSync(rawPrivateKey, tempPublicKeyBase64);

      // 5. Submit the encrypted key to the backend bridge
      await authAPI.submitEncryptedKey(pairingCode, encryptedPayloadBase64);

      // 6. Success!
      setStep('success');

      // Auto-close after 2.5 seconds
      setTimeout(() => {
        onClose();
      }, 2500);

    } catch (error) {
      console.error('Secure sync failed:', error);
      setErrorMessage(error.message || 'Failed to process QR code.');
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep('scanning');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            <h2 className="font-semibold">Pair New Device</h2>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 'scanning' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center mb-2">
                Point your camera at the QR code shown on the new device to securely transfer your login keys.
              </p>
              <div className="rounded-xl overflow-hidden border-2 border-indigo-100 shadow-inner bg-black aspect-square">
                <Scanner 
                  onScan={handleScan} 
                  onError={(error) => console.log('Scanner error:', error)}
                  components={{ tracker: true, audio: false }}
                />
              </div>
              <p className="text-xs text-center text-gray-500 font-medium flex items-center justify-center gap-1 mt-4">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                End-to-End Encrypted Transfer
              </p>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">Encrypting Keys</h3>
                <p className="text-sm text-gray-500">Securing and transferring your identity...</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <div>
                <h3 className="text-xl font-bold text-gray-900">Keys Transferred!</h3>
                <p className="text-sm text-gray-500 mt-1">The new device will log in automatically.</p>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Transfer Failed</h3>
                <p className="text-sm text-red-600 mt-1 px-4">{errorMessage}</p>
              </div>
              <button 
                onClick={handleRetry}
                className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
              >
                Scan Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceScanner;