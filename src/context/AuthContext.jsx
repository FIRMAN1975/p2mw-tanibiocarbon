import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, provider } from "@/config/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Fungsi Login Google (Menerima Role dari UI Modal)
  const loginWithGoogle = async (selectedRole) => {
    const result = await signInWithPopup(auth, provider);
    const currentUser = result.user;
    
    // Cek di database apakah user ini sudah pernah daftar
    const userRef = doc(db, "users", currentUser.uid);
    const userSnap = await getDoc(userRef);

    // JIKA USER BARU: Masukkan data & Role ke Database
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        role: selectedRole, // "petani" atau "mitra"
        verificationStatus: "unverified",
        createdAt: serverTimestamp(),
      });
    }
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userData, loginWithGoogle, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};