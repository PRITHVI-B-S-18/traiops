import { db } from '../firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc, deleteField, collection, getDocs, query, where } from 'firebase/firestore';

// Helper function to get month key from date string (YYYY-MM-DD -> YYYY-MM)
const getMonthKey = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  // Date string is in format YYYY-MM-DD
  return dateStr.substring(0, 7); // Returns YYYY-MM
};

// Helper function to get all month keys from a date range
const getMonthKeysFromData = (data) => {
  const monthKeys = new Set();
  Object.keys(data || {}).forEach(dateKey => {
    const monthKey = getMonthKey(dateKey);
    if (monthKey) {
      monthKeys.add(monthKey);
    }
  });
  return Array.from(monthKeys);
};

// Helper function to group dates by month
const groupDatesByMonth = (data) => {
  const grouped = {};
  Object.entries(data || {}).forEach(([dateKey, entries]) => {
    const monthKey = getMonthKey(dateKey);
    if (monthKey) {
      if (!grouped[monthKey]) {
        grouped[monthKey] = {};
      }
      grouped[monthKey][dateKey] = entries;
    }
  });
  return grouped;
};

// Deep equality check
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

// Save schedule data to Firestore - split by month to avoid 1MB limit
export const saveScheduleData = async (data) => {
  try {
    // Group data by month
    const groupedByMonth = groupDatesByMonth(data);
    
    // Save each month to its own document
    const savePromises = Object.entries(groupedByMonth).map(async ([monthKey, monthData]) => {
      const scheduleRef = doc(db, 'schedules', monthKey);
      
  try {
    const existingSnap = await getDoc(scheduleRef);
    const docExists = existingSnap.exists();
    const beforeData = docExists ? existingSnap.data()?.data || {} : {};

    if (!docExists) {
          await setDoc(scheduleRef, { data: monthData });
      return;
    }

    const updates = {};
        const nextData = monthData || {};

        // Check for changes
    Object.entries(nextData).forEach(([dateKey, entries]) => {
      const beforeEntries = beforeData?.[dateKey];
      if (!beforeEntries || !deepEqual(beforeEntries, entries)) {
        updates[`data.${dateKey}`] = entries;
      }
    });

        // Check for deletions
    Object.keys(beforeData || {}).forEach((dateKey) => {
      if (!Object.prototype.hasOwnProperty.call(nextData, dateKey)) {
        updates[`data.${dateKey}`] = deleteField();
      }
    });

    if (Object.keys(updates).length === 0) {
          return; // No changes
    }

    await updateDoc(scheduleRef, updates);
      } catch (error) {
        console.error(`Error saving schedule data for month ${monthKey}:`, error);
        if (error?.code === 'not-found') {
          await setDoc(scheduleRef, { data: monthData });
          return;
        }
        throw error;
      }
    });

    await Promise.all(savePromises);
  } catch (error) {
    console.error('Error saving schedule data:', error);
    throw error;
  }
};

// Load schedule data from Firestore - load from all month documents
export const loadScheduleData = async () => {
  try {
    // Try to load from new month-based structure first
    const schedulesCollection = collection(db, 'schedules');
    const querySnapshot = await getDocs(schedulesCollection);
    
    const allData = {};
    
    querySnapshot.forEach((docSnapshot) => {
      const docId = docSnapshot.id;
      const docData = docSnapshot.data();
      
      // Skip the old 'main' document if it exists (for migration)
      if (docId === 'main') {
        console.warn('Found legacy "main" schedule document. Consider migrating to month-based structure.');
        // Optionally merge old data for backward compatibility
        if (docData?.data) {
          Object.assign(allData, docData.data);
        }
        return;
      }
      
      // Only process month-based documents (format: YYYY-MM)
      if (/^\d{4}-\d{2}$/.test(docId) && docData?.data) {
        Object.assign(allData, docData.data);
      }
    });
    
    return allData;
  } catch (error) {
    console.error('Error loading schedule data:', error);
    throw error;
  }
};

