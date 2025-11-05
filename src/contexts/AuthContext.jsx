import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AuthContext } from './AuthContextValue';

// Session timeout configuration (in milliseconds)
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
const IDLE_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours of inactivity
const WARNING_TIME = 10 * 60 * 1000; // Show warning 10 minutes before idle timeout

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionExpiring, setSessionExpiring] = useState(false);
  
  // Refs for managing timers and activity tracking
  const lastActivityRef = useRef(Date.now());
  const sessionStartTimeRef = useRef(null); // Track when session started
  const sessionTimerRef = useRef(null);
  const warningTimerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const activityListenersRef = useRef([]);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    // Only clear idle warnings, not session expiration warnings (24-hour limit)
    // Session expiration warnings require explicit extension
    setSessionWarning(prev => {
      // If it's a session expiration warning, keep it
      // Only clear if it's an idle warning
      return prev && sessionExpiring ? prev : false;
    });
  }, [sessionExpiring]);

  // Setup activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const listeners = events.map(event => {
      const handler = () => updateActivity();
      document.addEventListener(event, handler, { passive: true });
      return { event, handler };
    });
    activityListenersRef.current = listeners;

    return () => {
      listeners.forEach(({ event, handler }) => {
        document.removeEventListener(event, handler);
      });
    };
  }, [updateActivity]);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    setSessionWarning(false);
    setSessionExpiring(false);
  }, []);

  // Firebase Auth logout (defined early to avoid circular dependency)
  const performLogout = useCallback(async () => {
    try {
      clearAllTimers();
      
      // Clear all session and storage data comprehensively
      sessionStorage.clear();
      localStorage.clear(); // Clear all localStorage (not just authState)
      
      // Clear any indexedDB or other storage if used
      if ('indexedDB' in window) {
        // Clear indexedDB if needed
        try {
          const databases = await indexedDB.databases();
          databases.forEach(db => {
            if (db.name) {
              indexedDB.deleteDatabase(db.name);
            }
          });
        } catch (e) {
          // IndexedDB clearing is optional
        }
      }
      
      // Reset session tracking
      sessionStartTimeRef.current = null;
      lastActivityRef.current = Date.now();
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Reset all state
      setUser(null);
      setSessionWarning(false);
      setSessionExpiring(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, clear local data
      sessionStorage.clear();
      localStorage.clear();
      sessionStartTimeRef.current = null;
      setUser(null);
      setSessionWarning(false);
      setSessionExpiring(false);
      throw error;
    }
  }, [clearAllTimers]);

  // Setup session timeout and idle detection
  const setupSessionTimers = useCallback(async () => {
    clearAllTimers();
    
    if (!auth.currentUser) {
      sessionStartTimeRef.current = null;
      return;
    }

    const now = Date.now();
    lastActivityRef.current = now;
    
    // Set session start time if not already set
    if (!sessionStartTimeRef.current) {
      sessionStartTimeRef.current = now;
      // Store in sessionStorage for persistence across page reloads
      sessionStorage.setItem('sessionStartTime', now.toString());
    } else {
      // Restore from sessionStorage if available
      const storedStartTime = sessionStorage.getItem('sessionStartTime');
      if (storedStartTime) {
        sessionStartTimeRef.current = parseInt(storedStartTime, 10);
      }
    }

    // Check 24-hour session timeout
    const sessionElapsed = now - sessionStartTimeRef.current;
    const timeUntilSessionTimeout = SESSION_TIMEOUT - sessionElapsed;
    
    if (timeUntilSessionTimeout > 0) {
      // Set warning timer (10 minutes before 24-hour timeout)
      if (timeUntilSessionTimeout > WARNING_TIME) {
        warningTimerRef.current = setTimeout(() => {
          setSessionWarning(true);
          setSessionExpiring(true);
        }, timeUntilSessionTimeout - WARNING_TIME);
      } else {
        // Less than 10 minutes left, show warning immediately
        setSessionWarning(true);
        setSessionExpiring(true);
      }

      // Set session expiration timer (24 hours from login)
      sessionTimerRef.current = setTimeout(async () => {
        // 24 hours elapsed, logout user
        await performLogout();
        window.location.href = '/login?reason=session_timeout';
      }, timeUntilSessionTimeout);
    } else {
      // Session already expired
      setSessionWarning(true);
      setSessionExpiring(true);
      await performLogout();
      window.location.href = '/login?reason=session_timeout';
      return;
    }

    // Check for Firebase token expiration (for automatic refresh)
    try {
      const tokenResult = await auth.currentUser.getIdTokenResult();
      const expirationTime = tokenResult.expirationTime ? new Date(tokenResult.expirationTime).getTime() : null;
      
      if (expirationTime) {
        const timeUntilTokenExpiration = expirationTime - now;
        
        // If token expires before session timeout, refresh it
        if (timeUntilTokenExpiration > 0 && timeUntilTokenExpiration < timeUntilSessionTimeout) {
          // Token will expire, Firebase will auto-refresh, but we can also manually refresh
          setTimeout(async () => {
            try {
              await auth.currentUser?.getIdToken(true);
            } catch (error) {
              console.error('Token refresh failed:', error);
            }
          }, timeUntilTokenExpiration);
        }
      }
    } catch (error) {
      console.error('Error checking token expiration:', error);
    }

    // Setup idle timeout check (24 hours of inactivity)
    const checkIdle = () => {
      const idleTime = Date.now() - lastActivityRef.current;
      const sessionElapsed = Date.now() - sessionStartTimeRef.current;
      
      // Check if user has been idle for 24 hours OR total session time is 24 hours
      if (idleTime >= IDLE_TIMEOUT || sessionElapsed >= SESSION_TIMEOUT) {
        // User has been idle for 24 hours or session expired
        setSessionWarning(true);
        setSessionExpiring(true);
        
        // Give user 2 minutes to respond before auto-logout
        idleTimerRef.current = setTimeout(async () => {
          const finalIdleTime = Date.now() - lastActivityRef.current;
          const finalSessionTime = Date.now() - sessionStartTimeRef.current;
          if (finalIdleTime >= IDLE_TIMEOUT + 2 * 60 * 1000 || finalSessionTime >= SESSION_TIMEOUT) {
            await performLogout();
            window.location.href = '/login?reason=idle';
          }
        }, 2 * 60 * 1000);
      } else {
        // Reset idle timer
        if (idleTimerRef.current) {
          clearTimeout(idleTimerRef.current);
        }
        // Check every 5 minutes for idle state
        idleTimerRef.current = setTimeout(checkIdle, 5 * 60 * 1000);
      }
    };

    // Start idle checking (check every 5 minutes)
    idleTimerRef.current = setTimeout(checkIdle, 5 * 60 * 1000);
  }, [clearAllTimers, performLogout]);

  // Firebase Auth state and token listeners
  useEffect(() => {
    // Listen to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user role from Firestore if it exists
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Add role to user object
            setUser({
              ...firebaseUser,
              role: userData.role || 'admin', // Default to admin if no role found
            });
          } else {
            // If no user document exists, determine role from email or default to admin
            const email = firebaseUser.email || '';
            const role = email.includes('trainer') || email.includes('@trainer') 
              ? 'trainer' 
              : 'admin';
            setUser({
              ...firebaseUser,
              role: role,
            });
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          // Default to admin if there's an error
          setUser({
            ...firebaseUser,
            role: 'admin',
          });
        }
        
        // Setup session timers when user logs in
        setupSessionTimers();
      } else {
        setUser(null);
        clearAllTimers();
      }
      setIsLoading(false);
    });

    // Listen to token changes (for refresh)
    const unsubscribeToken = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Token refreshed or changed, reset timers
        setupSessionTimers();
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeToken();
      clearAllTimers();
    };
  }, [setupSessionTimers, clearAllTimers]);

  // Firebase Auth login with proper error handling
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user role after login
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return {
            ...userCredential.user,
            role: userData.role || 'admin',
          };
        }
      } catch (error) {
        console.error('Error fetching user role after login:', error);
      }
      
      // Determine role from email if no Firestore document
      const emailStr = userCredential.user.email || '';
      const role = emailStr.includes('trainer') || emailStr.includes('@trainer') 
        ? 'trainer' 
        : 'admin';
      
      return {
        ...userCredential.user,
        role: role,
      };
    } catch (error) {
      throw error;
    }
  };

  // Firebase Auth logout (public API)
  const logout = performLogout;

  // Extend session (called when user dismisses warning)
  const extendSession = useCallback(async () => {
    if (auth.currentUser) {
      try {
        // Force token refresh
        await auth.currentUser.getIdToken(true);
        
        // Reset 24-hour session timer
        const now = Date.now();
        sessionStartTimeRef.current = now;
        sessionStorage.setItem('sessionStartTime', now.toString());
        
        updateActivity();
        setupSessionTimers();
        setSessionWarning(false);
        setSessionExpiring(false);
      } catch (error) {
        console.error('Error extending session:', error);
      }
    }
  }, [updateActivity, setupSessionTimers]);
  
  const value = {
    user,
    isLoading,
    login,
    logout,
    sessionWarning,
    sessionExpiring,
    extendSession,
    updateActivity
  };

  return <AuthContext.Provider value={value}>{!isLoading && children}</AuthContext.Provider>;
};

// Set display name for Fast Refresh
AuthProvider.displayName = 'AuthProvider';

// Export component
export { AuthProvider };
  