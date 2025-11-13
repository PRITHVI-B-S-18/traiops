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
  serverTimestamp,
  Timestamp,
  runTransaction,
  onSnapshot
} from 'firebase/firestore';
import { createClockRecord, getClockRecordByDate, updateClockRecord } from './firestoreClockRecords';
import { getMappingsByTrainer } from './firestoreMappings';
import { getUserByUid } from './firestoreUsers';
import {
  notifyProgramManager,
  notifyTrainerApproved,
  notifyTrainerRejected,
  notifyRequestExpiredTrainer,
  notifyRequestExpiredStakeholder,
  notifyRequestCancelled,
  notifyRequestRerouted
} from './resendEmailService';
import { buildAppUrl } from './appUrls';
import { getUsersByRole } from './firestoreUsers';
import { format } from 'date-fns';

/**
 * Check for existing pending or approved requests for the same trainer, date, and type
 * @param {string} trainerId
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} type - 'clock_in' or 'clock_out'
 * @returns {Promise<{exists: boolean, request?: Object}>}
 */
export const checkExistingRequest = async (trainerId, date, type) => {
  try {
    const q = query(
      collection(db, 'clock_requests'),
      where('trainerId', '==', trainerId),
      where('date', '==', date),
      where('type', '==', type),
      where('status', 'in', ['pending', 'approved'])
    );
    
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const existingRequest = {
        requestId: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
      return { exists: true, request: existingRequest };
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking existing request:', error);
    return { exists: false };
  }
};

/**
 * Create a clock-in/out request with server-side validation
 * Auto-routes request to Program Managers assigned to the task (simplified approach)
 * @param {Object} requestData - Request data (should include taskPMIds and taskClientId/taskClientName)
 * @returns {Promise<{success: boolean, requestId?: string, error?: string}>}
 */
export const createClockRequest = async (requestData) => {
  try {
    // Server-side validation: Check for existing requests (prevent concurrent creation)
    const existingCheck = await checkExistingRequest(
      requestData.trainerId,
      requestData.date,
      requestData.type
    );
    
    if (existingCheck.exists) {
      console.log('⚠️ Request already exists for this trainer, date, and type');
      return { 
        success: false, 
        error: 'A request already exists for this date and time. Please check your pending requests.',
        existingRequestId: existingCheck.request?.requestId
      };
    }
    // Get PMs from task assignment (simplified - PMs are selected during scheduling)
    // Fallback to trainer mappings if task PMs not provided (for backward compatibility)
    let assignedPMIds = [];
    let assignedClientIds = [];
    let assignedClientNames = [];

    // Priority 1: Use PMs from task (if provided)
    if (requestData.taskPMIds && Array.isArray(requestData.taskPMIds) && requestData.taskPMIds.length > 0) {
      assignedPMIds = requestData.taskPMIds;
      
      // Also get client info from task if available
      if (requestData.taskClientId) {
        assignedClientIds = [requestData.taskClientId];
      }
      if (requestData.taskClientName) {
        assignedClientNames = [requestData.taskClientName];
      }
      
      console.log(`✅ Using task-assigned PMs: ${assignedPMIds.length} PM(s)`);
    } else {
      // Fallback: Get trainer's mappings (for backward compatibility or non-training tasks)
      const trainerId = requestData.trainerId;
      
      if (trainerId) {
        const mappings = await getMappingsByTrainer(trainerId);
        
        // Extract all unique PM IDs and client info from mappings
        const pmIdsSet = new Set();
        const clientIdsSet = new Set();
        const clientNamesMap = {};

        mappings.forEach(mapping => {
          // Add PMs from this mapping
          if (mapping.programManagerIds && Array.isArray(mapping.programManagerIds)) {
            mapping.programManagerIds.forEach(pmId => pmIdsSet.add(pmId));
          }
          
          // Add clients from this mapping
          if (mapping.clientIds && Array.isArray(mapping.clientIds)) {
            mapping.clientIds.forEach((clientId, idx) => {
              clientIdsSet.add(clientId);
              if (mapping.clientNames && mapping.clientNames[idx]) {
                clientNamesMap[clientId] = mapping.clientNames[idx];
              }
            });
          }
        });

        assignedPMIds = Array.from(pmIdsSet);
        assignedClientIds = Array.from(clientIdsSet);
        assignedClientNames = assignedClientIds.map(id => clientNamesMap[id] || 'Unknown');
        
        console.log(`✅ Using trainer mapping PMs (fallback): ${assignedPMIds.length} PM(s)`);
      }
    }

    // Create request with routing information
    const requestedAtServerTimestamp = serverTimestamp(); // Will be set by server
    const docRef = await addDoc(collection(db, 'clock_requests'), {
      ...requestData,
      requestedAt: requestedAtServerTimestamp, // Official timestamp
      approvals: [],
      rejections: [],
      adminApproved: false,
      adminApprovedBy: null,
      adminApprovedAt: null,
      // Routing information
      routedToPMIds: assignedPMIds, // PMs who should see this request
      trainerClientIds: assignedClientIds, // Task/client info
      trainerClientNames: assignedClientNames, // For display purposes
      // Versioning for optimistic locking
      version: 0,
      // Expiration tracking
      expiresAt: null, // Will be set when marked as expired
      isExpired: false,
      // Admin review flag
      needsAdminReview: assignedPMIds.length === 0 // Flag for admin if no PMs assigned
    });
    
    // Get the actual requestedAt timestamp from the created document
    const createdDoc = await getDoc(docRef);
    const actualRequestedAt = createdDoc.exists() ? createdDoc.data().requestedAt : Timestamp.now();
    
    // Notify Program Managers and/or Admins via email
    try {
      const trainerName = requestData.trainerName || 'Trainer';
      const requestType = requestData.type || 'clock_in';
      const requestTime = actualRequestedAt 
        ? (actualRequestedAt.toDate ? format(actualRequestedAt.toDate(), 'hh:mm a') : format(new Date(actualRequestedAt), 'hh:mm a'))
        : format(new Date(), 'hh:mm a');
      // Use the actual requestedAt timestamp from the created document
      const requestedAtTimestamp = actualRequestedAt;
      const location = requestData.location?.formattedAddress || requestData.location?.placeName || 'Location not specified';
      const approvalUrl = buildAppUrl('program-manager/requests');
      const adminApprovalUrl = buildAppUrl('admin/clock-requests');
      
      if (assignedPMIds.length === 0) {
        console.log(`⚠️ No PMs assigned - request flagged for admin review`);
        
        // Notify all Admins when no PM is assigned
        try {
          const admins = await getUsersByRole('admin');
          for (const admin of admins) {
            try {
              const adminEmail = admin.email;
              if (adminEmail) {
                const recipientName = admin.displayName || admin.name || adminEmail.split('@')[0];
                await notifyProgramManager(
                  adminEmail,
                  trainerName,
                  requestData.date,
                  requestTime,
                  location,
                  {
                    approvalUrl: adminApprovalUrl,
                    requestType,
                    recipientName,
                    recipientRole: 'Administrator',
                    ctaLabel: 'Review in Admin Dashboard',
                    requestedAt: requestedAtTimestamp
                  }
                );
                console.log(`✅ Email notification sent to Admin: ${adminEmail}`);
              }
            } catch (adminEmailError) {
              console.error(`⚠️ Failed to notify Admin ${admin.id}:`, adminEmailError);
              // Continue with other admins even if one fails
            }
          }
        } catch (adminError) {
          console.error('⚠️ Failed to fetch admins for notification:', adminError);
        }
      } else {
    console.log(`✅ Clock request created and routed to ${assignedPMIds.length} PM(s)`);
        
        // Notify Program Managers
        for (const pmId of assignedPMIds) {
          try {
            const pmDoc = await getDoc(doc(db, 'users', pmId));
            if (pmDoc.exists()) {
              const pmData = pmDoc.data();
              const pmEmail = pmData.email;
              if (pmEmail) {
                const pmName = pmData.displayName || pmData.name || pmEmail.split('@')[0];
                await notifyProgramManager(
                  pmEmail,
                  trainerName,
                  requestData.date,
                  requestTime,
                  location,
                  {
                    approvalUrl,
                    requestType,
                    recipientName: pmName,
                    recipientRole: 'Program Manager',
                    ctaLabel: 'Review Request',
                    requestedAt: requestedAtTimestamp
                  }
                );
                console.log(`✅ Email notification sent to PM: ${pmEmail}`);
              }
            }
          } catch (pmEmailError) {
            console.error(`⚠️ Failed to notify PM ${pmId}:`, pmEmailError);
            // Continue with other PMs even if one fails
          }
        }
        
        // Also notify Admins (in addition to PMs) for visibility
        try {
          const admins = await getUsersByRole('admin');
          for (const admin of admins) {
            try {
              const adminEmail = admin.email;
              if (adminEmail) {
                const recipientName = admin.displayName || admin.name || adminEmail.split('@')[0];
                await notifyProgramManager(
                  adminEmail,
                  trainerName,
                  requestData.date,
                  requestTime,
                  location,
                  {
                    approvalUrl: adminApprovalUrl,
                    requestType,
                    recipientName,
                    recipientRole: 'Administrator',
                    ctaLabel: 'Review in Admin Dashboard',
                    requestedAt: requestedAtTimestamp
                  }
                );
                console.log(`✅ Email notification sent to Admin: ${adminEmail}`);
              }
            } catch (adminEmailError) {
              console.error(`⚠️ Failed to notify Admin ${admin.id}:`, adminEmailError);
              // Continue with other admins even if one fails
            }
          }
        } catch (adminError) {
          console.error('⚠️ Failed to fetch admins for notification:', adminError);
        }
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send email notifications (request was still created):', emailError);
      // Don't fail the entire operation if email fails
    }
    
    return { success: true, requestId: docRef.id };
  } catch (error) {
    console.error('Error creating clock request:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get clock requests for a trainer
 * @param {string} trainerId
 * @returns {Promise<Array>}
 */
export const getClockRequestsByTrainer = async (trainerId) => {
  try {
    // First try with orderBy (requires index)
    try {
      const q = query(
        collection(db, 'clock_requests'),
        where('trainerId', '==', trainerId),
        orderBy('requestedAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        requestId: doc.id,
        ...doc.data()
      }));
    } catch (indexError) {
      // If index error, fetch without orderBy and sort in memory
      if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
        // Silently handle - index will be created automatically by Firebase
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.log('ℹ️ Firestore index not found, using fallback query. Index will be created automatically.');
        }
        const q = query(
          collection(db, 'clock_requests'),
          where('trainerId', '==', trainerId)
        );
        const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => ({
          requestId: doc.id,
          ...doc.data()
        }));
        
        // Sort in memory by requestedAt
        return requests.sort((a, b) => {
          const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : new Date(a.requestedAt || 0).getTime();
          const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : new Date(b.requestedAt || 0).getTime();
          return bTime - aTime; // Descending order
        });
      }
      throw indexError;
    }
  } catch (error) {
    console.error('Error fetching clock requests:', error);
    return [];
  }
};

/**
 * Get pending clock requests
 * @param {string} programManagerId - Optional: filter by PM (only shows requests routed to this PM)
 * @returns {Promise<Array>}
 */
export const getPendingClockRequests = async (programManagerId = null) => {
  try {
    let q;
    
    if (programManagerId) {
      // PM view: only show requests routed to this specific PM
      q = query(
        collection(db, 'clock_requests'),
        where('status', '==', 'pending'),
        where('routedToPMIds', 'array-contains', programManagerId)
      );
    } else {
      // Admin view: show all pending requests
      q = query(
      collection(db, 'clock_requests'),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc')
    );
    }
    
    const snapshot = await getDocs(q);
    const requests = snapshot.docs.map(doc => ({
      requestId: doc.id,
      ...doc.data()
    }));

    // If filtering by PM, sort in memory (can't use orderBy with array-contains)
    if (programManagerId) {
      return requests.sort((a, b) => {
        const aTime = a.requestedAt?.toDate ? a.requestedAt.toDate().getTime() : 0;
        const bTime = b.requestedAt?.toDate ? b.requestedAt.toDate().getTime() : 0;
        return bTime - aTime; // Descending order
      });
    }
    
    return requests;
  } catch (error) {
    console.error('Error fetching pending clock requests:', error);
    return [];
  }
};

const buildClockRequestsQuery = (options = {}, allowOrdering = true) => {
  const { status = null, trainerId = null, programManagerId = null } = options || {};

  const constraints = [];

  if (status) {
    constraints.push(where('status', '==', status));
  }

  if (trainerId) {
    constraints.push(where('trainerId', '==', trainerId));
  }

  if (programManagerId) {
    constraints.push(where('routedToPMIds', 'array-contains', programManagerId));
  }

  let q = collection(db, 'clock_requests');
  if (constraints.length > 0) {
    q = query(q, ...constraints);
  }

  if (allowOrdering && !programManagerId) {
    q = query(q, orderBy('requestedAt', 'desc'));
  }

  return q;
};

export const subscribeToClockRequests = (
  options = {},
  callback,
  errorCallback = null
) => {
  let unsubscribe = null;

  const setupListener = (allowOrdering) => {
    const q = buildClockRequestsQuery(options, allowOrdering);
    unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
          requestId: docSnap.id,
          ...docSnap.data()
        }));
        callback(data);
      },
      (error) => {
        if (
          allowOrdering &&
          (error.code === 'failed-precondition' || error.message?.includes('index'))
        ) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              'Firestore index not ready for clock_requests query. Retrying without ordering.'
            );
          }
          setupListener(false);
          return;
        }

        if (errorCallback) {
          errorCallback(error);
        } else {
          console.error('Clock requests subscription error:', error);
        }
      }
    );
  };

  setupListener(true);

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
};

