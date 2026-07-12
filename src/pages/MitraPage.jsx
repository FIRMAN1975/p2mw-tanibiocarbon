import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function MitraPage() {
  const { logout, user } = useAuth();
  const [loading, setLoading] = useState(false);

  // --- FUNGSIONALITAS UTAMA: TEMBAK BACKEND EMULATOR ---
  const handleSimulasiBayarKePetani = async () => {
    setLoading(true);
    try {
      const fakeOrderId = "TRX-" + Date.now(); // Membuat ID transaksi unik acak

      // Kita tembak alamat emulator Firebase Function lokal di laptopmu
      const response = await fetch("http://127.0.0.1:5001/p2mw-tanibiocarbon/us-central1/createEscrowInvoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: fakeOrderId,
          amount: 12000000, // Nominal Rp 12.000.000
          buyerEmail: user?.email || "mitra-test@tanibiocarbon.com",
          description: "Pembelian 10 Ton Bonggol Jagung - Escrow Hold"
        })
      });

      const data = await response.json();
      
      if (data.invoiceUrl) {
        // KEADAAN SUKSES: Browser akan membuka tab baru ke halaman invoice Sandbox Xendit!
        window.open(data.invoiceUrl, "_blank");
      } else {
        alert("Error dari Backend: " + (data.error || "Gagal membuat invoice"));
      }
    } catch (error) {
      console.error(error);
      alert("Koneksi ke backend gagal. Pastikan Emulator Firebase sudah menyala di terminal!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-blue-700">[PORTAL MITRA INDUSTRI]</h1>
      <p className="my-2 text-slate-600">Tugas Mitra: Membeli bahan mentah Petani. Uang tertahan di sistem Escrow.</p>
      
      <div className="my-6 p-6 border border-blue-300 bg-blue-50 rounded-xl shadow-sm max-w-md">
        <h3 className="font-bold text-lg text-blue-900 mb-1">Simulasi Pembelian Raw Material</h3>
        <p className="text-sm text-slate-600 mb-4">Item: 10 Ton Bonggol Jagung (Rp 12.000.000)</p>
        
        <button 
          onClick={handleSimulasiBayarKePetani}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-slate-300"
        >
          {loading ? "Menghubungkan ke Xendit..." : "Bayar via Xendit (Simulasi)"}
        </button>
      </div>

      <button onClick={logout} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors">
        Logout
      </button>
    </div>
  );
}