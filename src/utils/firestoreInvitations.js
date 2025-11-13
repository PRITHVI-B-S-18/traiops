import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { sendInvitationEmail } from './resendEmailService';
import { loadTrainerData } from './firestoreTrainers';
import { buildAppUrl } from './appUrls';

/**
 * Generate a unique invitation token
 * @returns {string} Unique token
 */
const generateInvitationToken = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token + Date.now().toString(36); // Add timestamp for uniqueness
};

/**
 * Create a user invitation (doesn't create account, just sends email)
 * @param {Object} invitationData - Invitation data
 * @param {string} invitationData.email - User email
 * @param {string} invitationData.displayName - User display name
 * @param {string} invitationData.role - User role
 * @param {string} adminUid - Admin creating the invitation
 * @returns {Promise<{success: boolean, invitationId?: string, error?: string}>}
 */
export const createInvitation = async (invitationData, adminUid) => {
  try {
    const { email, displayName, role, trainerAccountId = null } = invitationData;
    
    // Validate role
    if (!role || !['trainer', 'program_manager', 'admin'].includes(role)) {
      throw new Error('Invalid role specified');
    }
    
    // Check if user already exists
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', email)
    );
    const existingUsers = await getDocs(usersQuery);
    
    if (!existingUsers.empty) {
      return {
        success: false,
        error: 'A user with this email already exists'
      };
    }
    
    // Check if invitation already exists and is pending
    const invitationsQuery = query(
      collection(db, 'invitations'),
      where('email', '==', email),
      where('status', '==', 'pending')
    );
    const existingInvitations = await getDocs(invitationsQuery);
    
    if (!existingInvitations.empty) {
      return {
        success: false,
        error: 'An invitation has already been sent to this email'
      };
    }
    
    // Generate unique invitation token
    const invitationToken = generateInvitationToken();
    
    // Create invitation document (use token as document ID to simplify security rules)
    const invitationRef = doc(db, 'invitations', invitationToken);
    await setDoc(invitationRef, {
      email,
      displayName,
      role,
      trainerAccountId: trainerAccountId || null,
      invitationToken,
      status: 'pending',
      invitedBy: adminUid,
      invitedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      acceptedAt: null,
      acceptedBy: null,
      lastEmailStatus: null,
      lastEmailId: null,
      lastEmailError: null,
      lastEmailSentAt: null
    });
    
    // Send invitation email with signup link
    const signupUrl = buildAppUrl(`signup?token=${invitationToken}&email=${encodeURIComponent(email)}`);
    
    let emailDeliveryResult = null;
    try {
      emailDeliveryResult = await sendInvitationEmail(
        email,
        displayName,
        role,
        null, // No temp password needed
        null, // No login URL needed
        signupUrl // Signup link with invitation token
      );
      console.log('✅ Invitation email sent to', email);
      
      await updateDoc(invitationRef, {
        lastEmailStatus: 'sent',
        lastEmailId: emailDeliveryResult?.messageId || null,
        lastEmailError: null,
        lastEmailSentAt: serverTimestamp()
      });
    } catch (emailError) {
      console.error('⚠️ Failed to send invitation email:', emailError);
      // Don't fail the invitation if email fails - admin can resend
      await updateDoc(invitationRef, {
        lastEmailStatus: 'failed',
        lastEmailId: null,
        lastEmailError: emailError?.message || 'Failed to send invitation email',
        lastEmailSentAt: serverTimestamp()
      });
    }
    
    return {
      success: true,
      invitationId: invitationRef.id,
      invitationToken,
      emailDeliveryResult
    };
  } catch (error) {
    console.error('Error creating invitation:', error);
    return {
      success: false,
      error: error.message || 'Failed to create invitation'
    };
  }
};

/**
 * Get invitation by token
 * @param {string} token - Invitation token
 * @returns {Promise<{success: boolean, invitation?: Object, error?: string}>}
 */
export const getInvitationByToken = async (token) => {
  try {
    if (!token) {
      return {
        success: false,
        error: 'Invitation token is missing'
      };
    }

    const invitationDoc = await getDoc(doc(db, 'invitations', token));

    if (!invitationDoc.exists()) {
      return {
        success: false,
        error: 'Invalid invitation token'
      };
    }

    const invitation = {
      invitationId: invitationDoc.id,
      ...invitationDoc.data()
    };

    // Check if invitation is expired
    const expiresAt = invitation.expiresAt?.toDate ? invitation.expiresAt.toDate() : null;
    if (expiresAt && expiresAt < new Date()) {
      return {
        success: false,
        error: 'This invitation has expired. Please contact your administrator for a new invitation.'
      };
    }
    
    return {
      success: true,
      invitation
    };
  } catch (error) {
    console.error('Error getting invitation:', error);
    return {
      success: false,
      error: error.message || 'Failed to get invitation'
    };
  }
};

/**
 * Accept invitation and create user account
 * @param {string} invitationToken - Invitation token
 * @param {string} password - User's chosen password
 * @returns {Promise<{success: boolean, uid?: string, error?: string}>}
 */
