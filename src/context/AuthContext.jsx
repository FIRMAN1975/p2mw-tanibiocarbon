import React, { createContext, useContext, useEffect, useState } from "react";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/config/firebase";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Fungsi Login Pop-up Google
  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const docRef = doc(db, "users", result.user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        // Flag user baru agar diarahkan ke layar pilih role
        return { isNewUser: true, user: result.user };
      } else {
        setUserData(docSnap.data());
        return { isNewUser: false, user: result.user, role: docSnap.data().role };
      }
    } catch (error) {
      console.error("Gagal Login:", error);
      throw error;
    }
  };

  // 2. Simpan Peran User Baru ke Firestore
  const registerUserRole = async (selectedUser, roleType) => {
    const newProfile = {
      uid: selectedUser.uid,
      displayName: selectedUser.displayName || "Pengguna",
      email: selectedUser.email,
      photoURL: selectedUser.photoURL || "",
      role: roleType, // "petani" | "mitra" | "company"
      isVerified: false,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, "users", selectedUser.uid), newProfile);
    setUserData(newProfile);
    return newProfile;
  };

  const logout = () => {
    setUserData(null);
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const docRef = doc(db, "users", currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setUserData(docSnap.data());
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading, loginWithGoogle, registerUserRole, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};