export const fetchClockRequestsSnapshot = async (options = {}) => {
  try {
    let snapshot;
    try {
      const q = buildClockRequestsQuery(options, true);
      snapshot = await getDocs(q);
    } catch (error) {
      if (
        error.code === 'failed-precondition' ||
        error.message?.includes('index')
      ) {
        const fallbackQuery = buildClockRequestsQuery(options, false);
        snapshot = await getDocs(fallbackQuery);
      } else {
        throw error;
      }
    }

    const data = snapshot.docs.map((docSnap) => ({
      requestId: docSnap.id,
      ...docSnap.data()
    }));

    // Ensure consistent ordering (newest first) if Firestore query couldn't order
    return data.sort((a, b) => {
      const aTime = a.requestedAt?.toDate
        ? a.requestedAt.toDate().getTime()
        : new Date(a.requestedAt || 0).getTime();
      const bTime = b.requestedAt?.toDate
        ? b.requestedAt.toDate().getTime()
        : new Date(b.requestedAt || 0).getTime();
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching clock requests snapshot:', error);
    throw error;
  }
};

export const subscribeToClockRecords = (
  options = {},
  callback,
  errorCallback = null
) => {
  const { trainerId = null } = options || {};

  let q = collection(db, 'clock_records');
  if (trainerId) {
    q = query(q, where('trainerId', '==', trainerId));
  } else {
    q = query(q, orderBy('date', 'desc'));
  }

  const unsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({
        recordId: docSnap.id,
        ...docSnap.data()
      }));
      callback(data);
    },
    (error) => {
      if (errorCallback) {
        errorCallback(error);
      } else {
        console.error('Clock records subscription error:', error);
      }
    }
  );

  return unsubscribe;
};

