import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function MitraPage() {
  const { logout, user } = useAuth();
  const [loading, setLoading] = useState(false);

  // FUNGSI INTI: Simulasi Bayar ke Petani via Xendit
  const handleSimulasiBayarKePetani = async () => {
    setLoading(true);
    try {
      // Nanti di sini kita akan tembak API Backend/Firebase Function yang terhubung ke Xendit
      alert("Membuat Invoice Xendit (Escrow Hold)... Silakan lanjut di integrasi backend kelak.");
    } catch (error) {
      alert("Gagal memproses transaksi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-blue-700">[PORTAL MITRA INDUSTRI]</h1>
      <p className="my-2">Tugas Mitra: Membeli bahan mentah Petani. Uang tertahan di sistem Escrow.</p>
      
      <div className="my-6 p-4 border border-blue-300 bg-blue-50 rounded">
        <h3 className="font-semibold">Simulasi Pembelian Raw Material (Escrow Test)</h3>
        <p className="text-sm text-slate-600 mb-2">Item: 10 Ton Bonggol Jagung (Rp 12.000.000)</p>
        <button 
          onClick={handleSimulasiBayarKePetani}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded font-bold"
        >
          {loading ? "Memproses..." : "Bayar via Xendit (Simulasi)"}
        </button>
      </div>

      <button onClick={logout} className="bg-red-500 text-white px-4 py-2 rounded">Logout</button>
    </div>
  );
}