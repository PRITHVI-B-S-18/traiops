import { db } from '../firebase';
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { saveTrainerData, loadTrainerData } from './firestoreTrainers';

/**
 * Get all pending onboarding requests
 */
export const getPendingOnboardingRequests = async () => {
  try {
    const requestsRef = collection(db, 'trainer_onboarding');
    const q = query(requestsRef, where('status', '==', 'pending'));
    const querySnapshot = await getDocs(q);
    
    const requests = [];
    querySnapshot.forEach((doc) => {
      requests.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return requests;
  } catch (error) {
    console.error('Error fetching onboarding requests:', error);
    return [];
  }
};

/**
 * Approve an onboarding request
 */
export const approveOnboardingRequest = async (requestId, adminUid) => {
  try {
    const requestRef = doc(db, 'trainer_onboarding', requestId);
    const requestSnap = await getDoc(requestRef);
    
    if (!requestSnap.exists()) {
      throw new Error('Request not found');
    }
    
    const requestData = requestSnap.data();
    const trainerDetails = requestData.details;
    const trainerId = requestData.trainerId;
    
    // Add to trainers collection FIRST (for Schedule Management)
    const trainers = await loadTrainerData();
    
    // Check if trainer already exists
    const existingIndex = trainers.findIndex(t => t.email === trainerDetails.email);
    
    let trainerAccountId = '';
    
    if (existingIndex === -1) {
      // Add new trainer to trainers collection
      trainerAccountId = `neo${Date.now()}`;
      const newTrainer = {
        id: trainerAccountId,
        name: trainerDetails.name,
        email: trainerDetails.email,
        phone: trainerDetails.phone,
        specialization: trainerDetails.specialization,
        experience: trainerDetails.experience || [],
        summary: trainerDetails.summary || '',
        status: 'Active'
      };
      
      trainers.push(newTrainer);
      await saveTrainerData(trainers);
      
      console.log('Trainer added to trainers collection:', trainerAccountId);
    } else {
      trainerAccountId = trainers[existingIndex].id;
    }
    
    // Update user document with trainerAccountId link
    const userRef = doc(db, 'users', trainerId);
    await updateDoc(userRef, {
      onboardingStatus: 'approved',
      displayName: trainerDetails.name,
      trainerAccountId: trainerAccountId, // Link to trainers collection
      updatedAt: serverTimestamp()
    });
    
    // Update request status
    await updateDoc(requestRef, {
      status: 'approved',
      reviewedBy: adminUid,
      reviewedAt: serverTimestamp(),
      trainerAccountId: trainerAccountId // Store the link
    });
    
    return { success: true, trainerAccountId };
  } catch (error) {
    console.error('Error approving onboarding request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Reject an onboarding request
 */
export const rejectOnboardingRequest = async (requestId, adminUid, reason) => {
  try {
    const requestRef = doc(db, 'trainer_onboarding', requestId);
    
    // Update request status
    await updateDoc(requestRef, {
      status: 'rejected',
      reviewedBy: adminUid,
      reviewedAt: serverTimestamp(),
      rejectionReason: reason
    });
    
    // Update user document
    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists()) {
      const requestData = requestSnap.data();
      const userRef = doc(db, 'users', requestData.trainerId);
      await updateDoc(userRef, {
        onboardingStatus: 'rejected'
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error rejecting onboarding request:', error);
    return { success: false, error: error.message };
  }
};

