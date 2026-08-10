import React, { useState } from "react";
import { X, UploadCloud, Truck } from "lucide-react";
import { db, storage } from "@/config/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import toast from "react-hot-toast";

export default function ShippingProofModal({ order, onClose }) {
  const [nopol, setNopol] = useState("");
  const [supir, setSupir] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!order) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Foto Bukti Surat Jalan / Truk wajib diunggah!");

    setIsProcessing(true);
    const toastId = toast.loading("Mengunggah bukti pengiriman...");

    try {
      // Upload Gambar ke Firebase Storage
      const fileRef = ref(storage, `delivery_proofs/${order.id}_${Date.now()}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      // Update Firestore
      await updateDoc(doc(db, "orders", order.id), {
        status: "SHIPPED",
        no_polisi: nopol.toUpperCase(),
        nama_supir: supir,
        fotoSuratJalan: url,
        shippedAt: new Date()
      });

      toast.success("Kargo resmi diberangkatkan!", { id: toastId });
      onClose();
    } catch (error) {
      toast.error("Gagal mengirim kargo", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="text-lg font-black text-slate-900">Pemberangkatan Kargo</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="shipping-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Nomor Polisi Truk</label>
              <input type="text" placeholder="B 1234 XX" value={nopol} onChange={(e) => setNopol(e.target.value)} className="w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 uppercase" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Nama Supir / Kontak</label>
              <input type="text" placeholder="Pak Budi / 0812..." value={supir} onChange={(e) => setSupir(e.target.value)} className="w-full p-3.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900" required />
            </div>
            
            <div className="border-t border-slate-200 pt-4 mt-2">
              <label className="block text-sm font-semibold text-slate-900 mb-2">Upload Surat Jalan / Foto Truk *</label>
              {!preview ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl hover:bg-slate-50 cursor-pointer transition">
                  <UploadCloud className="w-8 h-8 text-slate-400 mb-2"/>
                  <span className="text-sm font-medium text-slate-500">Pilih Foto Bukti</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              ) : (
                <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                  <img src={preview} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => { setFile(null); setPreview(null); }} className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-full hover:bg-white text-red-500"><X className="w-4 h-4"/></button>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 shrink-0">
          <button type="submit" form="shipping-form" disabled={isProcessing} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
            {isProcessing ? "Mengunggah..." : <><Truck className="w-5 h-5"/> Konfirmasi Keberangkatan</>}
          </button>
        </div>
      </div>
    </div>
  );
}