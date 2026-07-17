import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Navbar from "@/components/layout/Navbar";
import MarketplacePage from "@/pages/MarketplacePage";
import PetaniPage from "@/pages/PetaniPage";
import MitraPage from "@/pages/MitraPage";
import AdminPage from "@/pages/AdminPage";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(userData?.role)) return <Navigate to="/" replace />;
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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="bottom-right" toastOptions={{ duration: 4000 }} />
        <MainLayout />
      </BrowserRouter>
    </AuthProvider>
  );
}