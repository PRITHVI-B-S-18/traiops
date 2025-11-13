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
 * Create a new client
 * @param {Object} clientData - Client data
 * @returns {Promise<{success: boolean, clientId?: string, error?: string}>}
 */
export const createClient = async (clientData) => {
  try {
    const docRef = await addDoc(collection(db, 'clients'), {
      ...clientData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { success: true, clientId: docRef.id };
  } catch (error) {
    console.error('Error creating client:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all clients
 * @returns {Promise<Array>}
 */
export const getAllClients = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'clients'));
    return snapshot.docs.map(doc => ({
      clientId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
};

/**
 * Get active clients only
 * @returns {Promise<Array>}
 */
export const getActiveClients = async () => {
  try {
    const q = query(
      collection(db, 'clients'),
      where('status', '==', 'active')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      clientId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching active clients:', error);
    return [];
  }
};

/**
 * Get clients with assigned PMs
 * Returns all clients that have at least one PM assigned (for scheduling)
 * Only shows active clients by default
 * @param {boolean} includeInactive - Whether to include inactive clients
 * @returns {Promise<Array>}
 */
export const getClientsWithPMs = async (includeInactive = false) => {
  try {
    const clients = await getAllClients();
    // Filter clients that have at least one PM assigned
    let filteredClients = clients.filter(client => 
      client.programManagerIds && 
      Array.isArray(client.programManagerIds) && 
      client.programManagerIds.length > 0
    );
    
    // Filter by status if not including inactive
    if (!includeInactive) {
      filteredClients = filteredClients.filter(client => 
        client.status === 'active' || !client.status // Include active or clients without status set
      );
    }
    
    return filteredClients;
  } catch (error) {
    console.error('Error fetching clients with PMs:', error);
    return [];
  }
};

/**
 * Get a single client by ID
 * @param {string} clientId
 * @returns {Promise<Object|null>}
 */
export const getClient = async (clientId) => {
  try {
    const docSnap = await getDoc(doc(db, 'clients', clientId));
    if (docSnap.exists()) {
      return { clientId: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error fetching client:', error);
    return null;
  }
};

/**
 * Update client
 * @param {string} clientId
 * @param {Object} updates
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updateClient = async (clientId, updates) => {
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating client:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete client
 * @param {string} clientId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const deleteClient = async (clientId) => {
  try {
    // Soft delete by setting status to inactive
    await updateDoc(doc(db, 'clients', clientId), {
      status: 'inactive',
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error deleting client:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Assign Program Manager to client
 * @param {string} clientId
 * @param {string} programManagerId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const assignPMToClient = async (clientId, programManagerId) => {
  try {
    const clientDoc = await getClient(clientId);
    if (!clientDoc) {
      return { success: false, error: 'Client not found' };
    }

    const currentPMs = clientDoc.programManagerIds || [];
    if (currentPMs.includes(programManagerId)) {
      return { success: true, message: 'PM already assigned to this client' };
    }

    await updateDoc(doc(db, 'clients', clientId), {
      programManagerIds: [...currentPMs, programManagerId],
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error assigning PM to client:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Remove Program Manager from client
 * @param {string} clientId
 * @param {string} programManagerId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removePMFromClient = async (clientId, programManagerId) => {
  try {
    const clientDoc = await getClient(clientId);
    if (!clientDoc) {
      return { success: false, error: 'Client not found' };
    }

    const currentPMs = clientDoc.programManagerIds || [];
    const updatedPMs = currentPMs.filter(id => id !== programManagerId);

    await updateDoc(doc(db, 'clients', clientId), {
      programManagerIds: updatedPMs,
      updatedAt: serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error('Error removing PM from client:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get clients for a specific Program Manager
 * @param {string} programManagerId
 * @returns {Promise<Array>}
 */
export const getClientsByPM = async (programManagerId) => {
  try {
    const q = query(
      collection(db, 'clients'),
      where('programManagerIds', 'array-contains', programManagerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      clientId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching clients by PM:', error);
    return [];
  }
};

/**
 * Pre-populate initial clients
 * @returns {Promise<{success: boolean, created?: number, error?: string}>}
 */
export const prePopulateClients = async () => {
  try {
    const defaultClients = [
      'Sri Krishna College of Engineering & Technology',
      'Sri Krishna College of Technology',
      'Kumaraguru College of Technology',
      'Kumaraguru School of Innovation',
      'Sri Ramakrishna Engineering College',
      'Parul University - PIT',
      'Parul University - PIET',
      'LTIMindtree, Kalinga Bhubaneshwar',
      'LTIMindtree, Bangalore',
      'LTIMindtree, Maphe Mumbai'
    ];

    // Check if clients already exist
    const existingClients = await getAllClients();
    if (existingClients.length > 0) {
      return { success: true, message: 'Clients already exist', created: 0 };
    }

    let created = 0;
    for (const clientName of defaultClients) {
      const result = await createClient({
        name: clientName,
        description: '',
        programManagerIds: [],
        status: 'active'
      });
      if (result.success) {
        created++;
      }
    }

    return { success: true, created };
  } catch (error) {
    console.error('Error pre-populating clients:', error);
    return { success: false, error: error.message };
  }
};

