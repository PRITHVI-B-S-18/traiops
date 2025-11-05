import { db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

// Save trainer data to Firestore
export async function saveTrainerData(trainerData) {
  await setDoc(doc(db, 'trainers', 'main'), { trainerData });
}

// Load trainer data from Firestore
export async function loadTrainerData() {
  const docSnap = await getDoc(doc(db, 'trainers', 'main'));
  if (docSnap.exists()) {
    return docSnap.data().trainerData;
  }
  return [];
} 