export const fetchClockRecordsSnapshot = async (options = {}) => {
  try {
    const { trainerId = null } = options || {};

    let q = collection(db, 'clock_records');
    if (trainerId) {
      q = query(q, where('trainerId', '==', trainerId));
    } else {
      q = query(q, orderBy('date', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      recordId: docSnap.id,
      ...docSnap.data()
    }));
  } catch (error) {
    console.error('Error fetching clock records snapshot:', error);
    throw error;
  }
};

/**
 * Approve clock request with transaction support (prevents race conditions)
 * @param {string} requestId
 * @param {string} programManagerId - Optional: PM ID (if approved by PM)
 * @param {string} adminId - Optional: Admin ID (if approved by admin)
 * @param {string} description - Optional: Description/notes for approval
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const approveClockRequest = async (requestId, programManagerId = null, adminId = null, description = null) => {
  try {
    const requestRef = doc(db, 'clock_requests', requestId);
    
    // Fetch approver's name before transaction
    let approverName = 'Unknown';
    let approverRole = 'unknown';
    const approverId = adminId || programManagerId;
    
    if (approverId) {
      try {
        const approverData = await getUserByUid(approverId);
        if (approverData) {
          approverName = approverData.displayName || approverData.name || approverData.email || 'Unknown';
          approverRole = approverData.role || 'unknown';
        }
      } catch (error) {
        console.warn('Could not fetch approver name:', error);
      }
    }
    
    // Use Firestore transaction to prevent race conditions
    const result = await runTransaction(db, async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Request not found');
      }

      const data = requestSnap.data();
      
      // Check if already approved (prevent duplicate approvals)
      if (data.status === 'approved') {
        console.log('Request already approved, skipping duplicate approval');
        return { alreadyApproved: true };
      }
      
      // Check if request is expired (older than 7 days and still pending)
      const requestDate = data.requestedAt?.toDate ? data.requestedAt.toDate() : new Date(data.requestedAt || Date.now());
      const daysSinceRequest = (Date.now() - requestDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceRequest > 7 && data.status === 'pending') {
        console.warn('⚠️ Approving expired request (>7 days old)');
        // Continue with approval but flag it
    }
    
    // Prepare update object for request
    // Note: serverTimestamp() cannot be used inside arrays, use Timestamp.now() instead
    const approvalEntry = {
      ...(programManagerId ? { programManagerId } : {}),
      ...(adminId ? { adminId } : {}),
      approvedBy: approverName, // Store approver's name
      approvedByRole: approverRole, // Store approver's role
      approvedAt: Timestamp.now(), // Use Timestamp.now() for arrays
        action: 'approved',
        ...(description ? { description } : {}) // Add description if provided
    };

    const updateData = {
      status: 'approved',
      approvals: [
        ...(data.approvals || []), // Handle undefined approvals array
        approvalEntry
        ],
        version: (data.version || 0) + 1 // Increment version for optimistic locking
    };

    // If approved by admin, also set admin-specific fields
    if (adminId) {
      updateData.adminApproved = true;
      updateData.adminApprovedBy = adminId;
      updateData.adminApprovedByName = approverName; // Store admin's name
        updateData.adminApprovedAt = Timestamp.now(); // Use Timestamp.now() in transactions
    }

      // Update request status atomically
      transaction.update(requestRef, updateData);
      
      return { 
        alreadyApproved: false, 
        data,
        requestedAt: data.requestedAt,
        trainerId: data.trainerId,
        type: data.type
      };
    });
    
    // If already approved, return success
    if (result.alreadyApproved) {
      return { success: true, message: 'Request already approved' };
    }

    // Create or update clock record for clock-in requests (using data from transaction result)
    if (result.type === 'clock_in') {
      try {
        const data = result.data;
        
        // Extract date from request (priority: date field > requestedAt timestamp)
        let dateStr = data.date;
        if (!dateStr && result.requestedAt) {
          // Convert Firestore Timestamp to date string (YYYY-MM-DD)
          if (result.requestedAt?.toDate) {
            dateStr = result.requestedAt.toDate().toISOString().split('T')[0];
          } else if (result.requestedAt instanceof Timestamp) {
            dateStr = result.requestedAt.toDate().toISOString().split('T')[0];
          } else {
            // Fallback: use current date
            dateStr = new Date().toISOString().split('T')[0];
          }
        }
        if (!dateStr) {
          dateStr = new Date().toISOString().split('T')[0];
        }
        
        // Check if clock record already exists for this date
        const existingRecord = await getClockRecordByDate(result.trainerId, dateStr);
        
        // Use original request timestamp (official time) - preserve as Firestore Timestamp
        const officialTimestamp = result.requestedAt || Timestamp.now();
        
        const clockInData = {
          requestId: requestId,
          timestamp: officialTimestamp, // Use original request timestamp (official time)
          location: data.location || {},
          approvedBy: adminId || programManagerId || 'system',
          approvedAt: Timestamp.now()
        };

        if (existingRecord) {
          // Update existing record with clock-in data (if not already set)
          if (!existingRecord.clockIn) {
            await updateClockRecord(existingRecord.recordId, {
              clockIn: clockInData,
              status: existingRecord.clockOut ? 'completed' : 'active'
              // updatedAt is automatically added by updateClockRecord
            });
            console.log('✅ Updated existing clock record with clock-in data');
          } else {
            console.log('⚠️ Clock record already has clock-in data, skipping update');
          }
        } else {
          // Create new clock record
          const recordData = {
            trainerId: result.trainerId,
            trainerName: data.trainerName || 'Unknown',
            trainerEmail: data.trainerEmail || '',
            date: dateStr,
            clockIn: clockInData,
            clockOut: null,
            status: 'active',
            taskId: data.taskId || null
          };
          
          const createResult = await createClockRecord(recordData);
          if (createResult.success) {
            console.log('✅ Created new clock record for approved clock-in request');
          } else {
            console.error('⚠️ Failed to create clock record:', createResult.error);
            // Don't fail the approval if record creation fails - request is already approved
          }
        }
      } catch (recordError) {
        console.error('⚠️ Error creating/updating clock record (request still approved):', recordError);
        // Don't fail the approval if record creation fails - request is already approved
        // The UI will still work because it reads from clock_requests
      }
    }
    // Note: clock-out requests don't create records here - they're handled directly in TaskDetailsModal
    // when trainer clocks out (automatic, no approval needed)

    // Send approval notification email to trainer
    try {
      const trainerDoc = await getDoc(doc(db, 'users', result.trainerId));
      if (trainerDoc.exists()) {
        const trainerData = trainerDoc.data();
        const trainerEmail = trainerData.email;
        const trainerName = result.data.trainerName || trainerData.displayName || 'Trainer';
        const requestDate = result.data.date || format(new Date(), 'yyyy-MM-dd');
        const location = result.data.location?.formattedAddress || result.data.location?.placeName || null;
        const requestedAt = result.requestedAt || result.data.requestedAt || null;
        
        if (trainerEmail) {
          await notifyTrainerApproved(
            trainerEmail,
            trainerName,
            requestDate,
            approverName,
            description,
            location,
            null,
            'View My History',
            requestedAt
          );
          console.log(`✅ Approval email sent to trainer: ${trainerEmail}`);
        }
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send approval email (request was still approved):', emailError);
      // Don't fail the approval if email fails
    }

    return { success: true };
  } catch (error) {
    console.error('Error approving clock request:', error);
    
    // Check if it's a transaction retry error
    if (error.code === 'aborted' || error.message?.includes('transaction')) {
      return { 
        success: false, 
        error: 'Request is being processed by another user. Please try again.',
        retryable: true 
      };
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Reject clock request with transaction support (prevents race conditions and status regression)
 * @param {string} requestId
 * @param {string} reason
 * @param {string} programManagerId - Optional: PM ID (if rejected by PM)
 * @param {string} adminId - Optional: Admin ID (if rejected by admin)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const rejectClockRequest = async (requestId, reason, programManagerId = null, adminId = null) => {
  try {
    const requestRef = doc(db, 'clock_requests', requestId);
    
    // Fetch rejecter's name before transaction
    let rejecterName = 'Unknown';
    let rejecterRole = 'unknown';
    const rejecterId = adminId || programManagerId;
    
    if (rejecterId) {
      try {
        const rejecterData = await getUserByUid(rejecterId);
        if (rejecterData) {
          rejecterName = rejecterData.displayName || rejecterData.name || rejecterData.email || 'Unknown';
          rejecterRole = rejecterData.role || 'unknown';
        }
      } catch (error) {
        console.warn('Could not fetch rejecter name:', error);
      }
    }
    
    // Use Firestore transaction to prevent race conditions
    await runTransaction(db, async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
    
    if (!requestSnap.exists()) {
        throw new Error('Request not found');
    }

    const data = requestSnap.data();
      
      // Guard against status regression: prevent rejecting already-approved requests
      if (data.status === 'approved') {
        console.warn('⚠️ Cannot reject an already-approved request. Approval takes precedence.');
        throw new Error('This request has already been approved. Approval cannot be overridden by rejection.');
      }
      
      // Check if already rejected
      if (data.status === 'rejected') {
        console.log('Request already rejected');
        return; // Exit gracefully
      }
    
    // Prepare update object
    // Note: serverTimestamp() cannot be used inside arrays, use Timestamp.now() instead
      const rejectionEntry = {
          ...(programManagerId ? { programManagerId } : {}),
          ...(adminId ? { adminId } : {}),
        rejectedBy: rejecterName, // Store rejecter's name
        rejectedByRole: rejecterRole, // Store rejecter's role
          rejectedAt: Timestamp.now(), // Use Timestamp.now() for arrays
          reason,
          action: 'rejected'
      };

    const updateData = {
      status: 'rejected',
      rejectionReason: reason, // Store reason at top level for easy access
      rejections: [
        ...(data.rejections || []), // Handle undefined rejections array
          rejectionEntry
        ],
        version: (data.version || 0) + 1 // Increment version for optimistic locking
    };

    // If rejected by admin, also set admin-specific fields
    if (adminId) {
      updateData.adminRejected = true;
      updateData.adminRejectedBy = adminId;
        updateData.adminRejectedByName = rejecterName; // Store admin's name
        updateData.adminRejectedAt = Timestamp.now(); // Use Timestamp.now() in transactions
    }

      // Update request status atomically
      transaction.update(requestRef, updateData);
    });

    // Send rejection notification email to trainer
    try {
      const requestDoc = await getDoc(requestRef);
      if (requestDoc.exists()) {
        const requestData = requestDoc.data();
        const trainerDoc = await getDoc(doc(db, 'users', requestData.trainerId));
        if (trainerDoc.exists()) {
          const trainerData = trainerDoc.data();
          const trainerEmail = trainerData.email;
          const trainerName = requestData.trainerName || trainerData.displayName || 'Trainer';
          const requestDate = requestData.date || format(new Date(), 'yyyy-MM-dd');
          const location = requestData.location?.formattedAddress || requestData.location?.placeName || null;
          const requestedAt = requestData.requestedAt || null;
          
          if (trainerEmail) {
            await notifyTrainerRejected(
              trainerEmail,
              trainerName,
              requestDate,
              reason, // Dynamic rejection reason provided by PM/Admin
              null,
              location,
              rejecterName, // Include PM/Admin name who rejected
              'Review and Resubmit',
              requestedAt
            );
            console.log(`✅ Rejection email sent to trainer: ${trainerEmail}`);
          }
        }
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send rejection email (request was still rejected):', emailError);
      // Don't fail the rejection if email fails
    }

    return { success: true };
  } catch (error) {
    console.error('Error rejecting clock request:', error);
    
    // Check if it's a transaction retry error
    if (error.code === 'aborted' || error.message?.includes('transaction')) {
      return { 
        success: false, 
        error: 'Request is being processed by another user. Please try again.',
        retryable: true 
      };
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Revoke rejection (change status from rejected back to pending)
 * @param {string} requestId
 * @param {string} adminId - Admin ID who is revoking the rejection
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const revokeRejection = async (requestId, adminId = null) => {
  try {
    const requestRef = doc(db, 'clock_requests', requestId);
    
    // Use transaction to prevent race conditions
    await runTransaction(db, async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
    
    if (!requestSnap.exists()) {
        throw new Error('Request not found');
    }

    const data = requestSnap.data();
    
    if (data.status !== 'rejected') {
        throw new Error('Request is not rejected');
    }
    
    // Prepare update object - change status back to pending
    const updateData = {
      status: 'pending',
      rejectionReason: null, // Clear rejection reason
      // Keep rejections array for audit trail, but change status
      revokedBy: adminId,
        revokedAt: Timestamp.now(),
        version: (data.version || 0) + 1
    };

      transaction.update(requestRef, updateData);
    });

    return { success: true };
  } catch (error) {
    console.error('Error revoking rejection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Override rejection and approve request (Admin only)
 * @param {string} requestId
 * @param {string} adminId - Admin ID who is overriding
 * @param {string} overrideReason - Reason for override
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const overrideRejectionAndApprove = async (requestId, adminId, overrideReason = '') => {
  try {
    const requestRef = doc(db, 'clock_requests', requestId);
    
    // Fetch admin's name before transaction
    let adminName = 'Unknown';
    
    if (adminId) {
      try {
        const adminData = await getUserByUid(adminId);
        if (adminData) {
          adminName = adminData.displayName || adminData.name || adminData.email || 'Unknown';
        }
      } catch (error) {
        console.warn('Could not fetch admin name:', error);
      }
    }
    
    // Use transaction to prevent race conditions
    const result = await runTransaction(db, async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Request not found');
      }

      const data = requestSnap.data();
      
      if (data.status !== 'rejected') {
        throw new Error('Request is not rejected. Only rejected requests can be overridden.');
      }
      
      // Create override entry
      const overrideEntry = {
        adminId,
        overriddenBy: adminName,
        overriddenAt: Timestamp.now(),
        reason: overrideReason,
        action: 'override_and_approve',
        previousStatus: 'rejected'
      };
      
      // Create approval entry
      const approvalEntry = {
        adminId,
        approvedBy: adminName,
        approvedByRole: 'admin',
        approvedAt: Timestamp.now(),
        action: 'approved_after_override',
        overrideReason
      };
      
      // Prepare update object
      const updateData = {
        status: 'approved',
        rejectionReason: null, // Clear rejection reason
        approvals: [
          ...(data.approvals || []),
          approvalEntry
        ],
        overrides: [
          ...(data.overrides || []),
          overrideEntry
        ],
        adminApproved: true,
        adminApprovedBy: adminId,
        adminApprovedByName: adminName,
        adminApprovedAt: Timestamp.now(),
        version: (data.version || 0) + 1
      };

      transaction.update(requestRef, updateData);
      
      return {
        data,
        requestedAt: data.requestedAt,
        trainerId: data.trainerId,
        type: data.type
      };
    });
    
    // Create clock record if it's a clock-in request (same logic as approveClockRequest)
    if (result.type === 'clock_in') {
      try {
        const data = result.data;
        
        let dateStr = data.date;
        if (!dateStr && result.requestedAt) {
          if (result.requestedAt?.toDate) {
            dateStr = result.requestedAt.toDate().toISOString().split('T')[0];
          } else if (result.requestedAt instanceof Timestamp) {
            dateStr = result.requestedAt.toDate().toISOString().split('T')[0];
          } else {
            dateStr = new Date().toISOString().split('T')[0];
          }
        }
        if (!dateStr) {
          dateStr = new Date().toISOString().split('T')[0];
        }
        
        const existingRecord = await getClockRecordByDate(result.trainerId, dateStr);
        const officialTimestamp = result.requestedAt || Timestamp.now();
        
        const clockInData = {
          requestId: requestId,
          timestamp: officialTimestamp,
          location: data.location || {},
          approvedBy: adminId,
          approvedAt: Timestamp.now(),
          overridden: true,
          overrideReason
        };

        if (existingRecord) {
          if (!existingRecord.clockIn) {
            await updateClockRecord(existingRecord.recordId, {
              clockIn: clockInData,
              status: existingRecord.clockOut ? 'completed' : 'active'
            });
            console.log('✅ Updated clock record after override');
          }
        } else {
          const recordData = {
            trainerId: result.trainerId,
            trainerName: data.trainerName || 'Unknown',
            trainerEmail: data.trainerEmail || '',
            date: dateStr,
            clockIn: clockInData,
            clockOut: null,
            status: 'active',
            taskId: data.taskId || null
          };
          
          await createClockRecord(recordData);
          console.log('✅ Created clock record after override');
        }
      } catch (recordError) {
        console.error('⚠️ Error creating clock record after override:', recordError);
      }
    }

    // Send approval notification email to trainer (after override)
    try {
      const requestDoc = await getDoc(requestRef);
      if (requestDoc.exists()) {
        const requestData = requestDoc.data();
        const trainerDoc = await getDoc(doc(db, 'users', requestData.trainerId));
        if (trainerDoc.exists()) {
          const trainerData = trainerDoc.data();
          const trainerEmail = trainerData.email;
          const trainerName = requestData.trainerName || trainerData.displayName || 'Trainer';
          const requestDate = requestData.date || format(new Date(), 'yyyy-MM-dd');
          const location = requestData.location?.formattedAddress || requestData.location?.placeName || null;
          const description = overrideReason ? `Admin Override: ${overrideReason}` : 'Admin Override';
          const requestedAt = requestData.requestedAt || null;
          
          if (trainerEmail) {
            await notifyTrainerApproved(
              trainerEmail,
              trainerName,
              requestDate,
              adminName,
              description,
              location,
              null,
              'View My History',
              requestedAt
            );
            console.log(`✅ Override approval email sent to trainer: ${trainerEmail}`);
          }
        }
      }
    } catch (emailError) {
      console.error('⚠️ Failed to send override approval email (request was still approved):', emailError);
      // Don't fail the override if email fails
    }

    return { success: true };
  } catch (error) {
    console.error('Error overriding rejection:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check and mark expired requests (pending for >7 days)
 * @returns {Promise<{success: boolean, expiredCount: number}>}
 */
