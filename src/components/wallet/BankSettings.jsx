import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";

export default function BankSettings({ user, userData }) {
  const [bankData, setBankData] = useState({
    bankCode: "BCA",
    accountName: "",
    accountNumber: ""
  });
  const [isSavingBank, setIsSavingBank] = useState(false);

  useEffect(() => {
    if (userData?.bankDetails) {
      setBankData(userData.bankDetails);
    }
  }, [userData]);

  const handleSaveBank = async () => {
    if (!bankData.accountName || !bankData.accountNumber) {
      return toast.error("Nama pemilik dan nomor rekening wajib diisi!");
    }
    
    setIsSavingBank(true);
    const toastId = toast.loading("Menyimpan data rekening...");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        bankDetails: {
          ...bankData,
          updatedAt: serverTimestamp()
        }
      });
      toast.success("Data rekening berhasil disimpan!", { id: toastId });
    } catch (error) {
      console.error("Gagal menyimpan bank:", error);
      toast.error("Terjadi kesalahan saat menyimpan", { id: toastId });
    } finally {
      setIsSavingBank(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mt-6">
      <h3 className="text-lg font-bold text-slate-800 mb-1">Rekening Pencairan Dana</h3>
      <p className="text-sm text-slate-500 mb-5">
        Pastikan data rekening benar agar pencairan dana Escrow tidak gagal.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Bank</label>
          <select 
            value={bankData.bankCode}
            onChange={(e) => setBankData({ ...bankData, bankCode: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
          >
            <option value="BCA">BCA</option>
            <option value="MANDIRI">Mandiri</option>
            <option value="BNI">BNI</option>
            <option value="BRI">BRI</option>
            <option value="PERMATA">Permata</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Atas Nama</label>
          <input 
            type="text" 
            placeholder="Contoh: Budi Santoso"
            value={bankData.accountName}
            onChange={(e) => setBankData({ ...bankData, accountName: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Nomor Rekening</label>
          <input 
            type="number" 
            placeholder="Contoh: 8765432190"
            value={bankData.accountNumber}
            onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
          />
        </div>
      </div>

      <button 
        onClick={handleSaveBank}
        disabled={isSavingBank}
        className="w-full md:w-auto px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all"
      >
        {isSavingBank ? "Menyimpan..." : "Simpan Data Rekening"}
      </button>
    </div>
  );
}