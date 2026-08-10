import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/config/firebase";
import { collection, query, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { 
  LayoutDashboard, Wallet, UserCheck, Menu, X, LogOut, 
  Search, CheckCircle2, RefreshCw, Phone, MapPin, 
  CreditCard, ShieldCheck, Sprout, Factory
} from "lucide-react";
import toast from "react-hot-toast";

export default function AdminPage() {
  const { user, logout } = useAuth();
  
  const [activeMenu, setActiveMenu] = useState("overview"); 
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

  const [allOrders, setAllOrders] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("Semua"); 

  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setAllOrders(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sellers = items.filter(u => u.role === "petani" || u.role === "mitra");
      setAllUsers(sellers);
    });
    return () => unsubscribe();
  }, []);

  const totalEscrowHold = allOrders
    .filter(o => ["PAID_ESCROW", "SHIPPED", "CARGO_DELIVERED"].includes(o.status))
    .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  const totalReleased = allOrders
    .filter(o => o.status === "ESCROW_RELEASED")
    .reduce((acc, curr) => acc + (curr.totalPrice || 0), 0);

  const pendingVerificationsCount = allUsers.filter(u => u.verificationStatus === "pending").length;

  const handleVerifyUser = async (targetUser, newStatus) => {
    const actionText = newStatus === "verified" ? "Setujui" : "Tolak";
    if (!window.confirm(`Yakin ingin ${actionText} akun ${targetUser.displayName}?`)) return;

    setLoadingId(targetUser.id);
    const toastId = toast.loading("Memperbarui...");
    try {
      await updateDoc(doc(db, "users", targetUser.id), {
        verificationStatus: newStatus,
        verifiedAt: newStatus === "verified" ? new Date() : null,
      });
      toast.success(`Akun: ${newStatus.toUpperCase()}`, { id: toastId });
    } catch (error) { toast.error("Gagal mengubah status.", { id: toastId }); } 
    finally { setLoadingId(null); }
  };

  const handleReleaseEscrow = async (order) => {
    if (!window.confirm(`Cairkan sisa dana ke rekening ${order.farmerName}? (Potongan platform 4% otomatis dihitung)`)) return;
    
    setLoadingId(order.id);
    const toastId = toast.loading("Memproses pencairan lewat Xendit...");
    try {
      // Menggunakan variabel dari file .env
      const functionUrl = import.meta.env.VITE_API_RELEASE_ESCROW;
      if (!functionUrl) throw new Error("URL API Release Escrow belum disetting di .env");

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Gagal mencairkan dana");
      }

      toast.success("Berhasil! Dana sedang ditransfer ke Petani.", { id: toastId });
    } catch (error) { 
      console.error("Disbursement Error:", error);
      toast.error(error.message, { id: toastId }); 
    } 
    finally { setLoadingId(null); }
  };

  const handleCancelOrder = async (order) => {
    if (!window.confirm("Batalkan pesanan ini?")) return;
    
    setLoadingId(order.id);
    const toastId = toast.loading("Membatalkan...");
    try {
      await updateDoc(doc(db, "orders", order.id), { status: "CANCELLED", cancelledAt: new Date() });
      if (order.productId) await updateDoc(doc(db, "products", order.productId), { status: "tersedia", bookedBy: null });
      toast.success("Dibatalkan.", { id: toastId });
    } catch (error) { toast.error("Gagal.", { id: toastId }); } 
    finally { setLoadingId(null); }
  };

  const filteredUsers = allUsers.filter(u => {
    const matchRole = filterRole === "Semua" || u.role === filterRole;
    const matchSearch = (u.displayName?.toLowerCase() || "").includes(userSearchTerm.toLowerCase()) || 
                        (u.email?.toLowerCase() || "").includes(userSearchTerm.toLowerCase());
    return matchRole && matchSearch;
  });

  const SidebarItem = ({ id, icon: Icon, label, badge }) => (
    <button
      onClick={() => { setActiveMenu(id); setIsMobileSidebarOpen(false); }}
      className={`w-full flex items-center justify-between px-3 py-2 mb-1 rounded-lg text-sm font-medium transition-colors ${
        activeMenu === id 
          ? "bg-slate-800 text-white" 
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      <div className="flex items-center gap-3"><Icon className="w-4 h-4" /> {label}</div>
      {badge > 0 && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white">{badge}</span>}
    </button>
  );

  const StatusBadge = ({ status }) => {
    switch (status) {
      case "WAITING_PAYMENT_SIMULATION": return <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">Menunggu Bayar</span>;
      case "PAID_ESCROW": return <span className="px-2 py-1 rounded bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">Dana Escrow</span>;
      case "SHIPPED": return <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase">Dikirim</span>;
      case "CARGO_DELIVERED": return <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 text-[10px] font-bold uppercase">Kargo Tiba</span>;
      case "ESCROW_RELEASED": return <span className="px-2 py-1 rounded bg-green-50 text-green-600 text-[10px] font-bold uppercase">Selesai (Cair)</span>;
      case "CANCELLED": return <span className="px-2 py-1 rounded bg-red-50 text-red-600 text-[10px] font-bold uppercase">Dibatalkan</span>;
      default: return <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">{status}</span>;
    }
  };

  return (
    <div className="flex w-full h-full bg-slate-50 font-sans text-slate-900">
      
      {/* MOBILE OVERLAY */}
      {isMobileSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}

      {/* COMPACT SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 flex flex-col transition-transform duration-200 lg:translate-x-0 lg:static lg:flex ${isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-sm tracking-wide">Admin Dashboard</span>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setIsMobileSidebarOpen(false)}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase px-3 mb-2">Menu</p>
          <SidebarItem id="overview" icon={LayoutDashboard} label="Overview" />
          <SidebarItem id="escrow" icon={Wallet} label="Transaksi Escrow" />
          <SidebarItem id="verification" icon={UserCheck} label="Verifikasi Akun" badge={pendingVerificationsCount} />
        </div>

        <div className="p-3 border-t border-slate-800">
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* COMPACT HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-500 hover:text-slate-900" onClick={() => setIsMobileSidebarOpen(true)}><Menu className="w-5 h-5" /></button>
            <h1 className="text-base font-semibold text-slate-800">
              {activeMenu === "overview" ? "Overview" : activeMenu === "escrow" ? "Transaksi Escrow" : "Verifikasi Akun"}
            </h1>
          </div>
          <div className="text-xs font-medium text-slate-500">{user?.email}</div>
        </header>

        {/* CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* TAB: OVERVIEW */}
            {activeMenu === "overview" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-xs text-slate-500 font-medium mb-1">Dana Escrow (Tertahan)</span>
                    <span className="text-xl font-bold text-slate-800">Rp {totalEscrowHold.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-xs text-slate-500 font-medium mb-1">Total Pencairan Sukses</span>
                    <span className="text-xl font-bold text-green-600">Rp {totalReleased.toLocaleString()}</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                    <span className="text-xs text-slate-500 font-medium mb-1">Verifikasi Menunggu</span>
                    <span className="text-xl font-bold text-amber-600">{pendingVerificationsCount} Akun</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-semibold text-sm text-slate-800">Transaksi Terbaru</h3>
                    <button onClick={()=>setActiveMenu("escrow")} className="text-xs text-blue-600 font-medium hover:underline">Lihat Semua</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
                        <tr><th className="px-5 py-3 font-medium">ID</th><th className="px-5 py-3 font-medium">Produk</th><th className="px-5 py-3 font-medium">Nominal</th><th className="px-5 py-3 font-medium">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allOrders.slice(0, 5).map(o => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="px-5 py-3 font-mono text-xs text-slate-500">{o.id.slice(0,8)}</td>
                            <td className="px-5 py-3 text-slate-800">{o.productName} <span className="text-slate-400 text-xs">({o.totalTon}t)</span></td>
                            <td className="px-5 py-3 font-semibold text-slate-700">Rp {o.totalPrice?.toLocaleString()}</td>
                            <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* TAB: ESCROW */}
            {activeMenu === "escrow" && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <h2 className="font-semibold text-sm text-slate-800">Manajemen Transaksi</h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 font-medium">Info Kargo</th>
                        <th className="px-5 py-3 font-medium">Pemasok & Pembeli</th>
                        <th className="px-5 py-3 font-medium">Nominal</th>
                        <th className="px-5 py-3 font-medium text-right">Aksi Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allOrders.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-mono text-slate-400">#{o.id.slice(0,6)}</span>
                              <StatusBadge status={o.status} />
                            </div>
                            <p className="font-semibold text-slate-800">{o.productName}</p>
                            <p className="text-xs text-slate-500">{o.totalTon} Ton</p>
                          </td>
                          <td className="px-5 py-4 text-xs">
                            <p><span className="text-slate-400">Jual:</span> <span className="font-medium text-slate-800">{o.farmerName}</span></p>
                            <p><span className="text-slate-400">Beli:</span> <span className="font-medium text-slate-800">{o.buyerName}</span></p>
                          </td>
                          <td className="px-5 py-4 font-bold text-slate-700">Rp {o.totalPrice?.toLocaleString()}</td>
                          <td className="px-5 py-4 text-right">
                            {o.status === "CARGO_DELIVERED" && (
                              <button disabled={loadingId === o.id} onClick={() => handleReleaseEscrow(o)} className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-slate-800">
                                Cairkan Dana
                              </button>
                            )}
                            {(o.status === "WAITING_PAYMENT_SIMULATION" || o.status === "PAID_ESCROW") && (
                              <button disabled={loadingId === o.id} onClick={() => handleCancelOrder(o)} className="text-red-600 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-50 border border-red-100">
                                Batal
                              </button>
                            )}
                            {o.status === "ESCROW_RELEASED" && <span className="text-xs text-green-600 font-medium">Selesai</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: VERIFICATION */}
            {activeMenu === "verification" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Cari nama / email..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} className="w-full text-sm outline-none" />
                  </div>
                  <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="py-2 px-3 bg-white border border-slate-200 rounded-lg text-sm outline-none">
                    <option value="Semua">Semua Role</option><option value="petani">Petani</option><option value="mitra">Mitra</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filteredUsers.map((u) => {
                    const status = u.verificationStatus || "unverified";
                    return (
                      <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                        
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                          {/* Nama & Role */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                {u.role === "petani" ? <Sprout className="w-3 h-3"/> : <Factory className="w-3 h-3"/>} {u.role}
                              </span>
                            </div>
                            <p className="font-semibold text-slate-800 text-sm">{u.displayName}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>

                          {/* Kontak */}
                          <div className="text-xs text-slate-600 space-y-1">
                            <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400"/> {u.phone || "-"}</p>
                            <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400"/> <span className="truncate w-32">{u.alamat_lahan || "-"}</span></p>
                          </div>

                          {/* Rekening & Status */}
                          <div className="text-xs space-y-1">
                            <p className="flex items-center gap-1.5 font-medium text-slate-800 bg-slate-50 p-1.5 rounded border border-slate-100">
                              <CreditCard className="w-3.5 h-3.5 text-blue-500"/> 
                              {u.bankDetails ? `${u.bankDetails.bankCode} - ${u.bankDetails.accountNumber}` : "Belum ada rekening"}
                            </p>
                            <p className="text-[10px] font-bold mt-1">Status: {status === "pending" ? <span className="text-amber-600">Menunggu</span> : status === "verified" ? <span className="text-green-600">Tembus</span> : <span className="text-slate-400">Belum / Ditolak</span>}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex md:flex-col gap-2 w-full md:w-auto shrink-0">
                          {status !== "verified" && (
                            <button disabled={loadingId === u.id || !u.bankDetails?.accountNumber} onClick={() => handleVerifyUser(u, "verified")} className="w-full bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">Setujui</button>
                          )}
                          {status !== "rejected" && (
                            <button disabled={loadingId === u.id} onClick={() => handleVerifyUser(u, "rejected")} className="w-full border border-slate-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50">Tolak</button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}