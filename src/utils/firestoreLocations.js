import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';

const LOCATIONS_COLLECTION = 'locations';

/**
 * Create a new location
 * @param {Object} locationData - Location data
 * @returns {Promise<string>} - Document ID
 */
export const createLocation = async (locationData) => {
  try {
    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, LOCATIONS_COLLECTION), {
      ...locationData,
      createdAt: now,
      updatedAt: now,
      status: locationData.status || 'active',
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
};

/**
 * Get all locations
 * @returns {Promise<Array>} - Array of locations
 */
export const getAllLocations = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, LOCATIONS_COLLECTION));
    const locations = [];
    querySnapshot.forEach((doc) => {
      locations.push({
        locationId: doc.id,
        ...doc.data(),
      });
    });
    return locations;
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
};

/**
 * Get active locations only
 * @returns {Promise<Array>} - Array of active locations
 */
export const getActiveLocations = async () => {
  try {
    const q = query(
      collection(db, LOCATIONS_COLLECTION),
      where('status', '==', 'active'),
      orderBy('name')
    );
    const querySnapshot = await getDocs(q);
    const locations = [];
    querySnapshot.forEach((doc) => {
      locations.push({
        locationId: doc.id,
        ...doc.data(),
      });
    });
    return locations;
  } catch (error) {
    console.error('Error fetching active locations:', error);
    throw error;
  }
};

/**
 * Get location by ID
 * @param {string} locationId - Location ID
 * @returns {Promise<Object|null>} - Location data or null
 */
export const getLocationById = async (locationId) => {
  try {
    const docRef = doc(db, LOCATIONS_COLLECTION, locationId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        locationId: docSnap.id,
        ...docSnap.data(),
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching location:', error);
    throw error;
  }
};

/**
 * Update location
 * @param {string} locationId - Location ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateLocation = async (locationId, updateData) => {
  try {
    const docRef = doc(db, LOCATIONS_COLLECTION, locationId);
    await updateDoc(docRef, {
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating location:', error);
    throw error;
  }
};

/**
 * Delete location
 * @param {string} locationId - Location ID
 * @returns {Promise<void>}
 */
export const deleteLocation = async (locationId) => {
  try {
    const docRef = doc(db, LOCATIONS_COLLECTION, locationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
};

/**
 * Get locations assigned to a specific Program Manager
 * @param {string} programManagerId - Program Manager UID
 * @returns {Promise<Array>} - Array of locations
 */
export const getLocationsByProgramManager = async (programManagerId) => {
  try {
    const q = query(
      collection(db, LOCATIONS_COLLECTION),
      where('programManagerIds', 'array-contains', programManagerId)
    );
    const querySnapshot = await getDocs(q);
    const locations = [];
    querySnapshot.forEach((doc) => {
      locations.push({
        locationId: doc.id,
        ...doc.data(),
      });
    });
    return locations;
  } catch (error) {
    console.error('Error fetching locations by Program Manager:', error);
    throw error;
  }
};

/**
 * Validate if coordinates are within location radius
 * @param {number} lat1 - User latitude
 * @param {number} lng1 - User longitude
 * @param {number} lat2 - Location latitude
 * @param {number} lng2 - Location longitude
 * @param {number} radius - Radius in meters
 * @returns {boolean} - True if within radius
 */
export const isWithinRadius = (lat1, lng1, lat2, lng2, radius) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distance in meters

  return distance <= radius;
};

/**
 * Calculate distance between two coordinates in meters
 * @param {number} lat1 - First point latitude
 * @param {number} lng1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lng2 - Second point longitude
 * @returns {number} - Distance in meters
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