// Real-time updates - subscribe to all month documents
export const subscribeToScheduleUpdates = (callback) => {
  const schedulesCollection = collection(db, 'schedules');
  const unsubscribes = [];
  let isInitialized = false;
  const mergedData = {};
  let activeListeners = 0;
  
  // Track which month documents we're listening to
  const monthListeners = new Map();
  
  // Function to merge all data and call callback
  const mergeAndCallback = () => {
    const combined = {};
    monthListeners.forEach((data, monthKey) => {
      Object.assign(combined, data);
    });
    callback(combined);
  };
  
  // Initial load to get all existing month documents
  getDocs(schedulesCollection).then((querySnapshot) => {
    querySnapshot.forEach((docSnapshot) => {
      const docId = docSnapshot.id;
      const docData = docSnapshot.data();
      
      // Skip legacy 'main' document
      if (docId === 'main') {
        if (docData?.data) {
          Object.assign(mergedData, docData.data);
        }
        return;
      }
      
      // Only process month-based documents
      if (/^\d{4}-\d{2}$/.test(docId) && docData?.data) {
        monthListeners.set(docId, docData.data || {});
        Object.assign(mergedData, docData.data || {});
        
        // Set up listener for this month document
        const monthRef = doc(db, 'schedules', docId);
  const unsubscribe = onSnapshot(
          monthRef,
    (docSnapshot) => {
      try {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
                monthListeners.set(docId, data?.data || {});
        } else {
                monthListeners.delete(docId);
        }
              mergeAndCallback();
      } catch (error) {
              console.error(`Error processing schedule data for ${docId}:`, error);
      }
    },
    (error) => {
      if (error.code !== 'permission-denied') {
              console.error(`Error in schedule subscription for ${docId}:`, error);
      }
          }
        );
        unsubscribes.push(unsubscribe);
      }
    });
    
    // Also set up a listener on the collection to catch new month documents
    const collectionUnsubscribe = onSnapshot(
      schedulesCollection,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const docId = change.doc.id;
          
          // Skip legacy 'main' document
          if (docId === 'main') return;
          
          // Only process month-based documents
          if (/^\d{4}-\d{2}$/.test(docId)) {
            if (change.type === 'added' && !monthListeners.has(docId)) {
              // New month document added
              const docData = change.doc.data();
              monthListeners.set(docId, docData?.data || {});
              
              // Set up listener for this new month
              const monthRef = doc(db, 'schedules', docId);
              const unsubscribe = onSnapshot(
                monthRef,
                (docSnapshot) => {
                  try {
                    if (docSnapshot.exists()) {
                      const data = docSnapshot.data();
                      monthListeners.set(docId, data?.data || {});
                    } else {
                      monthListeners.delete(docId);
                    }
                    mergeAndCallback();
                  } catch (error) {
                    console.error(`Error processing schedule data for ${docId}:`, error);
                  }
                },
                (error) => {
                  if (error.code !== 'permission-denied') {
                    console.error(`Error in schedule subscription for ${docId}:`, error);
                  }
                }
              );
              unsubscribes.push(unsubscribe);
              mergeAndCallback();
            } else if (change.type === 'removed') {
              // Month document removed
              monthListeners.delete(docId);
              mergeAndCallback();
            }
          }
        });
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('Error in schedule collection subscription:', error);
        }
      }
    );
    unsubscribes.push(collectionUnsubscribe);
    
    // Initial callback with merged data
    if (!isInitialized) {
      callback(mergedData);
      isInitialized = true;
    }
  }).catch((error) => {
    console.error('Error initializing schedule subscription:', error);
    callback({});
  });
  
  // Return unsubscribe function
  return () => {
    unsubscribes.forEach(unsub => unsub());
    monthListeners.clear();
  };
};

// Migration function to split legacy 'main' document into month-based documents
export const migrateScheduleData = async () => {
  try {
    const mainRef = doc(db, 'schedules', 'main');
    const mainSnap = await getDoc(mainRef);
    
    if (!mainSnap.exists()) {
      console.log('No legacy "main" document found. Migration not needed.');
      return { success: true, message: 'No migration needed' };
    }
    
    const mainData = mainSnap.data()?.data || {};
    if (!mainData || Object.keys(mainData).length === 0) {
      console.log('Legacy "main" document is empty. Migration not needed.');
      return { success: true, message: 'No data to migrate' };
    }
    
    // Group by month
    const groupedByMonth = groupDatesByMonth(mainData);
    
    // Save each month
    const migrationPromises = Object.entries(groupedByMonth).map(async ([monthKey, monthData]) => {
      const monthRef = doc(db, 'schedules', monthKey);
      await setDoc(monthRef, { data: monthData });
      console.log(`Migrated data for month ${monthKey}`);
    });
    
    await Promise.all(migrationPromises);
    
    console.log('Migration completed successfully. Consider deleting the legacy "main" document after verifying data.');
    
    return { 
      success: true, 
      message: `Migrated ${Object.keys(groupedByMonth).length} months of data`,
      monthsMigrated: Object.keys(groupedByMonth)
    };
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
}; 