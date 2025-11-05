import { db } from '../firebase';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// Save schedule data to Firestore
export const saveScheduleData = async (data) => {
  try {
    const scheduleRef = doc(db, 'schedules', 'main');
    await setDoc(scheduleRef, { data });
  } catch (error) {
    console.error('Error saving schedule data:', error);
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
  return onSnapshot(scheduleRef, (doc) => {
    if (doc.exists()) {
      callback(doc.data().data);
    } else {
      callback({});
    }
  }, (error) => {
    console.error('Error in schedule subscription:', error);
  });
}; 