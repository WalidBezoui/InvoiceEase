
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Define the expected environment variable names
const ENV_VAR_NAMES = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

// Check for missing environment variables
const missingEnvVars: string[] = [];
Object.values(ENV_VAR_NAMES).forEach(varName => {
  if (!process.env[varName]) {
    missingEnvVars.push(varName);
  }
});

if (missingEnvVars.length > 0) {
  const errorMessage = `Firebase configuration is incomplete. The following environment variables are missing or empty: ${missingEnvVars.join(', ')}. 
Please ensure they are set in your .env.local file (e.g., NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key). 
Environment variables need to be prefixed with NEXT_PUBLIC_ to be available to the browser.`;
  console.error(errorMessage);
  // Throwing an error here will stop further execution and provide a clear message on the error page.
  throw new Error(errorMessage);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

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
