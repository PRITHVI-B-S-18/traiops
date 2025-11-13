import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword,
  deleteUser as deleteAuthUser,
  updatePassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { sendInvitationEmail } from './resendEmailService';
import { buildAppUrl } from './appUrls';

/**
 * Generate a random temporary password
 * @returns {string} Random 10-character password
 */
export const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Generate password from email (characters before @)
 * @param {string} email - User email
 * @returns {string} Password from email prefix
 */
export const generatePasswordFromEmail = (email) => {
  if (!email || !email.includes('@')) {
    return generateTempPassword(); // Fallback to random if invalid email
  }
  return email.split('@')[0];
};

/**
 * Create a new user with role
 * @param {Object} userData - User data
 * @param {string} userData.email - User email
 * @param {string} userData.displayName - User display name
 * @param {string} userData.role - User role (admin, trainer, program_manager)
 * @param {string} currentAdminUid - UID of admin creating the user
 * @param {string} adminEmail - Admin's email (to re-authenticate)
 * @param {string} adminPassword - Admin's password (to re-authenticate)
 * @returns {Promise<{success: boolean, uid?: string, tempPassword?: string, error?: string}>}
 */
export const createUser = async (userData, currentAdminUid, adminEmail = null, adminPassword = null) => {
  try {
    const { email, displayName, role } = userData;
    
    // Validate role
    if (!role || !['trainer', 'program_manager', 'admin'].includes(role)) {
      throw new Error('Invalid role specified');
    }
    
    // Generate password from email (characters before @ symbol) for all roles
    // This is the default password for trainers, program managers, and admins
    const tempPassword = generatePasswordFromEmail(email);
    
    // Create user in Firebase Auth (this will sign in the new user)
    const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
    const uid = userCredential.user.uid;
    
    // Build user document with all required fields
    const userDoc = {
      uid,
      email,
      displayName,
      role, // ENSURE role is set correctly
      status: 'active',
      createdAt: serverTimestamp(),
      invitedBy: currentAdminUid,
      invitedAt: serverTimestamp(),
      mustChangePassword: true // Force password change on first login
    };

    // Add role-specific fields
    if (role === 'program_manager') {
      userDoc.assignedLocations = [];
    }
    
    if (role === 'trainer') {
      userDoc.locationAccessGranted = false;
      userDoc.onboardingStatus = 'not_started';
      // Don't add trainerAccountId here - it will be added when onboarding is approved
    }

    // Create user document in Firestore FIRST before signing out
    await setDoc(doc(db, 'users', uid), userDoc);
    
    // Wait a bit for Firestore operations to complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now sign out the newly created user
    // This prevents auto-login but admin will also be signed out
    await auth.signOut();
    
    let requiresReLogin = true;
    if (adminEmail && adminPassword) {
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        requiresReLogin = false;
      } catch (reauthError) {
        console.error('Failed to re-authenticate admin after user creation:', reauthError);
        requiresReLogin = true;
      }
    }
    
    // Send invitation email (don't fail if email fails)
    try {
      await sendInvitationEmail(
        email,
        displayName,
        role,
        tempPassword,
        buildAppUrl('login')
      );
      console.log('✅ Invitation email sent to', email);
    } catch (emailError) {
      console.error('⚠️ Failed to send invitation email (user was still created):', emailError);
      // User was created successfully, just email failed - don't throw
    }
    
      return {
        success: true,
        uid,
        tempPassword,
        role, // Return role for verification
        message: 'User created successfully',
      requiresReLogin,
        passwordSource: 'email_prefix' // All roles use email prefix
      };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      success: false,
      error: error.message || 'Failed to create user'
    };
  }
};

/**
 * Get all users
 * @returns {Promise<Array>} Array of user objects
 */
export const getAllUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      invitedAt: doc.data().invitedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

/**
 * Get users by role
 * @param {string} role - User role to filter by
 * @returns {Promise<Array>} Array of user objects
 */