export const markExpiredRequests = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const q = query(
      collection(db, 'clock_requests'),
      where('status', '==', 'pending'),
      where('isExpired', '==', false)
    );

    const snapshot = await getDocs(q);
    const adminUsers = await getUsersByRole('admin');
    const adminRecipients = adminUsers
      .filter(user => !!user.email)
      .map(user => ({
        email: user.email,
        name: user.displayName || user.name || user.email.split('@')[0]
      }));

    let expiredCount = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const requestTimestamp = data.requestedAt?.toDate
        ? data.requestedAt.toDate()
        : data.requestedAt
          ? new Date(data.requestedAt)
          : new Date();

      if (requestTimestamp < sevenDaysAgo) {
        const docRef = doc(db, 'clock_requests', docSnap.id);

        try {
          await updateDoc(docRef, {
            isExpired: true,
            expiresAt: Timestamp.now(),
            status: 'expired'
          });
          expiredCount++;

          const trainerId = data.trainerId;
          let trainerEmail = null;
          let trainerName = data.trainerName || 'Trainer';

          if (trainerId) {
            try {
              const trainerDoc = await getDoc(doc(db, 'users', trainerId));
              if (trainerDoc.exists()) {
                trainerEmail = trainerDoc.data().email;
                trainerName = trainerDoc.data().displayName || trainerDoc.data().name || trainerName;
              }
            } catch (trainerError) {
              console.error('⚠️ Unable to load trainer information for expired request:', trainerError);
            }
          }

          const requestDate = data.date || format(requestTimestamp, 'yyyy-MM-dd');
          const requestTime = format(requestTimestamp, 'hh:mm a');
          const requestTypeLabel = data.type === 'clock_out' ? 'Clock-Out' : 'Clock-In';

          if (trainerEmail) {
            await notifyRequestExpiredTrainer(
              trainerEmail,
              trainerName,
              requestDate,
              requestTime,
              null
            );
          }

          const notifiedEmails = new Set();
          const pmIds = Array.isArray(data.routedToPMIds) ? data.routedToPMIds : [];

          for (const pmId of pmIds) {
            try {
              const pmDoc = await getDoc(doc(db, 'users', pmId));
              if (pmDoc.exists()) {
                const pmEmail = pmDoc.data().email;
                const pmName = pmDoc.data().displayName || pmDoc.data().name || pmEmail?.split('@')[0];
                if (pmEmail && !notifiedEmails.has(pmEmail)) {
                  await notifyRequestExpiredStakeholder(
                    pmEmail,
                    pmName,
                    trainerName,
                    requestDate,
                    requestTime,
                    requestTypeLabel,
                    buildAppUrl('program-manager/requests')
                  );
                  notifiedEmails.add(pmEmail);
                }
              }
            } catch (pmError) {
              console.error('⚠️ Unable to notify PM about expired request:', pmError);
            }
          }

          for (const admin of adminRecipients) {
            if (!notifiedEmails.has(admin.email)) {
              await notifyRequestExpiredStakeholder(
                admin.email,
                admin.name,
                trainerName,
                requestDate,
                requestTime,
                requestTypeLabel,
                buildAppUrl('admin/clock-requests')
              );
              notifiedEmails.add(admin.email);
            }
          }
        } catch (updateError) {
          console.error('Error expiring request:', updateError);
        }
      }
    }

    if (expiredCount > 0) {
      console.log(`✅ Marked ${expiredCount} requests as expired`);
    }

    return { success: true, expiredCount };
  } catch (error) {
    console.error('Error marking expired requests:', error);
    return { success: false, expiredCount: 0 };
  }
};

