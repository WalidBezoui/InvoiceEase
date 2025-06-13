
"use client";

import type { User as FirebaseUserType } from 'firebase/auth'; // Renamed to avoid conflict
import { onAuthStateChanged } from 'firebase/auth';
import type { ReactNode } from 'react';
import { createContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase'; // Ensure db is imported
import type { UserProfile } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  firebaseUser: FirebaseUserType | null;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseUser: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUserType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUserInstance) => {
      if (firebaseUserInstance) {
        setFirebaseUser(firebaseUserInstance); // Set Firebase user object
        try {
          const userDocRef = doc(db, "users", firebaseUserInstance.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const firestoreUser = userDocSnap.data() as UserProfile;
             // Combine Firebase Auth info with Firestore profile data
            setUser({
              uid: firebaseUserInstance.uid,
              email: firebaseUserInstance.email, // Prefer auth email
              displayName: firebaseUserInstance.displayName || firestoreUser.displayName, // Prefer auth display name
              photoURL: firebaseUserInstance.photoURL,
              planId: firestoreUser.planId || 'free', // Get planId from Firestore
            });
          } else {
            // Fallback if no Firestore document, though signup should create it
            setUser({
              uid: firebaseUserInstance.uid,
              email: firebaseUserInstance.email,
              displayName: firebaseUserInstance.displayName,
              photoURL: firebaseUserInstance.photoURL,
              planId: 'free', // Default to free if Firestore doc is missing
            });
            console.warn(`No Firestore user document found for UID: ${firebaseUserInstance.uid}. Defaulting planId.`);
          }
        } catch (error) {
          console.error("Error fetching user data from Firestore:", error);
          // Fallback to auth data only if Firestore fetch fails
          setUser({
            uid: firebaseUserInstance.uid,
            email: firebaseUserInstance.email,
            displayName: firebaseUserInstance.displayName,
            photoURL: firebaseUserInstance.photoURL,
            planId: 'free', // Default planId on error
          });
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, firebaseUser }}>
      {children}
    </AuthContext.Provider>
  );
}
