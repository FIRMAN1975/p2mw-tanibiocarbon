import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/config/firebase";
import { collection, query, onSnapshot, doc, updateDoc, where } from "firebase/firestore";
import { ShieldAlert, CheckCircle, Clock, DollarSign, RefreshCw, LogOut, ArrowUpRight, Users, UserCheck, UserX, AlertTriangle, Building2, Sprout, Factory, CreditCard, Phone, MapPin, Search } from "lucide-react";

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("escrow"); // 'escrow' | 'users'
  const [loadingId, setLoadingId] = useState(null);

  // State Data Real-time
  const [allOrders, setAllOrders] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("Semua"); // 'Semua' | 'petani' | 'mitra'

  // 1. REAL-TIME READ: Ambil SEMUA pesanan dari Firestore
  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAllOrders(items);
    });
    return () => unsubscribe();
  }, []);

  // 2. REAL-TIME READ: Ambil SEMUA pengguna (Petani & Mitra) untuk verifikasi
  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      // Hanya ambil yang rolenya petani atau mitra (sembunyikan sesama admin)
      const sellers = items.filter((u) => u.role === "petani" || u.role === "mitra");
      setAllUsers(sellers);
    });
    return () => unsubscribe();
  }, []);

  // --- KALKULASI STATISTIK ---
  const totalEscrowHold = allOrders
    .filter((o) => o.status === "PAID_ESCROW" || o.status === "CARGO_DELIVERED")
    .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  const totalReleased = allOrders
    .filter((o) => o.status === "ESCROW_RELEASED")
    .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  const pendingVerificationsCount = allUsers.filter((u) => u.verificationStatus === "pending").length;

  // --- AKSI ADMIN: VERIFIKASI PENGGUNA ---
  const handleVerifyUser = async (targetUser, newStatus) => {
    const actionText = newStatus === "verified" ? "SETUJUI / VERIFIKASI" : "TOLAK";
    const konfirmasi = window.confirm(
      `${actionText} AKUN INI?\n\nNama: ${targetUser.displayName || targetUser.email}\nRole: ${targetUser.role.toUpperCase()}\n\n${
        newStatus === "verified"
          ? "Akun ini akan DIIZINKAN mengupload komoditas ke Marketplace."
          : "Akun ini TIDAK AKAN BISA berjualan sampai melengkapi data."
      }`
    );
    if (!konfirmasi) return;

    setLoadingId(targetUser.id);
    try {
      await updateDoc(doc(db, "users", targetUser.id), {
        verificationStatus: newStatus, // 'verified' | 'rejected' | 'unverified'
        verifiedAt: newStatus === "verified" ? new Date() : null,
        verifiedBy: newStatus === "verified" ? (user?.email || "Admin Platform") : null,
      });
      alert(`✅ Akun berhasil diubah statusnya menjadi: ${newStatus.toUpperCase()}`);
    } catch (error) {
      alert("Gagal mengubah status verifikasi pengguna.");
    } finally {
      setLoadingId(null);
    }
  };

  // --- AKSI ADMIN: CAIRKAN ESCROW ---
  const handleReleaseEscrow = async (order) => {
    if (!window.confirm(`CAIRKAN DANA ESCROW?\n\nPenerima: ${order.farmerName}\nNominal: Rp ${order.totalPrice?.toLocaleString("id-ID")}\n\nPastikan transfer ke rekening bank terkait telah berhasil.`)) return;
    setLoadingId(order.id);
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "ESCROW_RELEASED",
        releasedAt: new Date(),
        releasedBy: user?.email || "Admin Platform",
      });
      alert("🎉 Dana Escrow berhasil dicairkan! Status transaksi selesai.");
    } catch (error) { alert("Gagal mencairkan dana."); } 
    finally { setLoadingId(null); }
  };

  // --- AKSI ADMIN: BATALKAN PESANAN ---
  const handleCancelAndRefund = async (order) => {
    if (!window.confirm("Batalkan pesanan ini? Status barang akan dikembalikan menjadi 'Tersedia' di Marketplace.")) return;
    setLoadingId(order.id);
    try {
      await updateDoc(doc(db, "orders", order.id), { status: "CANCELLED_REFUNDED", cancelledAt: new Date() });
      if (order.productId) await updateDoc(doc(db, "products", order.productId), { status: "tersedia", bookedBy: null, bookedByName: null });
      alert("Pesanan dibatalkan. Komoditas dikembalikan ke etalase publik.");
    } catch (error) { alert("Gagal membatalkan pesanan."); } 
    finally { setLoadingId(null); }
  };

  // Filter Pengguna di Tab Verifikasi
  const filteredUsers = allUsers.filter((u) => {
    const matchRole = filterRole === "Semua" || u.role === filterRole;
    const matchSearch =
      u.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.rekening_bank?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.alamat_lahan?.toLowerCase().includes(userSearchTerm.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* HEADER NAVBAR */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-6 h-6 text-rose-500" />
          <span className="font-black text-lg tracking-wide text-white">TaniBioCarbon <span className="text-rose-500 font-normal">| Admin Central Control</span></span>
        </div>
        <button onClick={logout} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm flex items-center gap-1.5 transition text-rose-300 font-bold">
          <LogOut className="w-4 h-4" /> Keluar
        </button>
      </header>

      {/* TAB NAVIGATION ADMIN */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 flex gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("escrow")}
          className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
            activeTab === "escrow" ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <DollarSign className="w-4 h-4" /> Monitoring Transaksi & Escrow ({allOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition relative ${
            activeTab === "users" ? "border-rose-500 text-rose-400" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" /> Verifikasi Akun Pemasok ({allUsers.length})
          {pendingVerificationsCount > 0 && (
            <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full animate-bounce">
              {pendingVerificationsCount} Baru
            </span>
          )}
        </button>
      </div>

      {/* KONTEN UTAMA */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        
        {/* KARTU STATISTIK GLOBAL (SELALU MUNCUL) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Dana Tertahan (Escrow Hold)</span>
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-400">Rp {totalEscrowHold.toLocaleString("id-ID")}</p>
            <span className="text-[11px] text-slate-400 mt-1 block">Siap dicairkan saat kargo diverifikasi</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Dicairkan ke Pemasok</span>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-2xl font-black text-green-400">Rp {totalReleased.toLocaleString("id-ID")}</p>
            <span className="text-[11px] text-slate-400 mt-1 block">Akumulasi payout sukses</span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700 p-5 rounded-2xl">
            <div className="flex justify-between items-center text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Antrean Verifikasi Pemasok</span>
              <UserCheck className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-white">{pendingVerificationsCount} <span className="text-sm font-normal text-slate-400">Menunggu</span></p>
            <span className="text-[11px] text-slate-400 mt-1 block">Periksa rekening bank sebelum izin jual</span>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: MONITORING TRANSAKSI & ESCROW
           ========================================================================= */}
        {activeTab === "escrow" && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800">
              <h2 className="font-bold text-base text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-green-400 animate-spin-slow" /> Aliran Transaksi & Log Escrow
              </h2>
              <span className="text-xs font-mono text-slate-400">Live Sync Active</span>
            </div>

            {allOrders.length === 0 ? (
              <div className="text-center py-16 text-slate-400">Belum ada transaksi di dalam sistem platform.</div>
            ) : (
              <div className="divide-y divide-slate-700/60">
                {allOrders.map((order) => {
                  const isProcessing = loadingId === order.id;
                  return (
                    <div key={order.id} className="p-5 hover:bg-slate-800/80 transition flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                            TRX: {order.id.slice(0, 8)}
                          </span>
                          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider ${
                            order.status === "CARGO_DELIVERED" ? "bg-purple-900/80 text-purple-300 border border-purple-500 animate-pulse" :
                            order.status === "ESCROW_RELEASED" ? "bg-green-900/80 text-green-300" :
                            order.status === "PAID_ESCROW" ? "bg-blue-900/80 text-blue-300" : "bg-slate-700 text-slate-300"
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">{order.productName} ({order.totalTon} Ton)</h4>
                        <p className="text-xs text-slate-300">
                          Pemasok: <span className="text-green-400 font-semibold">{order.farmerName}</span> {" ──> "} Pembeli: <span className="text-blue-400 font-semibold">{order.buyerName}</span>
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-700/60">
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Nominal Escrow</span>
                          <span className="text-base font-black text-white">Rp {order.totalPrice?.toLocaleString("id-ID")}</span>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                          {order.status === "CARGO_DELIVERED" && (
                            <button
                              disabled={isProcessing}
                              onClick={() => handleReleaseEscrow(order)}
                              className="bg-green-600 hover:bg-green-500 text-white font-black px-4 py-2 rounded-xl text-xs transition shadow-lg shadow-green-900/30 flex items-center gap-1.5 shrink-0"
                            >
                              <ArrowUpRight className="w-4 h-4" /> Cairkan ke Rekening Pemasok
                            </button>
                          )}
                          {(order.status === "WAITING_PAYMENT_SIMULATION" || order.status === "PAID_ESCROW") && (
                            <button
                              disabled={isProcessing}
                              onClick={() => handleCancelAndRefund(order)}
                              className="bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700 font-bold px-3 py-2 rounded-xl text-xs transition shrink-0"
                            >
                              Batalkan / Refund
                            </button>
                          )}
                          {order.status === "ESCROW_RELEASED" && (
                            <span className="text-xs font-mono text-green-400 bg-green-950/50 px-3 py-2 rounded-xl border border-green-800/60">
                              ✔ Payout Selesai
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: VERIFIKASI AKUN PEMASOK (PETANI & MITRA)
           ========================================================================= */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* BOX PENCARIAN & FILTER USER */}
            <div className="bg-slate-800 p-4 rounded-2xl border border-slate-700 flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2 px-3 bg-slate-900 rounded-xl border border-slate-700">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama, email, nomor HP, atau nama bank..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full py-2 bg-transparent text-xs focus:outline-none text-white font-medium"
                />
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="Semua">Semua Pemasok</option>
                <option value="petani">🌾 Khusus Petani</option>
                <option value="mitra">🏭 Khusus Mitra Industri</option>
              </select>
            </div>

            {/* DAFTAR PENGGUNA */}
            {filteredUsers.length === 0 ? (
              <div className="text-center py-16 bg-slate-800/50 rounded-2xl border border-slate-700 text-slate-400">
                Belum ada data pengguna yang sesuai dengan filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredUsers.map((u) => {
                  const isProcessing = loadingId === u.id;
                  const status = u.verificationStatus || "unverified"; // 'unverified' | 'pending' | 'verified' | 'rejected'
                  const isPetani = u.role === "petani";

                  return (
                    <div key={u.id} className={`bg-slate-800/70 border rounded-2xl p-5 transition flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${
                      status === "pending" ? "border-amber-500/80 bg-amber-950/10 shadow-lg shadow-amber-900/10" : "border-slate-700"
                    }`}>
                      {/* INFO USER */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 uppercase ${
                            isPetani ? "bg-green-900/80 text-green-300 border border-green-700" : "bg-blue-900/80 text-blue-300 border border-blue-700"
                          }`}>
                            {isPetani ? <Sprout className="w-3 h-3" /> : <Factory className="w-3 h-3" />} {u.role}
                          </span>

                          <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                            status === "verified" ? "bg-green-950 text-green-400 border-green-600" :
                            status === "pending" ? "bg-amber-950 text-amber-400 border-amber-500 animate-pulse" :
                            status === "rejected" ? "bg-rose-950 text-rose-400 border-rose-600" :
                            "bg-slate-900 text-slate-400 border-slate-700"
                          }`}>
                            {status === "verified" ? "✔ Terverifikasi (Siap Jual)" :
                             status === "pending" ? "⏳ Menunggu Verifikasi" :
                             status === "rejected" ? "❌ Ditolak Admin" : "⚪ Belum Mengajukan"}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-white">{u.displayName || "Tanpa Nama"}</h3>
                          <p className="text-xs text-slate-400 font-mono">{u.email}</p>
                        </div>

                        {/* DATA PROFIL & REKENING (YANG DIPERIKSA ADMIN) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-700/60 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Phone className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            <span className="truncate">{u.phone || "HP belum diisi"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span className="truncate">{u.alamat_lahan || "Alamat belum diisi"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-300 font-semibold bg-slate-900/80 px-2 py-1 rounded border border-slate-700">
                            <CreditCard className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{u.rekening_bank || "Rekening belum diisi"}</span>
                          </div>
                        </div>
                      </div>

                      {/* TOMBOL AKSI VERIFIKASI */}
                      <div className="flex sm:flex-col gap-2 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-700/60">
                        {status !== "verified" && (
                          <button
                            disabled={isProcessing || !u.rekening_bank}
                            onClick={() => handleVerifyUser(u, "verified")}
                            title={!u.rekening_bank ? "User belum mengisi rekening bank" : "Verifikasi Akun"}
                            className="flex-1 md:w-40 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black px-3 py-2 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5"
                          >
                            <UserCheck className="w-4 h-4" /> Setujui Verifikasi
                          </button>
                        )}

                        {status !== "rejected" && (
                          <button
                            disabled={isProcessing}
                            onClick={() => handleVerifyUser(u, "rejected")}
                            className="flex-1 md:w-40 bg-slate-800 hover:bg-rose-900/80 text-rose-400 hover:text-white border border-rose-800/60 font-bold px-3 py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                          >
                            <UserX className="w-4 h-4" /> Tolak / Batalkan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}