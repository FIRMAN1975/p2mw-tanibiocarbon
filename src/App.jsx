import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";

// Import Halaman Portal Role
import PetaniPage from "@/pages/PetaniPage";
import MitraPage from "@/pages/MitraPage";
import CompanyPage from "@/pages/CompanyPage";
import AdminPage from "@/pages/AdminPage";

// Import Komponen shadcn/ui untuk Form Login
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sprout, Factory, Building2 } from "lucide-react";

// --- KOMPONEN PENGAMAN HALAMAN (PROTECTED ROUTE) ---
function ProtectedRoute({ children, allowedRole }) {
  const { user, userData, loading } = useAuth();

  if (loading) return <div className="p-8 text-center">Memuat Akses Keamanan...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (userData && userData.role !== allowedRole) return <Navigate to="/" replace />;

  return children;
}

// --- KOMPONEN UTAMA LOGIN & PILIH ROLE ---
function LoginPage() {
  const { user, userData, loginWithGoogle, registerUserRole } = useAuth();
  const [currentUserRef, setCurrentUserRef] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(false);

  // Jika user lama sudah login, otomatis lempar ke portalnya masing-masing
  if (user && userData && !isNewUser) {
    return <Navigate to={`/${userData.role}`} replace />;
  }

  const handleLogin = async () => {
    try {
      setLoading(true);
      const res = await loginWithGoogle();
      if (res.isNewUser) {
        setCurrentUserRef(res.user);
        setIsNewUser(true);
      }
    } catch (err) {
      alert("Gagal masuk dengan Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRole = async (role) => {
    try {
      setLoading(true);
      await registerUserRole(currentUserRef, role);
      setIsNewUser(false);
    } catch (err) {
      alert("Gagal menyimpan peran.");
    } finally {
      setLoading(false);
    }
  };

  if (isNewUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <h1 className="text-2xl font-bold mb-6">Pilih Peran Akun Anda</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full">
          <Card onClick={() => !loading && handleSelectRole("petani")} className="cursor-pointer hover:border-green-600 border-2">
            <CardHeader className="text-center"><Sprout className="mx-auto mb-2" /><CardTitle>Petani</CardTitle></CardHeader>
          </Card>
          <Card onClick={() => !loading && handleSelectRole("mitra")} className="cursor-pointer hover:border-blue-600 border-2">
            <CardHeader className="text-center"><Factory className="mx-auto mb-2" /><CardTitle>Mitra Industri</CardTitle></CardHeader>
          </Card>
          <Card onClick={() => !loading && handleSelectRole("company")} className="cursor-pointer hover:border-purple-600 border-2">
            <CardHeader className="text-center"><Building2 className="mx-auto mb-2" /><CardTitle>Buyer / Company</CardTitle></CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm shadow-md bg-white">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-bold">TaniBioCarbon Core Auth</CardTitle>
          <CardDescription>Uji Coba Sistem Aliran Escrow Xendit</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleLogin} disabled={loading} className="w-full bg-slate-900 text-white">
            {loading ? "Menghubungkan..." : "Masuk dengan Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// --- ROOT ROUTER ---
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Halaman Bebas (Login) */}
          <Route path="/" element={<LoginPage />} />

          {/* Halaman Terkunci Sesuai Role */}
          <Route path="/petani" element={<ProtectedRoute allowedRole="petani"><PetaniPage /></ProtectedRoute>} />
          <Route path="/mitra" element={<ProtectedRoute allowedRole="mitra"><MitraPage /></ProtectedRoute>} />
          <Route path="/company" element={<ProtectedRoute allowedRole="company"><CompanyPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRole="admin"><AdminPage /></ProtectedRoute>} />

          {/* Fallback jika route salah */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}