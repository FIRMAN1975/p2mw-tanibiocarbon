import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Sprout, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { auth, provider, db } from "@/config/firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function AuthModal({ isOpen, onOpenChange, onSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const toastId = toast.loading("Menghubungkan ke Google...");
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // Jika user baru, tetapkan role default (misal: "mitra")
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: "mitra", // Role default, user bisa mengubah/melengkapi di profil nanti
          verificationStatus: "unverified",
          createdAt: serverTimestamp(),
        });
        toast.success("Akun berhasil dibuat!", { id: toastId });
      } else {
        toast.success("Berhasil masuk!", { id: toastId });
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();

    } catch (error) {
      console.error(error);
      toast.error("Gagal login dengan Google.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] bg-white p-8 shadow-2xl rounded-3xl animate-in zoom-in-95">
          
          <div className="text-center mb-8">
            <div className="bg-slate-900 p-3 rounded-2xl w-fit mx-auto mb-4">
              <Sprout className="w-8 h-8 text-green-400" />
            </div>
            <Dialog.Title className="text-2xl font-black text-slate-900 mb-2">Selamat Datang</Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500">
              Silakan masuk ke akun TaniBioCarbon Anda untuk melanjutkan transaksi.
            </Dialog.Description>
          </div>

          <button 
            onClick={handleGoogleLogin} 
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {loading ? "Menghubungkan..." : "Lanjutkan dengan Google"}
          </button>

          <Dialog.Close asChild>
            <button className="absolute right-5 top-5 p-1.5 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition">
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}