import React, { useState } from 'react';
import { MapPin, Check, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const LocationPermissionModal = ({ onAllow, isOpen }) => {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState(null);

  const handleAllowLocation = async () => {
    setRequesting(true);
    setError(null);

    try {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser');
        setRequesting(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setRequesting(false);
          onAllow({
            latitude,
            longitude,
            accuracy,
            timestamp: new Date().toISOString()
          });
        },
        (error) => {
          setRequesting(false);
          let errorMessage = 'Failed to get location';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please enable location permissions in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Location request timed out';
              break;
            default:
              errorMessage = 'An unknown error occurred';
          }
          
          setError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } catch (err) {
      setError('Failed to access location services');
      setRequesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5A5A5A] to-[#3D3D3D] p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-lg rounded-full flex items-center justify-center">
                <MapPin className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Location Access Required</h2>
                <p className="text-white/80 text-sm">Help us verify your attendance</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Why we need location */}
            <div className="space-y-4">
              <h3 className="font-semibold text-[#2C2C2C] text-lg">Why do we need your location?</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#2C2C2C] font-medium">Verify your attendance</p>
                    <p className="text-xs text-[#666666]">Confirm you're at the correct location for clock-in/out</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#2C2C2C] font-medium">Accurate time tracking</p>
                    <p className="text-xs text-[#666666]">Help maintain precise attendance records</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-[#2C2C2C] font-medium">Required for clock-in/out</p>
                    <p className="text-xs text-[#666666]">Location is needed to submit attendance requests</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900 font-medium">Privacy Notice</p>
                  <p className="text-xs text-blue-800 mt-1">
                    Your location is only used for attendance verification and is recorded only when you clock in or out.
                    We do not track your location continuously.
                  </p>
                </div>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-900 font-medium">Location Access Failed</p>
                    <p className="text-xs text-red-800 mt-1">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handleAllowLocation}
                className="w-full bg-[#5A5A5A] hover:bg-[#3D3D3D] text-white"
                disabled={requesting}
              >
                {requesting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Getting Location...</span>
                  </div>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-2" />
                    Allow Location Access
                  </>
                )}
              </Button>
            </div>

            {/* Required notice */}
            <p className="text-xs text-center text-red-600 font-medium">
              ⚠️ Location access is required to use this application
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LocationPermissionModal;

