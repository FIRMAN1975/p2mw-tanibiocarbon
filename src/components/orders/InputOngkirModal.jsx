import React, { useState } from "react";
import { X, Calculator, CheckCircle } from "lucide-react";
import { db } from "@/config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function InputOngkirModal({ order, onClose }) {
  const [ongkir, setOngkir] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!order) return null;

  // Jika penjual menerima tawaran nego pembeli
  const handleTerimaNego = async () => {
    setIsProcessing(true);
    const toastId = toast.loading("Menerima tawaran nego...");
    try {
      const newTotal = order.cargoPrice + order.proposedShippingCost;
      await updateDoc(doc(db, "orders", order.id), {
        shippingCost: order.proposedShippingCost, // Ongkir resmi jadi harga nego
        totalPrice: newTotal,
        status: "WAITING_PAYMENT_SIMULATION", // Lanjut ke pembayaran
        proposedShippingCost: null // Hapus history tawaran
      });
      toast.success("Nego disetujui! Menunggu pembeli membayar.", { id: toastId });
      onClose();
    } catch (error) {
      toast.error("Gagal menyetujui nego", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  // Jika penjual memberi harga baru (Biasa atau Counter-Offer)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ongkir || ongkir < 0) return toast.error("Masukkan nominal ongkir yang valid");

    setIsProcessing(true);
    const toastId = toast.loading("Menyimpan ongkos kirim...");
    try {
      const shippingCost = Number(ongkir);
      const newTotal = order.cargoPrice + shippingCost;
      await updateDoc(doc(db, "orders", order.id), {
        shippingCost: shippingCost,
        totalPrice: newTotal,
        status: "WAITING_PAYMENT_SIMULATION",
        proposedShippingCost: null // Hapus history tawaran jika ditolak/di-counter
      });
      toast.success("Ongkir terkirim ke pembeli!", { id: toastId });
      onClose();
    } catch (error) {
      toast.error("Gagal mengirim ongkir", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-black text-slate-900">Hitung Ongkos Kirim</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6">
          <div className="mb-4 text-sm text-slate-600 space-y-2">
            <p><strong>Pabrik Tujuan:</strong> {order.deliveryAddress}</p>
            <p><strong>Muatan:</strong> {order.totalTon} Ton</p>
          </div>

          {/* JIKA PEMBELI SEDANG NEGO */}
          {order.proposedShippingCost && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6">
              <p className="text-xs font-bold text-blue-700 uppercase mb-1">Tawaran Nego Pembeli</p>
              <p className="text-2xl font-black text-blue-800 mb-3">Rp {order.proposedShippingCost.toLocaleString()}</p>
              <button onClick={handleTerimaNego} disabled={isProcessing} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4"/> Terima Tawaran Ini
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-amber-500"/> {order.proposedShippingCost ? "Atau Kirim Harga Baru (Tolak Nego)" : "Biaya Sewa Truk Logistik (Rp)"}
              </label>
              <input type="number" placeholder="Misal: 2500000" value={ongkir} onChange={(e) => setOngkir(e.target.value)} className="w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900" required />
            </div>
            <button disabled={isProcessing} type="submit" className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50">
              {isProcessing ? "Menyimpan..." : order.proposedShippingCost ? "Kirim Counter Nego" : "Kirim Tagihan ke Pembeli"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}