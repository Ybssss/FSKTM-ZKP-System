import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { authAPI } from '../services/api';
import zkp from '../utils/zkp';
import { X, Shield, CheckCircle, Loader } from 'lucide-react';

const DevicePairingModal = ({ isOpen, onClose, userId, onSuccess }) => {
  const [step, setStep] = useState('idle'); // idle, generating, waiting, processing, success, error
  const [qrData, setQrData] = useState(null);
  const [pairingCode, setPairingCode] = useState(''); // NEW: State to hold the 6-digit code for display
  const [errorMessage, setErrorMessage] = useState('');
  
  const tempPrivateKeyRef = useRef(null);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    if (isOpen && userId) {
      // Reset state just in case it was opened previously
      setStep('idle');
      setQrData(null);
      setPairingCode('');
      
      initializePairing();
    }
    
    // Cleanup polling only when the modal is actually closed or unmounted
    return () => stopPolling();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]); // 🚨 REMOVED 'step' FROM HERE

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const initializePairing = async () => {
    try {
      setStep('generating');
      setErrorMessage('');

      // 1. Generate the Temporary RSA-OAEP Key Pair for E2EE
      const ephemeralKeyPair = await zkp.generateEphemeralKeyPair();
      tempPrivateKeyRef.current = ephemeralKeyPair.privateKey;
      const tempPublicKeyBase64 = await zkp.exportEphemeralPublicKey(ephemeralKeyPair.publicKey);

      // 2. Request pairing code AND send the temp public key to the server
      const { pairingCode: code, expiresAt } = await authAPI.requestPairingCode(userId, tempPublicKeyBase64);
      setPairingCode(code);

      // 3. Prepare the data that goes into the QR code
      const qrPayload = JSON.stringify({
        userId,
        pairingCode: code,
        tempPublicKeyBase64
      });

      setQrData(qrPayload);
      setStep('waiting');

      // 4. Start polling for the encrypted key
      startPolling(userId, code, expiresAt);

    } catch (error) {
      console.error('Pairing initialization failed:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to initialize secure pairing.');
      setStep('error');
    }
  };

  const startPolling = (currentUserId, currentPairingCode, expiresAt) => {
    stopPolling(); 

    pollingIntervalRef.current = setInterval(async () => {
      if (new Date() > new Date(expiresAt)) {
        stopPolling();
        setErrorMessage('Pairing session expired. Please try again.');
        setStep('error');
        return;
      }

      try {
        const response = await authAPI.pollEncryptedKey(currentUserId, currentPairingCode);
        
        if (response.status === 'complete' && response.encryptedPayload) {
          stopPolling();
          processReceivedKey(response.encryptedPayload);
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (error.response && error.response.status === 400) {
          stopPolling();
          setErrorMessage(error.response.data.message || 'Pairing session invalid.');
          setStep('error');
        }
      }
    }, 2500); // Poll every 2.5 seconds
  };

  const processReceivedKey = async (encryptedPayloadBase64) => {
    try {
      setStep('processing');

      // 1. Decrypt the payload using the temporary private key
      const rawPrivateKey = await zkp.decryptPayload(
        tempPrivateKeyRef.current,
        encryptedPayloadBase64
      );

      // 2. Import and permanently save the user's actual ZKP private key
      await zkp.importPrivateKey(userId, rawPrivateKey);

      setStep('success');

      // 3. Wait 1.5s so the user sees success, then trigger login
      setTimeout(() => {
        onSuccess(); 
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Decryption failed:', error);
      setErrorMessage('Failed to decrypt and install the secure key.');
      setStep('error');
    }
  };

  const handleClose = () => {
    stopPolling();
    setStep('idle');
    setQrData(null);
    setPairingCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative">
        <button 
          onClick={handleClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <Shield className="w-12 h-12 text-indigo-600 mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-gray-900">Secure Login Sync</h2>
        </div>
        
        {step === 'generating' && (
          <div className="text-center py-8">
            <Loader className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Establishing secure E2EE tunnel...</p>
          </div>
        )}

        {step === 'waiting' && qrData && (
          <div className="text-center space-y-6">
            <p className="text-sm text-gray-600">
              Open this system on your currently logged-in device, go to <strong>My Devices</strong>, and choose an option below.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center bg-gray-50 p-5 rounded-xl border border-gray-200">
              {/* Option 1: QR Scanner */}
              <div className="flex flex-col items-center sm:border-r border-gray-200 sm:pr-4 pb-4 sm:pb-0 border-b sm:border-b-0">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Option 1: Scan QR</p>
                <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                  <QRCodeSVG value={qrData} size={130} level="H" />
                </div>
              </div>

              {/* Option 2: 6-Digit Code */}
              <div className="flex flex-col items-center sm:pl-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Option 2: Enter Code</p>
                <div className="bg-white w-full py-4 rounded-lg shadow-sm border border-gray-100 mb-2">
                  <span className="text-3xl font-mono font-black text-indigo-600 tracking-[0.2em]">{pairingCode}</span>
                </div>
                <p className="text-xs text-gray-500">Click "Sync with Code"</p>
              </div>
            </div>

            <p className="text-sm text-indigo-600 font-semibold animate-pulse flex items-center justify-center gap-2">
              <Loader className="w-4 h-4 animate-spin" /> Waiting for secure key transfer...
            </p>
          </div>
        )}

        {step === 'processing' && (
          <div className="text-center py-8">
            <Loader className="animate-spin h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-green-600 font-medium">Decrypting security key locally...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-green-700 font-bold text-xl">Sync Complete!</p>
            <p className="text-sm text-gray-500 mt-2">Logging you in automatically...</p>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-8">
            <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-bold">!</div>
            <p className="text-red-600 font-medium mb-5">{errorMessage}</p>
            <button 
              onClick={initializePairing}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 font-semibold transition-colors shadow-sm"
            >
              Generate New Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DevicePairingModal;