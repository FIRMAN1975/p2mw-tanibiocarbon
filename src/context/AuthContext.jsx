import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, provider } from "@/config/firebase";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

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
        } else {
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false); // Matikan loading setelah data ditarik
    });
    return unsubscribe;
  }, []);

  // Fungsi Login Google (Pembuatan profil dan role ditangani penuh oleh RoleSelectionModal)
  const loginWithGoogle = async () => {
    await signInWithPopup(auth, provider);
  };

  const logout = () => signOut(auth);

  return (
    <AuthContext.Provider value={{ user, userData, loginWithGoogle, logout, loading }}>
      {/* Jangan ditahan di sini, biarkan App.jsx yang menahan layarnya */}
      {children}
    </AuthContext.Provider>
  );
};