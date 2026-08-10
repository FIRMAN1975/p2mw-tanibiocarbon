import React, { useState } from "react";
import { X, AlertOctagon } from "lucide-react";
import { db } from "@/config/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";

export default function DisputeModal({ order, onClose }) {
  const [reason, setReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!order) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return toast.error("Alasan kendala wajib diisi!");

    setIsProcessing(true);
    const toastId = toast.loading("Mengajukan penahanan dana (Dispute)...");

    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "DISPUTE",
        disputeReason: reason,
        disputeAt: serverTimestamp(),
      });
      toast.success("Kendala diajukan! Dana Escrow dibekukan sementara.", { id: toastId });
      onClose();
    } catch (error) {
      toast.error("Gagal mengajukan kendala.", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-red-50">
          <h3 className="text-lg font-black text-red-700 flex items-center gap-2">
            <AlertOctagon className="w-5 h-5"/> Ajukan Kendala Kargo
          </h3>
          <button onClick={onClose} className="p-2 text-red-400 hover:bg-red-100 rounded-full transition"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Apakah kargo {order.productName} yang tiba tidak sesuai atau rusak? Jelaskan masalah Anda di bawah. <b>Dana di Escrow tidak akan diteruskan ke penjual sampai masalah ini selesai.</b>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">Alasan Kendala</label>
              <textarea 
                rows="4" 
                placeholder="Misal: Kargo basah, berat hanya 8 ton padahal pesan 10 ton, kadar air terlalu tinggi..." 
                value={reason} 
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 focus:bg-white transition-all" 
                required 
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">Batal</button>
              <button disabled={isProcessing} type="submit" className="w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 transition">
                {isProcessing ? "Memproses..." : "Tahan Dana Escrow"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}