import React, { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { AuthContext } from './AuthContextValue';

// Session timeout configuration (in milliseconds)
// Set VITE_DEBUG_SESSION_MINUTES=2 in .env for quick testing of auto logout (2 min instead of 12 hrs)
const DEBUG_MINUTES = import.meta.env.VITE_DEBUG_SESSION_MINUTES
  ? parseInt(import.meta.env.VITE_DEBUG_SESSION_MINUTES, 10) * 60 * 1000
  : null;
const SESSION_TIMEOUT = DEBUG_MINUTES ?? 12 * 60 * 60 * 1000; // 12 hours (or debug override)
const IDLE_TIMEOUT = DEBUG_MINUTES ?? 12 * 60 * 60 * 1000; // 12 hours of inactivity (or debug override)
const WARNING_TIME = DEBUG_MINUTES ? 30 * 1000 : 10 * 60 * 1000; // 10 min before (30 sec when debugging)

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
    // Only clear idle warnings, not session expiration warnings (12-hour limit)
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

    // Check 12-hour session timeout
    const sessionElapsed = now - sessionStartTimeRef.current;
    const timeUntilSessionTimeout = SESSION_TIMEOUT - sessionElapsed;
    
    if (timeUntilSessionTimeout > 0) {
      // Set warning timer (10 minutes before 12-hour timeout)
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

      // Set session expiration timer (12 hours from login)
      sessionTimerRef.current = setTimeout(async () => {
        // 12 hours elapsed, logout user
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

    // Setup idle timeout check (12 hours of inactivity)
    const checkIdle = () => {
      const idleTime = Date.now() - lastActivityRef.current;
      const sessionElapsed = Date.now() - sessionStartTimeRef.current;
      
      // Check if user has been idle for 12 hours OR total session time is 12 hours
      if (idleTime >= IDLE_TIMEOUT || sessionElapsed >= SESSION_TIMEOUT) {
        // User has been idle for 12 hours or session expired
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
    let unsubscribeUserDoc = null; // Real-time listener for user document changes
    
    // Fetch user doc with retries (handles signup race where doc isn't visible yet)
    const getUserDocWithRetry = async (uid, maxRetries = 3) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) return userDoc;
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 300 + attempt * 200));
        }
      }
      return null;
    };

    // Listen to auth state changes
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch user role from Firestore (retry so new signups see their doc)
        try {
          const userDoc = await getUserDocWithRetry(firebaseUser.uid);
          if (userDoc) {
            const userData = userDoc.data();
            
            // Check if user account is active
            if (userData.status === 'inactive') {
              // Sign out the user immediately if account is inactive
              await auth.signOut();
              setUser(null);
              clearAllTimers();
              setIsLoading(false);
              window.location.href = '/login?reason=account_deactivated';
              return;
            }
            
            // If user has mustChangePassword flag set to true, clear it after successful login
            // This handles the case where user reset password via email link
            if (userData.mustChangePassword === true) {
              try {
                await updateDoc(doc(db, 'users', firebaseUser.uid), {
                  mustChangePassword: false
                });
              } catch (error) {
                console.error('Error clearing mustChangePassword flag:', error);
              }
            }
            
            // Add role to user object
            setUser({
              ...firebaseUser,
              role: userData.role || 'admin', // Default to admin if no role found
            });
            
            // Set up real-time listener for user document changes
            // This handles the case where admin deactivates user while they're logged in
            unsubscribeUserDoc = onSnapshot(
              doc(db, 'users', firebaseUser.uid),
              async (snapshot) => {
                if (snapshot.exists()) {
                  const updatedUserData = snapshot.data();
                  
                  // If status changed to inactive while user is logged in
                  if (updatedUserData.status === 'inactive') {
                    console.log('User account deactivated while logged in. Signing out...');
                    
                    // Clear all timers
                    clearAllTimers();
                    
                    // Sign out the user
                    try {
                      await auth.signOut();
                    } catch (error) {
                      console.error('Error signing out:', error);
                    }
                    
                    // Clear user state
                    setUser(null);
                    
                    // Redirect to login with reason
                    window.location.href = '/login?reason=account_deactivated';
                  }
                  
                  // Update user role if it changed
                  if (updatedUserData.role && updatedUserData.role !== user?.role) {
                    setUser(prev => prev ? {
                      ...prev,
                      role: updatedUserData.role
                    } : null);
                  }
                }
              },
              (error) => {
                console.error('Error in user document listener:', error);
              }
            );
          } else {
            // If no user document exists, default to admin
            // Note: All users should be created via invitation system with proper roles
            setUser({
              ...firebaseUser,
              role: 'admin', // Default to admin if no Firestore document
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
        // User logged out, cleanup real-time listener
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc();
          unsubscribeUserDoc = null;
        }
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
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
      clearAllTimers();
    };
  }, [setupSessionTimers, clearAllTimers]);

  // Firebase Auth login with proper error handling
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Fetch user role and status after login
      try {
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check if user account is active
          if (userData.status === 'inactive') {
            // Sign out the user immediately if account is inactive
            await auth.signOut();
            throw {
              code: 'auth/account-disabled',
              message: 'Your account has been deactivated. Please contact your administrator.'
            };
          }
          
          return {
            ...userCredential.user,
            role: userData.role || 'admin',
          };
        }
      } catch (error) {
        // If it's our custom error, re-throw it
        if (error.code === 'auth/account-disabled') {
          throw error;
        }
        console.error('Error fetching user role after login:', error);
      }
      
      // Default to admin if no Firestore document
      // Note: All users should be created via invitation system
      return {
        ...userCredential.user,
        role: 'admin',
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
        
        // Reset 12-hour session timer
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
  