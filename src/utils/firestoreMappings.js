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
 * Create trainer-program manager mapping
 * @param {Object} mappingData - Mapping data
 * @param {string} adminUid - Admin who created the mapping
 * @returns {Promise<{success: boolean, mappingId?: string, error?: string}>}
 */
export const createMapping = async (mappingData, adminUid) => {
  try {
    const docRef = await addDoc(collection(db, 'trainer_mappings'), {
      ...mappingData,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active'
    });
    return { success: true, mappingId: docRef.id };
  } catch (error) {
    console.error('Error creating mapping:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get mappings for a trainer
 * @param {string} trainerId
 * @returns {Promise<Array>}
 */
export const getMappingsByTrainer = async (trainerId) => {
  try {
    const q = query(
      collection(db, 'trainer_mappings'),
      where('trainerId', '==', trainerId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      mappingId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching mappings:', error);
    return [];
  }
};

/**
 * Get mappings for a program manager
 * @param {string} programManagerId
 * @returns {Promise<Array>}
 */
export const getMappingsByProgramManager = async (programManagerId) => {
  try {
    const q = query(
      collection(db, 'trainer_mappings'),
      where('programManagerIds', 'array-contains', programManagerId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      mappingId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching mappings:', error);
    return [];
  }
};

/**
 * Update mapping
 * @param {string} mappingId
 * @param {Object} updates
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateMapping = async (mappingId, updates) => {
  try {
    await updateDoc(doc(db, 'trainer_mappings', mappingId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating mapping:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete mapping
 * @param {string} mappingId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteMapping = async (mappingId) => {
  try {
    // Soft delete by setting status to inactive
    await updateDoc(doc(db, 'trainer_mappings', mappingId), {
      status: 'inactive',
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting mapping:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all mappings
 * @returns {Promise<Array>}
 */
export const getAllMappings = async () => {
  try {
    const q = query(
      collection(db, 'trainer_mappings'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      mappingId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching all mappings:', error);
    return [];
  }
};

/**
 * Get mappings by client
 * @param {string} clientId
 * @returns {Promise<Array>}
 */
export const getMappingsByClient = async (clientId) => {
  try {
    const q = query(
      collection(db, 'trainer_mappings'),
      where('clientIds', 'array-contains', clientId),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      mappingId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching mappings by client:', error);
    return [];
  }
};

/**
 * Assign trainer to client (auto-assigns to all PMs of that client)
 * @param {string} trainerId
 * @param {string} trainerName
 * @param {string} trainerEmail
 * @param {string} clientId
 * @param {string} clientName
 * @param {Array} programManagerIds - Array of PM IDs for this client
 * @param {string} adminUid
 * @returns {Promise<{success: boolean, mappingId?: string, error?: string}>}
 */
export const assignTrainerToClient = async (
  trainerId,
  trainerName,
  trainerEmail,
  clientId,
  clientName,
  programManagerIds,
  adminUid
) => {
  try {
    // Check if mapping already exists for this trainer-client combination
    const existingMappings = await getMappingsByTrainer(trainerId);
    const existingMapping = existingMappings.find(m => 
      m.clientIds && m.clientIds.includes(clientId)
    );

    if (existingMapping) {
      return { 
        success: true, 
        mappingId: existingMapping.mappingId,
        message: 'Trainer already assigned to this client'
      };
    }

    // Create new mapping
    const mappingData = {
      trainerId,
      trainerName,
      trainerEmail,
      clientIds: [clientId],
      clientNames: [clientName],
      programManagerIds: programManagerIds || [],
      assignedBy: adminUid,
      assignedAt: serverTimestamp()
    };

    return await createMapping(mappingData, adminUid);
  } catch (error) {
    console.error('Error assigning trainer to client:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove trainer from client
 * @param {string} trainerId
 * @param {string} clientId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removeTrainerFromClient = async (trainerId, clientId) => {
  try {
    const mappings = await getMappingsByTrainer(trainerId);
    
    for (const mapping of mappings) {
      if (mapping.clientIds && mapping.clientIds.includes(clientId)) {
        const updatedClientIds = mapping.clientIds.filter(id => id !== clientId);
        const updatedClientNames = mapping.clientNames.filter((name, idx) => 
          mapping.clientIds[idx] !== clientId
        );

        if (updatedClientIds.length === 0) {
          // No more clients, delete the mapping
          await deleteMapping(mapping.mappingId);
        } else {
          // Update mapping with remaining clients
          await updateMapping(mapping.mappingId, {
            clientIds: updatedClientIds,
            clientNames: updatedClientNames
          });
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Error removing trainer from client:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Bulk assign trainers to client
 * @param {Array} trainerIds
 * @param {Object} trainerMap - Map of trainerId to trainer data {name, email}
 * @param {string} clientId
 * @param {string} clientName
 * @param {Array} programManagerIds
 * @param {string} adminUid
 * @returns {Promise<{success: boolean, assigned: number, failed: number, errors?: Array}>}
 */
export const bulkAssignTrainersToClient = async (
  trainerIds,
  trainerMap,
  clientId,
  clientName,
  programManagerIds,
  adminUid
) => {
  let assigned = 0;
  let failed = 0;
  const errors = [];

  for (const trainerId of trainerIds) {
    const trainer = trainerMap[trainerId];
    if (!trainer) {
      failed++;
      errors.push({ trainerId, error: 'Trainer data not found' });
      continue;
    }

    const result = await assignTrainerToClient(
      trainerId,
      trainer.name,
      trainer.email,
      clientId,
      clientName,
      programManagerIds,
      adminUid
    );

    if (result.success) {
      assigned++;
    } else {
      failed++;
      errors.push({ trainerId, error: result.error });
    }
  }

  return {
    success: true,
    assigned,
    failed,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Additional functions will be implemented as needed

