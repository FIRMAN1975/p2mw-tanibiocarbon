import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Layout & Pages
import Navbar from "@/components/layout/Navbar";
import MarketplacePage from "@/pages/MarketplacePage";
import PetaniPage from "@/pages/PetaniPage";
import MitraPage from "@/pages/MitraPage";
import AdminPage from "@/pages/AdminPage";

// Route Guard untuk Dashboard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, userData, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(userData?.role)) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Toaster Modern (Sonner / Hot Toast style) */}
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            className: 'text-sm font-semibold rounded-xl shadow-lg border border-slate-100',
            duration: 4000,
          }} 
        />
        
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
          <Navbar /> {/* Navbar Global */}
          <main className="flex-1 flex flex-col">
            <Routes>
              {/* Marketplace sekarang menjadi Landing Page (Root) */}
              <Route path="/" element={<MarketplacePage />} />
              
              {/* Dashboard Routes (Protected) */}
              <Route path="/petani" element={<ProtectedRoute allowedRoles={["petani"]}><PetaniPage /></ProtectedRoute>} />
              <Route path="/mitra" element={<ProtectedRoute allowedRoles={["mitra"]}><MitraPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminPage /></ProtectedRoute>} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}