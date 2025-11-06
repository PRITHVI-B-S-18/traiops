import { db } from '../firebase';
import { collection, doc, getDoc, setDoc, updateDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';

const USERS_COLLECTION = 'users';

/**
 * Create or update user document in Firestore
 * @param {string} uid - Firebase Auth UID
 * @param {Object} userData - User data
 * @returns {Promise<void>}
 */
export const createUserDocument = async (uid, userData) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const now = Timestamp.now();
    
    await setDoc(userRef, {
      uid,
      email: userData.email,
      displayName: userData.displayName || '',
      role: userData.role || 'admin',
      status: userData.status || 'active',
      createdAt: now,
      // Role-specific fields
      ...(userData.role === 'program_manager' && {
        assignedLocations: userData.assignedLocations || [],
      }),
      ...(userData.role === 'trainer' && {
        trainerAccountId: userData.trainerAccountId || null,
        locationAccessGranted: userData.locationAccessGranted || false,
        onboardingStatus: userData.onboardingStatus || 'pending',
      }),
    }, { merge: true });
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
};

/**
 * Get user document by UID
 * @param {string} uid - Firebase Auth UID
 * @returns {Promise<Object|null>} - User data or null
 */
export const getUserDocument = async (uid) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching user document:', error);
    throw error;
  }
};

/**
 * Update user role
 * @param {string} uid - Firebase Auth UID
 * @param {string} role - New role ('admin', 'trainer', 'program_manager')
 * @returns {Promise<void>}
 */
export const updateUserRole = async (uid, role) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      role,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

/**
 * Update user status
 * @param {string} uid - Firebase Auth UID
 * @param {string} status - New status ('active', 'inactive')
 * @returns {Promise<void>}
 */
export const updateUserStatus = async (uid, status) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

/**
 * Get all users by role
 * @param {string} role - Role to filter by
 * @returns {Promise<Array>} - Array of users
 */
export const getUsersByRole = async (role) => {
  try {
    const q = query(
      collection(db, USERS_COLLECTION),
      where('role', '==', role)
    );
    const querySnapshot = await getDocs(q);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({
        uid: doc.id,
        ...doc.data(),
      });
    });
    return users;
  } catch (error) {
    console.error('Error fetching users by role:', error);
    throw error;
  }
};

/**
 * Get all Program Managers
 * @returns {Promise<Array>} - Array of Program Managers
 */
export const getProgramManagers = async () => {
  return getUsersByRole('program_manager');
};

/**
 * Get all Trainers
 * @returns {Promise<Array>} - Array of Trainers
 */
export const getTrainerUsers = async () => {
  return getUsersByRole('trainer');
};

/**
 * Update Program Manager's assigned locations
 * @param {string} uid - Program Manager UID
 * @param {Array<string>} locationIds - Array of location IDs
 * @returns {Promise<void>}
 */
export const updateProgramManagerLocations = async (uid, locationIds) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      assignedLocations: locationIds,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating Program Manager locations:', error);
    throw error;
  }
};

/**
 * Update Trainer's location access status
 * @param {string} uid - Trainer UID
 * @param {boolean} granted - Whether location access is granted
 * @returns {Promise<void>}
 */
export const updateTrainerLocationAccess = async (uid, granted) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      locationAccessGranted: granted,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating trainer location access:', error);
    throw error;
  }
};

/**
 * Update Trainer's onboarding status
 * @param {string} uid - Trainer UID
 * @param {string} status - Onboarding status ('pending', 'approved', 'rejected')
 * @returns {Promise<void>}
 */
export const updateTrainerOnboardingStatus = async (uid, status) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      onboardingStatus: status,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating trainer onboarding status:', error);
    throw error;
  }
};

/**
 * Link Trainer user to Trainer account
 * @param {string} uid - Trainer UID
 * @param {string} trainerAccountId - Trainer account ID
 * @returns {Promise<void>}
 */
export const linkTrainerAccount = async (uid, trainerAccountId) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      trainerAccountId,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error linking trainer account:', error);
    throw error;
  }
};

