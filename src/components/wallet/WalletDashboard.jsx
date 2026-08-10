import React from "react";
import { Wallet, Check, AlertTriangle } from "lucide-react";

export default function WalletDashboard({ orders = [], bankDetails }) {
  // 1. Hitung Dana Tertahan (Estimasi Potongan 4% Platform)
  const pendingFunds = orders
    .filter((o) => ["PAID_ESCROW", "SHIPPED", "CARGO_DELIVERED"].includes(o.status))
    .reduce((sum, o) => sum + (o.totalPrice * 0.96), 0);

  // 2. Hitung Dana Cair (Total Bersih yang sudah ditransfer Xendit)
  const releasedFunds = orders
    .filter((o) => o.status === "ESCROW_RELEASED")
    .reduce((sum, o) => sum + (o.netAmountToSeller || o.totalPrice * 0.96), 0);

  // 3. Ambil riwayat pencairan
  const releaseHistory = orders.filter((o) => o.status === "ESCROW_RELEASED");

  const bankName = bankDetails?.bankCode || "Bank";

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dompet & Pendapatan</h2>
      
      {/* KARTU SALDO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-sm text-slate-400 font-semibold mb-1">Total Pendapatan (Berhasil Cair)</p>
            <h3 className="text-3xl font-black">Rp {Math.floor(releasedFunds).toLocaleString()}</h3>
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex items-center gap-2 text-xs text-slate-300">
              <Check className="w-4 h-4 text-green-400" /> Langsung ditransfer ke {bankName}
            </div>
          </div>
          <Wallet className="absolute -right-6 -bottom-6 w-32 h-32 text-slate-800 opacity-50 z-0" />
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-sm text-slate-500 font-semibold mb-1">Dana Escrow (Tertahan)</p>
            <h3 className="text-3xl font-black text-slate-900">Rp {Math.floor(pendingFunds).toLocaleString()}</h3>
            <p className="text-xs text-slate-500 mt-2">Estimasi pendapatan bersih (setelah komisi 4%) untuk pesanan yang sedang berjalan.</p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-xl w-fit">
            <AlertTriangle className="w-4 h-4" /> Cair setelah kargo tiba
          </div>
        </div>
      </div>

      {/* RIWAYAT PENCAIRAN */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Riwayat Pencairan Dana</h3>
        </div>
        {releaseHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Belum ada riwayat pencairan dari Admin.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {releaseHistory.map(item => (
              <div key={item.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">CAIR</span>
                    <span className="text-xs text-slate-500 font-medium">TRX: {item.id.slice(0,8)}</span>
                  </div>
                  <p className="font-bold text-slate-900">{item.productName}</p>
                  <p className="text-xs text-slate-500 mt-1">Pembeli: {item.buyerName}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-lg font-black text-green-600">+ Rp {item.netAmountToSeller?.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                    Biaya Platform: Rp {item.platformFee?.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}