import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';

// Save schedule data to Firestore
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (error) {
    console.warn('Error comparing schedule entries:', error);
    return false;
  }
};

export const saveScheduleData = async (data) => {
    const scheduleRef = doc(db, 'schedules', 'main');
  try {
    const existingSnap = await getDoc(scheduleRef);
    const docExists = existingSnap.exists();
    const beforeData = docExists ? existingSnap.data()?.data || {} : {};

    if (!docExists) {
    await setDoc(scheduleRef, { data });
      return;
    }

    const updates = {};
    const nextData = data || {};

    Object.entries(nextData).forEach(([dateKey, entries]) => {
      const beforeEntries = beforeData?.[dateKey];
      if (!beforeEntries || !deepEqual(beforeEntries, entries)) {
        updates[`data.${dateKey}`] = entries;
      }
    });

    Object.keys(beforeData || {}).forEach((dateKey) => {
      if (!Object.prototype.hasOwnProperty.call(nextData, dateKey)) {
        updates[`data.${dateKey}`] = deleteField();
      }
    });

    if (Object.keys(updates).length === 0) {
      return;
    }

    await updateDoc(scheduleRef, updates);
  } catch (error) {
    console.error('Error saving schedule data:', error);
    if (error?.code === 'not-found') {
      await setDoc(scheduleRef, { data });
      return;
    }
    throw error;
  }
};

// Load schedule data from Firestore
export const loadScheduleData = async () => {
  try {
    const scheduleRef = doc(db, 'schedules', 'main');
    const docSnap = await getDoc(scheduleRef);
    return docSnap.exists() ? docSnap.data().data : {};
  } catch (error) {
    console.error('Error loading schedule data:', error);
    throw error;
  }
};

// New function for real-time updates
export const subscribeToScheduleUpdates = (callback) => {
  const scheduleRef = doc(db, 'schedules', 'main');
  
  // Set up the listener with error handling and immediate execution
  const unsubscribe = onSnapshot(
    scheduleRef,
    (docSnapshot) => {
      try {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          callback(data?.data || {});
        } else {
          callback({});
        }
      } catch (error) {
        console.error('Error processing schedule data:', error);
        callback({});
      }
    },
    (error) => {
      // Only log errors that are not permission-related (which are expected in some cases)
      if (error.code !== 'permission-denied') {
        console.error('Error in schedule subscription:', error);
      }
      // Still call callback with empty object so UI doesn't hang
      callback({});
    }
  );
  
  return unsubscribe;
}; 