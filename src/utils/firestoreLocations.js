import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Create a new location
 * @param {Object} locationData - Location data
 * @returns {Promise<{success: boolean, locationId?: string, error?: string}>}
 */
export const createLocation = async (locationData) => {
  try {
    const docRef = await addDoc(collection(db, 'locations'), {
      ...locationData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true, locationId: docRef.id };
  } catch (error) {
    console.error('Error creating location:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all locations
 * @returns {Promise<Array>}
 */
export const getAllLocations = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'locations'));
    return snapshot.docs.map(doc => ({
      locationId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
};

/**
 * Get a single location by ID
 * @param {string} locationId
 * @returns {Promise<Object|null>}
 */
export const getLocation = async (locationId) => {
  try {
    const docSnap = await getDoc(doc(db, 'locations', locationId));
    if (docSnap.exists()) {
      return { locationId: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching location:', error);
    return null;
  }
};

/**
 * Update location
 * @param {string} locationId
 * @param {Object} updates
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateLocation = async (locationId, updates) => {
  try {
    await updateDoc(doc(db, 'locations', locationId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating location:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete location
 * @param {string} locationId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteLocation = async (locationId) => {
  try {
    await deleteDoc(doc(db, 'locations', locationId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting location:', error);
    return { success: false, error: error.message };
  }
};

// Additional functions will be implemented in later phases

