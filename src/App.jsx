import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Import Halaman Portal Role
import PetaniPage from "@/pages/PetaniPage";
import MitraPage from "@/pages/MitraPage";
import CompanyPage from "@/pages/CompanyPage";
import AdminPage from "@/pages/AdminPage";

// Import Komponen shadcn/ui & Icons
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout, Factory, Building2, Leaf } from "lucide-react";

// --- KOMPONEN PENGAMAN HALAMAN (PROTECTED ROUTE) ---
function ProtectedRoute({ children, allowedRole }) {
  const { user, userData, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-green-600 font-medium">Memuat Akses Keamanan...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (userData && userData.role !== allowedRole) return <Navigate to="/" replace />;

  return children;
}

// --- KOMPONEN UTAMA LOGIN & PILIH ROLE ---
function LoginPage() {
  // Kita ambil state murni dari AuthContext
  const { user, userData, loading: authLoading, loginWithGoogle, registerUserRole } = useAuth();
  
  // State loading untuk saat tombol diklik
  const [actionLoading, setActionLoading] = useState(false);

  // KONDISI 1: Loading State (Entah dari context saat muat halaman, atau saat tombol diklik)
  if (authLoading || actionLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Leaf className="w-12 h-12 text-green-600 animate-pulse mb-4" />
        <p className="text-green-700 font-medium">Memuat Sistem TaniBioCarbon...</p>
      </div>
    );
  }

  // KONDISI 2: User SUDAH login dan SUDAH punya role di database -> Lempar ke dashboard
  if (user && userData && userData.role) {
    return <Navigate to={`/${userData.role}`} replace />;
  }

  // KONDISI 3: User SUDAH login tapi BELUM punya role di database -> Wajib pilih role
  if (user && (!userData || !userData.role)) {
    
    const handleSelectRole = async (role) => {
      try {
        setActionLoading(true);
        // Menggunakan object 'user' langsung dari context, bukan nyimpan state lokal lagi
        await registerUserRole(user, role); 
      } catch (err) {
        alert("Gagal menyimpan peran: " + err.message);
      } finally {
        setActionLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-50 p-6 relative overflow-hidden">
        <h1 className="text-3xl font-bold mb-2 text-green-900 relative z-10">Pilih Peran Akun Anda</h1>
        <p className="text-gray-600 mb-8 text-center max-w-md relative z-10">
          Anda berhasil masuk dengan Google. Silakan tentukan peran Anda untuk melanjutkan.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full relative z-10">
          <Card onClick={() => handleSelectRole("petani")} className="cursor-pointer hover:border-green-500 hover:shadow-lg transition-all border-2 bg-white">
            <CardHeader className="text-center py-8">
              <Sprout className="mx-auto mb-4 w-12 h-12 text-green-600" />
              <CardTitle>Petani</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => handleSelectRole("mitra")} className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all border-2 bg-white">
            <CardHeader className="text-center py-8">
              <Factory className="mx-auto mb-4 w-12 h-12 text-blue-600" />
              <CardTitle>Mitra Industri</CardTitle>
            </CardHeader>
          </Card>
          <Card onClick={() => handleSelectRole("company")} className="cursor-pointer hover:border-purple-500 hover:shadow-lg transition-all border-2 bg-white">
            <CardHeader className="text-center py-8">
              <Building2 className="mx-auto mb-4 w-12 h-12 text-purple-600" />
              <CardTitle>Buyer / Company</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  // KONDISI 4: User BELUM login sama sekali -> Tampil UI Google Login TaniBioCarbon
  const handleGoogleLogin = async () => {
    try {
      setActionLoading(true);
      await loginWithGoogle(); 
      // Tidak perlu set 'isNewUser' di sini. Jika berhasil, state 'user' akan terisi 
      // dan React akan otomatis me-render ulang ke KONDISI 2 atau KONDISI 3.
    } catch (err) {
      alert("Gagal masuk dengan Google. Silakan coba lagi.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 bg-green-600 rounded-b-[20%] opacity-10"></div>
      
      <div className="w-full max-w-md p-8 bg-white border border-gray-100 rounded-2xl shadow-xl z-10 mx-4">
        
        <div className="flex flex-col items-center mb-10">
          <div className="bg-green-100 p-4 rounded-full mb-4 shadow-sm">
            <Leaf className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">TaniBioCarbon</h1>
          <p className="mt-2 text-sm text-gray-500 text-center px-4">
            Platform integrasi pertanian cerdas dan manajemen karbon.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleGoogleLogin}
            className="flex items-center justify-center w-full px-4 py-3.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all"
          >
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Masuk dengan Google
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            Dengan masuk, Anda menyetujui Ketentuan Layanan dan Kebijakan Privasi kami.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- ROOT ROUTER ---
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/petani" element={<ProtectedRoute allowedRole="petani"><PetaniPage /></ProtectedRoute>} />
          <Route path="/mitra" element={<ProtectedRoute allowedRole="mitra"><MitraPage /></ProtectedRoute>} />
          <Route path="/company" element={<ProtectedRoute allowedRole="company"><CompanyPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}