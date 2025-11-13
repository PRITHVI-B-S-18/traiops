import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { loadTrainerData } from './firestoreTrainers';
import { createInvitation, resendInvitation } from './firestoreInvitations';

/**
 * Check if a user document exists in Firestore
 * @param {string} email - Email to check
 * @returns {Promise<{exists: boolean, uid?: string}>}
 */
export const checkUserDocExists = async (email) => {
  try {
    // Validate email before querying
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return { exists: false, error: 'Invalid email' };
    }
    
    // Firestore queries are case-sensitive, so we need to query with original email
    // But we'll also try lowercase as fallback for case-insensitive matching
    const normalizedEmail = email.trim().toLowerCase();
    const originalEmail = email.trim();
    
    const usersRef = collection(db, 'users');
    
    // Try original email first (most common case)
    let q = query(usersRef, where('email', '==', originalEmail));
    let snapshot = await getDocs(q);
    
    // If not found, try lowercase (for case-insensitive matching)
    if (snapshot.empty && originalEmail !== normalizedEmail) {
      q = query(usersRef, where('email', '==', normalizedEmail));
      snapshot = await getDocs(q);
    }
    
    // If still not found, try fetching all and comparing case-insensitively
    if (snapshot.empty) {
      const allUsersSnapshot = await getDocs(usersRef);
      const matchingDoc = allUsersSnapshot.docs.find(doc => {
        const docEmail = doc.data().email;
        return docEmail && docEmail.trim().toLowerCase() === normalizedEmail;
      });
      
      if (matchingDoc) {
        return {
          exists: true,
          uid: matchingDoc.id,
          data: matchingDoc.data()
        };
      }
    } else {
      const userDoc = snapshot.docs[0];
      return {
        exists: true,
        uid: userDoc.id,
        data: userDoc.data()
      };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking user doc:', error);
    return { exists: false, error: error.message };
  }
};

/**
 * Prepare and send an invitation for a trainer.
 * Creates a pending invitation (if one does not already exist) and emails the trainer.
 * @param {Object} trainer - Trainer object from trainers collection
 * @param {string} adminUid - UID of admin creating the invitation
 * @param {Object} options - Additional options
 * @param {boolean} options.forceResend - Resend invitation email if a pending invite already exists
 * @returns {Promise<{success: boolean, skipped?: boolean, trainerName?: string, message?: string, emailSent?: boolean, emailError?: string, error?: string}>}
 */
export const prepareTrainerInvitation = async (trainer, adminUid, options = {}) => {
  try {
    const { forceResend = false } = options || {};
    const { email, name, id: trainerId } = trainer;
    
    // Validate trainer data
    if (!name) {
      return {
        success: false,
        error: 'Missing trainer name',
        trainerName: 'Unknown'
      };
    }
    if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
      return { 
        success: false, 
        error: 'Invalid or missing email',
        trainerName: name
      };
    }
    
    const normalizedEmail = email.trim().toLowerCase();

    // If the user already exists, skip invitation (they are already onboarded)
    const existingUser = await checkUserDocExists(normalizedEmail);
    if (existingUser.exists) {
      return {
        success: true,
        skipped: true,
        trainerName: name,
        message: 'User account already exists'
      };
    }

    // Look for existing pending invitation
    const pendingInvitationQuery = query(
      collection(db, 'invitations'),
      where('email', '==', normalizedEmail),
      where('status', '==', 'pending')
    );
    const pendingInvitations = await getDocs(pendingInvitationQuery);

    if (!pendingInvitations.empty) {
      const invitationDoc = pendingInvitations.docs[0];

      if (forceResend) {
        try {
          await resendInvitation(invitationDoc.id);
          return {
            success: true,
            trainerName: name,
            emailSent: true,
            message: 'Invitation resent successfully'
          };
        } catch (resendError) {
          return {
            success: false,
            trainerName: name,
            error: resendError.message || 'Failed to resend invitation'
          };
        }
      }

      return {
        success: true,
        skipped: true,
        trainerName: name,
        message: 'Invitation already pending'
      };
    }

    // Create a new invitation (sends email internally)
    const invitationResult = await createInvitation(
      {
        email: normalizedEmail,
        displayName: name,
        role: 'trainer',
        trainerAccountId: trainerId || null
      },
      adminUid
    );

    if (!invitationResult.success) {
      const errorMessage = invitationResult.error || 'Failed to create invitation';

      // Treat "already exists" type errors as skips
      if (
        errorMessage.includes('already exists') ||
        errorMessage.includes('already been sent')
      ) {
        return {
          success: true,
          skipped: true,
          trainerName: name,
          message: errorMessage
        };
      }

      return {
        success: false,
        trainerName: name,
        error: errorMessage
      };
    }
    
    return {
      success: true,
      trainerName: name,
      message: 'Invitation sent successfully',
      emailSent: true
    };
  } catch (error) {
    console.error('Error preparing trainer invitation:', error);
    
    return {
      success: false,
      error: error.message,
      trainerName: trainer.name || 'Unknown'
    };
  }
};

