import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Loader2 } from "lucide-react"; // <-- Import Ikon Loading
import { AuthProvider, useAuth } from "./context/AuthContext";

import Navbar from "@/components/layout/Navbar";
import MarketplacePage from "@/pages/MarketplacePage";
import PetaniPage from "@/pages/PetaniPage";
import MitraPage from "@/pages/MitraPage";
import AdminPage from "@/pages/AdminPage";
import RoleSelectionModal from "@/components/auth/RoleSelectionModal";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, userData } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  // Cek apakah userData sudah masuk dan role-nya sesuai
  if (allowedRoles && (!userData || !allowedRoles.includes(userData.role))) return <Navigate to="/" replace />;
  return children;
};

// Layout Utama untuk Mengontrol Navbar
const MainLayout = () => {
  const location = useLocation();
  // Deteksi apakah sedang berada di halaman Admin
  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <div className={`min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col ${isAdminRoute ? "h-screen overflow-hidden" : ""}`}>
      {/* Navbar Global HANYA muncul jika BUKAN di halaman Admin */}
      {!isAdminRoute && <Navbar />} 
      
      <main className="flex-1 flex flex-col w-full h-full">
        <Routes>
          <Route path="/" element={<MarketplacePage />} />
          <Route path="/petani" element={<ProtectedRoute allowedRoles={["petani"]}><PetaniPage /></ProtectedRoute>} />
          <Route path="/mitra" element={<ProtectedRoute allowedRoles={["mitra"]}><MitraPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPage /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  );
};

// Komponen Pembungkus untuk Menahan Router saat Firebase Loading
const AppContent = () => {
  const { loading } = useAuth();

  // Jika Firebase masih loading, tampilkan layar penuh Spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-slate-900 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500 animate-pulse">Memuat Sesi TaniBioCarbon...</p>
      </div>
    );
  }

  // Jika Loading selesai, izinkan masuk ke Aplikasi
  return (
    <BrowserRouter>
      <RoleSelectionModal />
      <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
      <MainLayout />
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}