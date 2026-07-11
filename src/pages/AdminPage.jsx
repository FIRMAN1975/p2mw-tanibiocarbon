import React from "react";
import { useAuth } from "@/context/AuthContext";

export default function AdminPage() {
  const { logout } = useAuth();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-rose-700">[PORTAL ADMIN PLATFORM]</h1>
      <p className="my-2">Tugas Utama: Memantau uang masuk di Xendit & menekan tombol "Release Funds" (Cairkan Escrow ke Petani/Mitra).</p>
      
      <div className="my-6 p-4 border border-rose-300 bg-rose-50 rounded">
        <h3 className="font-semibold text-rose-900">Kontrol Escrow Global</h3>
        <button className="bg-rose-600 text-white px-4 py-2 rounded mr-2 text-sm font-bold">Cairkan ke Petani (Kargo Sampai)</button>
        <button className="bg-slate-600 text-white px-4 py-2 rounded text-sm font-bold">Refund ke Pembeli (Batal/Sengketa)</button>
      </div>

      <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
    </div>
  );
}