/**
 * Get expired requests (for admin notification)
 * @returns {Promise<Array>}
 */
export const getExpiredRequests = async () => {
  try {
    const q = query(
      collection(db, 'clock_requests'),
      where('status', '==', 'expired'),
      orderBy('expiresAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      requestId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching expired requests:', error);
    return [];
  }
};

/**
 * Handle trainer deletion - mark their requests as invalid
 * @param {string} trainerId
 * @returns {Promise<{success: boolean, affectedCount: number}>}
 */
export const handleTrainerDeletion = async (trainerId) => {
  try {
    const q = query(
      collection(db, 'clock_requests'),
      where('trainerId', '==', trainerId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    let affectedCount = 0;

    if (snapshot.empty) {
      return { success: true, affectedCount: 0 };
    }

    const adminUsers = await getUsersByRole('admin');
    const adminRecipients = adminUsers
      .filter(user => !!user.email)
      .map(user => ({
        email: user.email,
        name: user.displayName || user.name || user.email.split('@')[0]
      }));

    for (const docSnap of snapshot.docs) {
      const docRef = doc(db, 'clock_requests', docSnap.id);
      const data = docSnap.data();
      const trainerName = data.trainerName || 'Trainer';
      const requestDate = data.date || 'Unknown date';
      const reason = 'Trainer account deleted';

      try {
        await updateDoc(docRef, {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: Timestamp.now()
        });
        affectedCount++;

        const notifiedEmails = new Set();
        const pmIds = Array.isArray(data.routedToPMIds) ? data.routedToPMIds : [];

        for (const pmId of pmIds) {
          try {
            const pmDoc = await getDoc(doc(db, 'users', pmId));
            if (pmDoc.exists()) {
              const pmEmail = pmDoc.data().email;
              const pmName = pmDoc.data().displayName || pmDoc.data().name || pmEmail?.split('@')[0];
              if (pmEmail && !notifiedEmails.has(pmEmail)) {
                await notifyRequestCancelled(
                  pmEmail,
                  pmName,
                  trainerName,
                  requestDate,
                  reason,
                  buildAppUrl('program-manager/requests'),
                  'View Requests'
                );
                notifiedEmails.add(pmEmail);
              }
            }
          } catch (pmError) {
            console.error('⚠️ Unable to notify PM of cancellation:', pmError);
          }
        }

        for (const admin of adminRecipients) {
          if (!notifiedEmails.has(admin.email)) {
            await notifyRequestCancelled(
              admin.email,
              admin.name,
              trainerName,
              requestDate,
              reason,
              buildAppUrl('admin/clock-requests'),
              'Review Clock Requests'
            );
            notifiedEmails.add(admin.email);
          }
        }
      } catch (updateError) {
        console.error('Error cancelling request after trainer deletion:', updateError);
      }
    }

    console.log(`✅ Cancelled ${affectedCount} requests due to trainer deletion`);
    return { success: true, affectedCount };
  } catch (error) {
    console.error('Error handling trainer deletion:', error);
    return { success: false, affectedCount: 0 };
  }
};

/**
 * Re-route requests when PM is removed from trainer
 * @param {string} trainerId
 * @param {string} removedPMId
 * @param {Array<string>} newPMIds - New PM IDs to route to (if any)
 * @returns {Promise<{success: boolean, reroutedCount: number}>}
 */
export const rerouteRequestsAfterPMRemoval = async (trainerId, removedPMId, newPMIds = []) => {
  try {
    // Find all pending requests for this trainer that were routed to the removed PM
    const q = query(
      collection(db, 'clock_requests'),
      where('trainerId', '==', trainerId),
      where('status', '==', 'pending'),
      where('routedToPMIds', 'array-contains', removedPMId)
    );
    
    const snapshot = await getDocs(q);
    let reroutedCount = 0;

    if (snapshot.empty) {
      return { success: true, reroutedCount: 0 };
    }

    const adminUsers = await getUsersByRole('admin');
    const adminRecipients = adminUsers
      .filter(user => !!user.email)
      .map(user => ({
        email: user.email,
        name: user.displayName || user.name || user.email.split('@')[0]
      }));

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const currentPMIds = Array.isArray(data.routedToPMIds) ? data.routedToPMIds : [];
      const originalPMIds = [...currentPMIds];
      let updatedPMIds = currentPMIds.filter(id => id !== removedPMId);

      if (newPMIds.length > 0) {
        updatedPMIds = [...new Set([...updatedPMIds, ...newPMIds])];
      }

      const docRef = doc(db, 'clock_requests', docSnap.id);

      try {
        await updateDoc(docRef, {
          routedToPMIds: updatedPMIds,
          reroutedAt: Timestamp.now(),
          reroutingReason: 'PM removed from trainer assignment',
          needsAdminReview: updatedPMIds.length === 0
        });
        reroutedCount++;

        const trainerName = data.trainerName || 'Trainer';
        const requestDate = data.date || 'Unknown date';
        const requestTypeLabel = data.type === 'clock_out' ? 'Clock-Out' : 'Clock-In';
        const newlyAddedPMIds = updatedPMIds.filter(id => !originalPMIds.includes(id));

        for (const pmId of newlyAddedPMIds) {
          try {
            const pmDoc = await getDoc(doc(db, 'users', pmId));
            if (pmDoc.exists()) {
              const pmEmail = pmDoc.data().email;
              const pmName = pmDoc.data().displayName || pmDoc.data().name || pmEmail?.split('@')[0];
              if (pmEmail) {
                await notifyRequestRerouted(
                  pmEmail,
                  pmName,
                  trainerName,
                  requestDate,
                  requestTypeLabel,
                  buildAppUrl('program-manager/requests')
                );
              }
            }
          } catch (pmError) {
            console.error('⚠️ Unable to notify newly assigned PM:', pmError);
          }
        }

        if (updatedPMIds.length === 0) {
          for (const admin of adminRecipients) {
            try {
              await notifyRequestCancelled(
                admin.email,
                admin.name,
                trainerName,
                requestDate,
                'No program managers assigned. Admin review required.',
                buildAppUrl('admin/clock-requests'),
                'Assign Program Manager'
              );
            } catch (adminError) {
              console.error('⚠️ Unable to notify admin about rerouted request:', adminError);
            }
          }
        }
      } catch (updateError) {
        console.error('Error updating request routing:', updateError);
      }
    }

    console.log(`✅ Re-routed ${reroutedCount} requests after PM removal`);
    return { success: true, reroutedCount };
  } catch (error) {
    console.error('Error re-routing requests:', error);
    return { success: false, reroutedCount: 0 };
  }
};

/**
 * Check if clock-in and clock-out locations differ significantly
 * @param {Object} clockInLocation
 * @param {Object} clockOutLocation
 * @param {number} threshold - Distance threshold in meters (default: 100m)
 * @returns {boolean}
 */
export const checkLocationMismatch = (clockInLocation, clockOutLocation, threshold = 100) => {
  if (!clockInLocation?.coordinates || !clockOutLocation?.coordinates) {
    return false; // Can't compare if coordinates missing
  }
  
  const { latitude: lat1, longitude: lon1 } = clockInLocation.coordinates;
  const { latitude: lat2, longitude: lon2 } = clockOutLocation.coordinates;
  
  // Haversine formula to calculate distance
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance > threshold;
};

/**
 * Flag clock record if locations differ
 * @param {string} recordId
 * @param {Object} clockInLocation
 * @param {Object} clockOutLocation
 * @returns {Promise<{success: boolean}>}
 */
export const flagLocationMismatch = async (recordId, clockInLocation, clockOutLocation) => {
  try {
    const hasMismatch = checkLocationMismatch(clockInLocation, clockOutLocation);
    
    if (hasMismatch) {
      const recordRef = doc(db, 'clock_records', recordId);
      await updateDoc(recordRef, {
        locationMismatch: true,
        locationMismatchFlaggedAt: Timestamp.now(),
        needsReview: true
      });
      
      console.log('⚠️ Location mismatch flagged for review');
      return { success: true, flagged: true };
    }
    
    return { success: true, flagged: false };
  } catch (error) {
    console.error('Error flagging location mismatch:', error);
    return { success: false, flagged: false };
  }
};

/**
 * Cancel pending requests associated with a removed task
 * @param {string} taskId
 * @param {Object} options
 * @param {string} options.reason - Reason for cancellation
 * @param {string} options.trainerName - Trainer name fallback
 * @param {string} options.taskLabel - Task description
 * @returns {Promise<{success: boolean, cancelledCount: number}>}
 */
export const cancelPendingRequestsForTask = async (taskId, options = {}) => {
  if (!taskId) {
    return { success: true, cancelledCount: 0 };
  }

  try {
    const q = query(
      collection(db, 'clock_requests'),
      where('taskId', '==', taskId),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { success: true, cancelledCount: 0 };
    }

    const adminUsers = await getUsersByRole('admin');
    const adminRecipients = adminUsers
      .filter(user => !!user.email)
      .map(user => ({
        email: user.email,
        name: user.displayName || user.name || user.email.split('@')[0]
      }));

    let cancelledCount = 0;
    const reason = options.reason || 'Associated task was removed from the schedule';

    for (const docSnap of snapshot.docs) {
      const docRef = doc(db, 'clock_requests', docSnap.id);
      const data = docSnap.data();
      const trainerName = data.trainerName || options.trainerName || 'Trainer';
      const requestDate = data.date || 'Unknown date';

      try {
        await updateDoc(docRef, {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: Timestamp.now(),
          needsAdminReview: false
        });
        cancelledCount++;

        const notifiedEmails = new Set();

        // Notify trainer
        if (data.trainerId) {
          try {
            const trainerDoc = await getDoc(doc(db, 'users', data.trainerId));
            if (trainerDoc.exists()) {
              const trainerEmail = trainerDoc.data().email;
              const trainerDisplayName = trainerDoc.data().displayName || trainerDoc.data().name || trainerEmail?.split('@')[0];
              if (trainerEmail) {
                await notifyRequestCancelled(
                  trainerEmail,
                  trainerDisplayName,
                  trainerName,
                  requestDate,
                  reason,
                  buildAppUrl('trainer/history'),
                  'View History'
                );
                notifiedEmails.add(trainerEmail);
              }
            }
          } catch (trainerError) {
            console.error('⚠️ Unable to notify trainer about task cancellation:', trainerError);
          }
        }

        // Notify routed PMs
        const pmIds = Array.isArray(data.routedToPMIds) ? data.routedToPMIds : [];
        for (const pmId of pmIds) {
          try {
            const pmDoc = await getDoc(doc(db, 'users', pmId));
            if (pmDoc.exists()) {
              const pmEmail = pmDoc.data().email;
              const pmName = pmDoc.data().displayName || pmDoc.data().name || pmEmail?.split('@')[0];
              if (pmEmail && !notifiedEmails.has(pmEmail)) {
                await notifyRequestCancelled(
                  pmEmail,
                  pmName,
                  trainerName,
                  requestDate,
                  reason,
                  buildAppUrl('program-manager/requests'),
                  'Review Requests'
                );
                notifiedEmails.add(pmEmail);
              }
            }
          } catch (pmError) {
            console.error('⚠️ Unable to notify PM about task cancellation:', pmError);
          }
        }

        // Notify admins
        for (const admin of adminRecipients) {
          if (!notifiedEmails.has(admin.email)) {
            try {
              await notifyRequestCancelled(
                admin.email,
                admin.name,
                trainerName,
                requestDate,
                reason,
                buildAppUrl('admin/clock-requests'),
                'Review Clock Requests'
              );
            } catch (adminError) {
              console.error('⚠️ Unable to notify admin about task cancellation:', adminError);
            }
          }
        }
      } catch (updateError) {
        console.error('Error cancelling request for removed task:', updateError);
      }
    }

    console.log(`✅ Cancelled ${cancelledCount} pending request(s) because the associated task was removed`);
    return { success: true, cancelledCount };
  } catch (error) {
    console.error('Error cancelling requests for removed task:', error);
    return { success: false, cancelledCount: 0 };
  }
};

// Additional functions will be implemented in Phase 2 & 3