/**
 * Sync all trainers from trainers collection to Firebase Auth
 * Creates accounts for trainers that don't have Firebase Auth accounts
 * @param {string} adminUid - UID of admin performing the sync
 * @param {Array<string>} selectedEmails - Optional array of emails to sync (if not provided, syncs all)
 * @returns {Promise<{success: boolean, results: Array, stats: Object}>}
 */
export const syncAllTrainers = async (adminUid, selectedEmails = null) => {
  try {
    // Fetch all trainers from trainers/main document
    let trainers = await loadTrainerData();
    
    if (!trainers || trainers.length === 0) {
      return {
        success: true,
        results: [],
        stats: {
          total: 0,
          created: 0,
          skipped: 0,
          failed: 0,
          emailsSent: 0,
          emailsFailed: 0
        }
      };
    }
    
    // Filter trainers if selectedEmails is provided
    if (selectedEmails && selectedEmails.length > 0) {
      trainers = trainers.filter(t => selectedEmails.includes(t.email));
    }
    
    const results = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    
    // Process each trainer
    for (const trainer of trainers) {
      // Validate trainer has required fields before attempting to create account
      if (!trainer.email || typeof trainer.email !== 'string' || !trainer.email.includes('@')) {
        results.push({
          trainerId: trainer.id,
          trainerName: trainer.name || 'Unknown',
          email: trainer.email || 'N/A',
          success: false,
          error: 'Invalid or missing email'
        });
        failed++;
        continue;
      }
      
      if (!trainer.name) {
        results.push({
          trainerId: trainer.id,
          trainerName: 'Unknown',
          email: trainer.email,
          success: false,
          error: 'Missing trainer name'
        });
        failed++;
        continue;
      }
      
      const result = await prepareTrainerInvitation(trainer, adminUid);
      results.push({
        trainerId: trainer.id,
        trainerName: trainer.name,
        email: trainer.email,
        ...result
      });
      
      if (result.success) {
        if (result.skipped) {
          skipped++;
          // Even if skipped, sync status if user exists
          if (trainer.email) {
            try {
              await syncTrainerStatusToUser(trainer.email, trainer.status);
            } catch (error) {
              console.error('Error syncing status for existing user:', error);
            }
          }
        } else {
          created++;
          if (result.emailSent) emailsSent++;
          if (result.emailError) emailsFailed++;
        }
      } else {
        failed++;
        if (result.emailError) emailsFailed++;
      }
    }
    
    return {
      success: true,
      results,
      stats: {
        total: trainers.length,
        created,
        skipped,
        failed,
        emailsSent,
        emailsFailed
      },
      requiresReLogin: false
    };
  } catch (error) {
    console.error('Error syncing trainers:', error);
    return {
      success: false,
      error: error.message,
      results: [],
      stats: {
        total: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        emailsSent: 0,
        emailsFailed: 0
      }
    };
  }
};

/**
 * Get sync status for all trainers
 * Shows which trainers have accounts and which don't
 * @returns {Promise<Array>} Array of trainers with sync status
 */
