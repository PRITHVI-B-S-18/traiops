import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyBhBTfFhx3AcIznQe4aRumw-1SEvnXHFcU",
    authDomain: "trainer-scheduler-1812.firebaseapp.com",
    projectId: "trainer-scheduler-1812",
    storageBucket: "trainer-scheduler-1812.firebasestorage.app",
    messagingSenderId: "823790320674",
    appId: "1:823790320674:web:4873f99c8d8766f8c75e7b",
    measurementId: "G-KMWHM5SF2Z"
  };

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);