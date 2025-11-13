import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Create trainer onboarding request
 * @param {string} trainerId - Trainer's Firebase Auth UID
 * @param {Object} details - Trainer details
 * @returns {Promise<{success: boolean, requestId?: string, error?: string}>}
 */
export const createOnboardingRequest = async (trainerId, details) => {
  try {
    const docRef = await addDoc(collection(db, 'trainer_onboarding'), {
      trainerId,
      details,
      status: 'pending',
      submittedAt: serverTimestamp(),
      reviewedBy: null,
      reviewedAt: null,
      rejectionReason: null,
      trainerAccountId: null
    });
    return { success: true, requestId: docRef.id };
  } catch (error) {
    console.error('Error creating onboarding request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all pending onboarding requests
 * @returns {Promise<Array>}
 */
export const getPendingOnboardingRequests = async () => {
  try {
    const q = query(
      collection(db, 'trainer_onboarding'),
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      requestId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching pending onboarding requests:', error);
    return [];
  }
};

/**
 * Get onboarding request by trainer ID
 * @param {string} trainerId
 * @returns {Promise<Object|null>}
 */
export const getOnboardingRequestByTrainer = async (trainerId) => {
  try {
    const q = query(
      collection(db, 'trainer_onboarding'),
      where('trainerId', '==', trainerId)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return {
        requestId: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching onboarding request:', error);
    return null;
  }
};

/**
 * Approve onboarding request
 * @param {string} requestId
 * @param {string} adminUid
 * @param {string} trainerAccountId - ID in trainer_accounts collection
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const approveOnboardingRequest = async (requestId, adminUid, trainerAccountId) => {
  try {
    await updateDoc(doc(db, 'trainer_onboarding', requestId), {
      status: 'approved',
      reviewedBy: adminUid,
      reviewedAt: serverTimestamp(),
      trainerAccountId
    });
    return { success: true };
  } catch (error) {
    console.error('Error approving onboarding request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reject onboarding request
 * @param {string} requestId
 * @param {string} adminUid
 * @param {string} reason
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const rejectOnboardingRequest = async (requestId, adminUid, reason) => {
  try {
    await updateDoc(doc(db, 'trainer_onboarding', requestId), {
      status: 'rejected',
      reviewedBy: adminUid,
      reviewedAt: serverTimestamp(),
      rejectionReason: reason
    });
    return { success: true };
  } catch (error) {
    console.error('Error rejecting onboarding request:', error);
    return { success: false, error: error.message };
  }
};

// Additional functions will be implemented in Phase 2 & 4

