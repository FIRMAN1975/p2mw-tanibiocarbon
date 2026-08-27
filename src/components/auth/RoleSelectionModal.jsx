import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/config/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Sprout, Factory, Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function RoleSelectionModal() {
  const { user } = useAuth();
  const [needsRole, setNeedsRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Jika belum login, tidak perlu tampilkan modal ini
    if (!user) {
      setNeedsRole(false);
      setLoading(false);
      return;
    }

    // Cek apakah user sudah punya role di Firestore
    const checkRole = async () => {
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().role) {
          setNeedsRole(false); // Sudah punya role, aman.
        } else {
          setNeedsRole(true); // Belum punya role! Tampilkan modal.
        }
      } catch (error) {
        console.error("Error checking role:", error);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [user]);

  const handleSelectRole = async (selectedRole) => {
    setIsProcessing(true);
    const toastId = toast.loading("Menyiapkan dasbor Anda...");
    
    try {
      // Menyimpan role ke database (Gunakan setDoc dengan merge:true agar aman)
      await setDoc(doc(db, "users", user.uid), {
        role: selectedRole,
        email: user.email,
        displayName: user.displayName || "Pengguna Baru",
        verificationStatus: "unverified",
        createdAt: serverTimestamp(),
      }, { merge: true });
      
      toast.success("Berhasil! Mengalihkan...", { id: toastId });
      setNeedsRole(false);
      
      // Muat ulang halaman agar sistem Router langsung membaca role baru
      setTimeout(() => {
        window.location.reload();
      }, 800);
      
    } catch (error) {
      toast.error("Gagal menyimpan pilihan. Coba lagi.", { id: toastId });
      setIsProcessing(false);
    }
  };

  // Jangan render apa-apa jika masih loading, atau jika tidak butuh pilih role
  if (!user || loading || !needsRole) return null;

  return (
    <div className="fixed inset-0 z-[999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
        
        {/* BAGIAN KIRI - INFO */}
        <div className="bg-slate-900 p-8 md:w-5/12 flex flex-col justify-center text-white">
          <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-black mb-3">Selamat Datang di TaniBioCarbon!</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Untuk memberikan pengalaman dan antarmuka dasbor yang tepat, beri tahu kami apa tujuan utama Anda bergabung di platform ini.
          </p>
        </div>

        {/* BAGIAN KANAN - PILIHAN ROLE */}
        <div className="p-8 md:w-7/12 bg-slate-50 flex flex-col justify-center space-y-4">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Pilih Peran Anda:</h3>
          
          {/* OPSI 1: PETANI */}
          <button 
            disabled={isProcessing}
            onClick={() => handleSelectRole("petani")}
            className="w-full bg-white border-2 border-slate-200 hover:border-green-500 hover:shadow-md p-5 rounded-2xl flex items-center gap-4 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
              <Sprout className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-lg">Petani / Pengepul</h4>
              <p className="text-xs text-slate-500 mt-1">Saya ingin menjual limbah pertanian, biochar, atau raw material lainnya ke pabrik.</p>
            </div>
          </button>

          {/* OPSI 2: MITRA / PABRIK */}
          <button 
            disabled={isProcessing}
            onClick={() => handleSelectRole("mitra")}
            className="w-full bg-white border-2 border-slate-200 hover:border-blue-500 hover:shadow-md p-5 rounded-2xl flex items-center gap-4 transition-all text-left group disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
              <Factory className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-lg">Mitra Industri / Pabrik</h4>
              <p className="text-xs text-slate-500 mt-1">Saya ingin membeli bahan mentah untuk pasokan pabrik dengan aman via Escrow.</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}