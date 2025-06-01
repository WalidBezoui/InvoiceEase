
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyDvK8q2-2PmkiRStI4TfUAv9mqfQcR871o",
  authDomain: "invoiceflow-b5b92.firebaseapp.com",
  databaseURL: "https://invoiceflow-b5b92-default-rtdb.firebaseio.com",
  projectId: "invoiceflow-b5b92",
  storageBucket: "invoiceflow-b5b92.firebasestorage.app",
  messagingSenderId: "917479650556",
  appId: "1:917479650556:web:1ab66d55068bc398d41379",
  measurementId: "G-B30CWJ0ZPG"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