export const acceptInvitation = async (invitationToken, password) => {
  try {
    // Get invitation
    const invitationResult = await getInvitationByToken(invitationToken);
    
    if (!invitationResult.success) {
      return {
        success: false,
        error: invitationResult.error
      };
    }
    
    const invitation = invitationResult.invitation;
    
    // Import auth functions here to avoid circular dependency
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { auth } = await import('../firebase');
    
    // Create user account
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      invitation.email,
      password
    );
    
    const uid = userCredential.user.uid;
    
    // Create user document in Firestore
    const { setDoc, doc: firestoreDoc } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    
    const userDoc = {
      uid,
      email: invitation.email,
      displayName: invitation.displayName,
      role: invitation.role,
      status: 'active',
      createdAt: serverTimestamp(),
      invitedBy: invitation.invitedBy,
      invitedAt: invitation.invitedAt,
      invitationId: invitation.invitationId,
      mustChangePassword: false // User set their own password
    };
    
    // Add role-specific fields
    if (invitation.role === 'program_manager') {
      userDoc.assignedLocations = [];
    }
    
    if (invitation.role === 'trainer') {
      userDoc.locationAccessGranted = false;
      if (invitation.trainerAccountId) {
        userDoc.onboardingStatus = 'approved';
        userDoc.trainerAccountId = invitation.trainerAccountId;
        try {
          const trainers = await loadTrainerData();
          if (Array.isArray(trainers)) {
            const match = trainers.find(t => (t.id || '') === invitation.trainerAccountId);
            if (match?.name) {
              userDoc.displayName = match.name;
            }
          }
        } catch (trainerLookupError) {
          console.error('Error syncing trainer profile during invitation acceptance:', trainerLookupError);
        }
      } else {
      userDoc.onboardingStatus = 'not_started';
      }
    }
    
    await setDoc(firestoreDoc(db, 'users', uid), userDoc);
    
    // Mark invitation as accepted
    await updateDoc(firestoreDoc(db, 'invitations', invitation.invitationId), {
      status: 'accepted',
      acceptedAt: serverTimestamp(),
      acceptedBy: uid
    });
    
    return {
      success: true,
      uid,
      email: invitation.email,
      displayName: invitation.displayName,
      role: invitation.role
    };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    
    // Handle specific Firebase Auth errors
    let errorMessage = error.message;
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'An account with this email already exists. Please log in instead.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please choose a stronger password.';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Get all invitations
 * @param {string} status - Filter by status (pending, accepted, expired)
 * @returns {Promise<Array>}
 */
export const getAllInvitations = async (status = null) => {
  try {
    let q = query(collection(db, 'invitations'), orderBy('invitedAt', 'desc'));
    
    if (status) {
      q = query(collection(db, 'invitations'), where('status', '==', status), orderBy('invitedAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      invitationId: doc.id,
      ...doc.data(),
      invitedAt: doc.data().invitedAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
      acceptedAt: doc.data().acceptedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return [];
  }
};

/**
 * Resend invitation email
 * @param {string} invitationId - Invitation ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const resendInvitation = async (invitationId) => {
  try {
    const invitationDoc = await getDoc(doc(db, 'invitations', invitationId));
    
    if (!invitationDoc.exists()) {
      return {
        success: false,
        error: 'Invitation not found'
      };
    }
    
    const invitation = invitationDoc.data();
    
    if (invitation.status !== 'pending') {
      return {
        success: false,
        error: 'Can only resend pending invitations'
      };
    }
    
    // Resend email
    const signupUrl = buildAppUrl(`signup?token=${invitation.invitationToken}&email=${encodeURIComponent(invitation.email)}`);
    
    const response = await sendInvitationEmail(
      invitation.email,
      invitation.displayName,
      invitation.role,
      null,
      null,
      signupUrl
    );
    
    await updateDoc(doc(db, 'invitations', invitationId), {
      lastEmailStatus: 'sent',
      lastEmailId: response?.messageId || null,
      lastEmailError: null,
      lastEmailSentAt: serverTimestamp()
    });
    
    return {
      success: true,
      messageId: response?.messageId || null
    };
  } catch (error) {
    console.error('Error resending invitation:', error);

    try {
      await updateDoc(doc(db, 'invitations', invitationId), {
        lastEmailStatus: 'failed',
        lastEmailId: null,
        lastEmailError: error?.message || 'Failed to resend invitation email',
        lastEmailSentAt: serverTimestamp()
      });
    } catch (updateError) {
      console.error('Error recording failed resend attempt:', updateError);
    }

    return {
      success: false,
      error: error.message || 'Failed to resend invitation'
    };
  }
};

/**
 * Subscribe to invitations in real time
 * @param {Object} options
 * @param {('all'|'pending'|'accepted'|'expired')} [options.status='all'] - Filter invitations by status
 * @param {(data: Array) => void} onData - Success callback
 * @param {(error: Error) => void} [onError] - Error callback
 * @returns {() => void} unsubscribe function
 */
export const subscribeToInvitations = (
  { status = 'all' } = {},
  onData,
  onError
) => {
  let invitationsQuery = query(
    collection(db, 'invitations'),
    orderBy('invitedAt', 'desc')
  );

  if (status && status !== 'all') {
    invitationsQuery = query(
      collection(db, 'invitations'),
      where('status', '==', status),
      orderBy('invitedAt', 'desc')
    );
  }

  const unsubscribe = onSnapshot(
    invitationsQuery,
    (snapshot) => {
      const now = new Date();
      const invitations = snapshot.docs.map((snap) => {
        const data = snap.data();
        const invitedAt = data.invitedAt?.toDate ? data.invitedAt.toDate() : null;
        const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : null;
        const acceptedAt = data.acceptedAt?.toDate ? data.acceptedAt.toDate() : null;

        let computedStatus = data.status || 'pending';
        if (
          computedStatus === 'pending' &&
          expiresAt instanceof Date &&
          expiresAt < now
        ) {
          computedStatus = 'expired';
        }

        return {
          invitationId: snap.id,
          ...data,
          status: data.status || 'pending',
          computedStatus,
          invitedAt,
          expiresAt,
          acceptedAt
        };
      });

      if (typeof onData === 'function') {
        onData(invitations);
      }
    },
    (error) => {
      console.error('Real-time invitations listener error:', error);
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  );

  return unsubscribe;
};

