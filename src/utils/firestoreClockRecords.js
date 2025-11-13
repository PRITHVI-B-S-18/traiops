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
 * Create a clock record (after approval)
 * @param {Object} recordData - Record data
 * @returns {Promise<{success: boolean, recordId?: string, error?: string}>}
 */
export const createClockRecord = async (recordData) => {
  try {
    const docRef = await addDoc(collection(db, 'clock_records'), {
      ...recordData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true, recordId: docRef.id };
  } catch (error) {
    console.error('Error creating clock record:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get clock records for a trainer
 * @param {string} trainerId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export const getClockRecordsByTrainer = async (trainerId, startDate = null, endDate = null) => {
  try {
    let q = query(
      collection(db, 'clock_records'),
      where('trainerId', '==', trainerId)
    );

    const snapshot = await getDocs(q);
    let records = snapshot.docs.map(doc => ({
      recordId: doc.id,
      ...doc.data()
    }));

    // Filter by date range if provided
    if (startDate && endDate) {
      records = records.filter(record => 
        record.date >= startDate && record.date <= endDate
      );
    }

    return records;
  } catch (error) {
    console.error('Error fetching clock records:', error);
    return [];
  }
};

/**
 * Get clock record for a specific date
 * @param {string} trainerId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Object|null>}
 */
export const getClockRecordByDate = async (trainerId, date) => {
  try {
    const q = query(
      collection(db, 'clock_records'),
      where('trainerId', '==', trainerId),
      where('date', '==', date)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return {
        recordId: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching clock record:', error);
    return null;
  }
};

/**
 * Update clock record (for clock-out)
 * @param {string} recordId
 * @param {Object} updates
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateClockRecord = async (recordId, updates) => {
  try {
    await updateDoc(doc(db, 'clock_records', recordId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating clock record:', error);
    return { success: false, error: error.message };
  }
};

// Additional functions will be implemented in Phase 2 & 3