export const getTrainerSyncStatus = async () => {
  try {
    // Fetch all trainers from trainers/main document
    const trainers = await loadTrainerData();
    
    if (!trainers || trainers.length === 0) {
      return [];
    }
    
    // Check each trainer's auth status
    const statusPromises = trainers.map(async (trainer) => {
      // Validate trainer has required fields
      const hasValidEmail = trainer.email && typeof trainer.email === 'string' && trainer.email.includes('@');
      
      if (!hasValidEmail) {
        return {
          ...trainer,
          hasAuthAccount: false,
          userUid: null,
          hasError: true,
          errorMessage: 'Invalid or missing email'
        };
      }
      
      const userDocCheck = await checkUserDocExists(trainer.email);
      return {
        ...trainer,
        hasAuthAccount: userDocCheck.exists,
        userUid: userDocCheck.uid || null,
        hasError: userDocCheck.error ? true : false,
        errorMessage: userDocCheck.error || null
      };
    });
    
    return await Promise.all(statusPromises);
  } catch (error) {
    console.error('Error getting trainer sync status:', error);
    return [];
  }
};

/**
 * Sync trainer status to user status (from Trainer Accounts to User Management)
 * @param {string} trainerEmail - Trainer email
 * @param {string} trainerStatus - Trainer status ('Active' or 'Inactive')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const syncTrainerStatusToUser = async (trainerEmail, trainerStatus) => {
  try {
    if (!trainerEmail || !trainerStatus) {
      return { success: false, error: 'Missing email or status' };
    }

    // Map trainer status to user status
    const userStatus = trainerStatus === 'Inactive' ? 'inactive' : 'active';

    // Find user by email (normalize email for matching)
    const normalizedEmail = trainerEmail.trim().toLowerCase();
    const userDocCheck = await checkUserDocExists(normalizedEmail);
    if (!userDocCheck.exists) {
      // User doesn't exist yet, skip
      return { success: true, skipped: true, message: 'User account does not exist yet' };
    }

    // Check if status is already the same
    const currentUserStatus = userDocCheck.data?.status;
    if (currentUserStatus === userStatus) {
      return { success: true, skipped: true, message: 'Status already matches' };
    }

    // Update user status
    const userRef = doc(db, 'users', userDocCheck.uid);
    await updateDoc(userRef, {
      status: userStatus,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ Synced trainer status to user: ${trainerEmail} -> ${userStatus}`);
    return { success: true };
  } catch (error) {
    console.error('Error syncing trainer status to user:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Sync user status to trainer status (from User Management to Trainer Accounts)
 * @param {string} userEmail - User email
 * @param {string} userStatus - User status ('active' or 'inactive')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const syncUserStatusToTrainer = async (userEmail, userStatus) => {
  try {
    if (!userEmail || !userStatus) {
      return { success: false, error: 'Missing email or status' };
    }

    // Map user status to trainer status
    const trainerStatus = userStatus === 'inactive' ? 'Inactive' : 'Active';

    // Load trainers and find by email (case-insensitive, trimmed)
    const trainers = await loadTrainerData();
    const normalizedUserEmail = userEmail.trim().toLowerCase();
    const trainerIndex = trainers.findIndex(t => {
      const trainerEmail = (t.email || '').trim().toLowerCase();
      return trainerEmail === normalizedUserEmail;
    });

    if (trainerIndex === -1) {
      // Trainer not found in Trainer Accounts
      return { success: true, skipped: true, message: 'Trainer not found in Trainer Accounts' };
    }

    // Only update if status is actually different
    if (trainers[trainerIndex].status === trainerStatus) {
      return { success: true, skipped: true, message: 'Status already matches' };
    }

    // Update trainer status
    trainers[trainerIndex] = {
      ...trainers[trainerIndex],
      status: trainerStatus
    };

    // Save updated trainers array
    const { saveTrainerData } = await import('./firestoreTrainers');
    await saveTrainerData(trainers);

    console.log(`✅ Synced user status to trainer: ${userEmail} -> ${trainerStatus}`);
    return { success: true };
  } catch (error) {
    console.error('Error syncing user status to trainer:', error);
    return { success: false, error: error.message };
  }
};