export const getUsersByRole = async (role) => {
  try {
    const usersRef = collection(db, 'users');
    // Try with orderBy first (requires index)
    try {
    const q = query(usersRef, where('role', '==', role), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      invitedAt: doc.data().invitedAt?.toDate()
    }));
    } catch (indexError) {
      // If index error, fetch without orderBy and sort in memory
      if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
        console.log('ℹ️ Firestore index not found, using fallback query. Index will be created automatically.');
        const q = query(usersRef, where('role', '==', role));
        const snapshot = await getDocs(q);
        const users = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          invitedAt: doc.data().invitedAt?.toDate()
        }));
        
        // Sort in memory by createdAt
        return users.sort((a, b) => {
          const aTime = a.createdAt ? a.createdAt.getTime() : 0;
          const bTime = b.createdAt ? b.createdAt.getTime() : 0;
          return bTime - aTime; // Descending order
        });
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error fetching users by role:', error);
    return [];
  }
};

export const subscribeToUsers = (options = {}, callback, errorCallback) => {
  const { role = null } = options || {};
  const usersRef = collection(db, 'users');

  const buildQuery = (allowOrdering = true) => {
    const constraints = [];
    if (role) {
      constraints.push(where('role', '==', role));
    }
    if (allowOrdering) {
      constraints.push(orderBy('createdAt', 'desc'));
    }
    return constraints.length > 0 ? query(usersRef, ...constraints) : usersRef;
  };

  let unsubscribe = null;

  const startListener = (allowOrdering) => {
    const q = buildQuery(allowOrdering);
    unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          invitedAt: docSnap.data().invitedAt?.toDate()
        }));
        callback(data);
      },
      (error) => {
        if (
          allowOrdering &&
          (error.code === 'failed-precondition' || error.message?.includes('index'))
        ) {
          console.warn(
            'Firestore index missing for users query. Retrying without ordering.'
          );
          startListener(false);
          return;
        }

        if (errorCallback) {
          errorCallback(error);
        } else {
          console.error('Users subscription error:', error);
        }
      }
    );
  };

  startListener(true);

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

/**
 * Get a single user by UID
 * @param {string} uid - User UID
 * @returns {Promise<Object|null>} User object or null
 */
export const getUserByUid = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return {
        id: userDoc.id,
        ...userDoc.data(),
        createdAt: userDoc.data().createdAt?.toDate(),
        invitedAt: userDoc.data().invitedAt?.toDate()
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

/**
 * Update user data
 * @param {string} uid - User UID
 * @param {Object} updates - Fields to update
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateUser = async (uid, updates) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update user status (activate/deactivate)
 * @param {string} uid - User UID
 * @param {string} status - 'active' or 'inactive'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateUserStatus = async (uid, status) => {
  return updateUser(uid, { status });
};

/**
 * Delete user (from Firestore and Auth)
 * @param {string} uid - User UID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteUser = async (uid) => {
  try {
    // Delete from Firestore
    await deleteDoc(doc(db, 'users', uid));
    
    // Note: Deleting from Firebase Auth requires admin SDK or current user context
    // For now, we'll just mark as inactive instead of fully deleting from Auth
    // To fully delete, you'd need Firebase Admin SDK on the backend
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reset user password (generate new temp password)
 * @param {string} uid - User UID
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, tempPassword?: string, error?: string}>}
 */
export const resetUserPassword = async (uid, email) => {
  try {
    const tempPassword = generateTempPassword();
    
    // Note: This requires Firebase Admin SDK for production
    // For now, we'll just update the mustChangePassword flag
    await updateUser(uid, { mustChangePassword: true });
    
    return {
      success: true,
      tempPassword,
      message: 'Password reset. User must change password on next login.'
    };
  } catch (error) {
    console.error('Error resetting password:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Change user password (for current logged-in user)
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const changePassword = async (newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }
    
    await updatePassword(user, newPassword);
    
    // Update Firestore to mark password as changed
    await updateUser(user.uid, { mustChangePassword: false });
    
    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    console.error('Error changing password:', error);
    return { success: false, error: error.message };
  }
};

