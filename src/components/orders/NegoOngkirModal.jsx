import React, { useState } from "react";
import { X, Handshake } from "lucide-react";
import { db } from "@/config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function NegoOngkirModal({ order, onClose }) {
  const [negoPrice, setNegoPrice] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!order) return null;

  const currentNegoCount = order.negoCount || 0;
  const sisaNego = 3 - currentNegoCount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!negoPrice || negoPrice < 0) return toast.error("Masukkan nominal nego yang valid");

    setIsProcessing(true);
    const toastId = toast.loading("Mengirim penawaran nego...");
    try {
      // Ubah status kembali ke AWAITING_SHIPPING_COST agar penjual merespons
      await updateDoc(doc(db, "orders", order.id), {
        status: "AWAITING_SHIPPING_COST",
        proposedShippingCost: Number(negoPrice), // Simpan harga tawaran pembeli
        negoCount: currentNegoCount + 1 // Tambah hitungan nego
      });
      
      toast.success("Tawaran nego terkirim ke penjual!", { id: toastId });
      onClose();
    } catch (error) {
      toast.error("Gagal mengirim nego", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-black text-slate-900">Nego Ongkos Kirim</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6">
          <div className="mb-4 text-sm text-slate-600 bg-blue-50 border border-blue-100 p-3 rounded-xl">
            <p>Ongkir Penjual: <strong>Rp {order.shippingCost?.toLocaleString()}</strong></p>
            <p className="text-blue-700 font-bold mt-1">Sisa Kesempatan Nego: {sisaNego}x</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5">
                <Handshake className="w-4 h-4 text-blue-500"/> Tawaran Harga Ongkir Anda (Rp)
              </label>
              <input 
                type="number" 
                placeholder="Misal: 2000000" 
                value={negoPrice} 
                onChange={(e) => setNegoPrice(e.target.value)}
                className="w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900" 
                required 
              />
            </div>
            <button disabled={isProcessing} type="submit" className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {isProcessing ? "Menyimpan..." : "Kirim Tawaran Nego"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}