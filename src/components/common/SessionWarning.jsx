import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const SessionWarning = () => {
  const { sessionWarning, sessionExpiring, extendSession, updateActivity } = useAuth();

  if (!sessionWarning) return null;

  const handleExtend = async () => {
    await extendSession();
  };

  const handleDismiss = () => {
    updateActivity();
  };

  return (
    <AnimatePresence>
      {sessionWarning && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed top-0 left-0 right-0 z-[10000] bg-gradient-to-r from-white via-[#F5F5F5] to-white border-b-2 border-[#D0D0D0] shadow-xl"
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <div className="relative flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-[#5A5A5A]" />
                  <motion.div
                    className="absolute inset-0 h-6 w-6"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0.8, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <AlertTriangle className="h-6 w-6 text-[#888888]" />
                  </motion.div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#2C2C2C] mb-1">
                    {sessionExpiring 
                      ? '⏰ Session Expiring Soon' 
                      : '💤 Inactivity Detected'}
                  </p>
                  <p className="text-xs text-[#666666] leading-relaxed">
                    {sessionExpiring
                      ? 'Your 12-hour session will expire soon. Click "Stay Logged In" to extend your session for another 12 hours, or you will be logged out automatically.'
                      : 'You have been inactive for 12 hours. Please click "Stay Logged In" to continue, or you will be logged out in 2 minutes.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={handleExtend}
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Stay Logged In
                  </Button>
                </motion.div>
                <motion.button
                  onClick={handleDismiss}
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-border"
                  aria-label="Dismiss warning"
                >
                  <X className="h-4 w-4 text-primary" />
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionWarning;

