import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Leaf, Sprout, Wallet, ArrowUpRight, Plus, Trash2, Edit, History, Calendar, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PetaniPage() {
  const { user, logout } = useAuth();

  // --- STATE DATA LIMBAH & RIWAYAT ---
  const [limbahTersedia, setLimbahTersedia] = useState([
    { id: 1, jenis: "Sekam Padi", berat: 500, estimasiHarga: 250000, tanggal: "2026-07-10" },
    { id: 2, jenis: "Tongkol Jagung", berat: 300, estimasiHarga: 150000, tanggal: "2026-07-11" },
  ]);

  const [riwayatPenjualan, setRiwayatPenjualan] = useState([
    { id: 101, jenis: "Batang Singkong", berat: 1000, totalHarga: 500000, tanggalSelesai: "2026-07-05", mitra: "PT Biochar Indo" },
    { id: 102, jenis: "Sekam Padi", berat: 450, totalHarga: 225000, tanggalSelesai: "2026-07-01", mitra: "CV Tani Maju" },
  ]);

  // --- STATE UNTUK MODAL FORM CRUD ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    jenis: "",
    berat: "",
    estimasiHarga: "",
    tanggal: "",
  });

  // --- HANDLER MODAL & FORM ---
  const openTambahModal = () => {
    setFormData({
      id: null,
      jenis: "",
      berat: "",
      estimasiHarga: "",
      tanggal: new Date().toISOString().split('T')[0], // Set default ke hari ini
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setFormData(item);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // --- FUNGSI CRUD UTAMA ---
  const handleSubmitForm = (e) => {
    e.preventDefault();
    
    if (isEditing) {
      // UPDATE DATA (EDIT)
      setLimbahTersedia(
        limbahTersedia.map((item) =>
          item.id === formData.id
            ? { ...formData, berat: Number(formData.berat), estimasiHarga: Number(formData.estimasiHarga) }
            : item
        )
      );
    } else {
      // CREATE DATA (TAMBAH)
      const newItem = {
        ...formData,
        id: Date.now(), // Generate ID unik sementara
        berat: Number(formData.berat),
        estimasiHarga: Number(formData.estimasiHarga),
      };
      setLimbahTersedia([...limbahTersedia, newItem]);
    }
    
    closeModal();
  };

  const handleDelete = (id) => {
    // DELETE DATA (HAPUS)
    const konfirmasi = window.confirm("Apakah Anda yakin ingin menghapus catatan limbah ini?");
    if (konfirmasi) {
      setLimbahTersedia(limbahTersedia.filter((item) => item.id !== id));
    }
  };

  // Fungsi utilitas untuk format Rupiah
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(angka);
  };

  return (
    <div className="min-h-screen bg-green-50/50 pb-12">
      {/* Navbar */}
      <header className="bg-white border-b border-green-100 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-green-100 p-2 rounded-lg"><Sprout className="text-green-600 w-6 h-6" /></div>
          <h1 className="text-xl font-bold text-green-900">Portal Petani</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:inline-block">{user?.email}</span>
          <Button variant="outline" onClick={logout} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Limbah Disetor</CardTitle>
              <Leaf className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">1,450 kg</div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Pendapatan</CardTitle>
              <Wallet className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatRupiah(725000)}</div>
            </CardContent>
          </Card>
        </div>

        {/* --- BAGIAN CRUD MANAJEMEN LIMBAH --- */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <Leaf className="w-5 h-5 mr-2 text-green-600" />
                Limbah Siap Jual
              </h3>
              <p className="text-sm text-gray-500">Daftar limbah pertanian yang sedang menunggu penjemputan mitra.</p>
            </div>
            <Button onClick={openTambahModal} className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-4 h-4 mr-2" /> Catat Limbah Baru
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-green-100 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-green-50 border-b border-green-100">
                <tr>
                  <th className="px-6 py-4">Jenis Limbah</th>
                  <th className="px-6 py-4">Tanggal Pencatatan</th>
                  <th className="px-6 py-4">Berat (kg)</th>
                  <th className="px-6 py-4">Estimasi Harga</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {limbahTersedia.length > 0 ? (
                  limbahTersedia.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.jenis}</td>
                      <td className="px-6 py-4 flex items-center"><Calendar className="w-4 h-4 mr-2 text-gray-400"/> {item.tanggal}</td>
                      <td className="px-6 py-4">{item.berat} kg</td>
                      <td className="px-6 py-4 text-green-700 font-medium">{formatRupiah(item.estimasiHarga)}</td>
                      <td className="px-6 py-4 flex justify-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditModal(item)} className="h-8 px-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)} className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                      Belum ada catatan limbah tersedia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- BAGIAN RIWAYAT PENJUALAN --- */}
        <div>
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <History className="w-5 h-5 mr-2 text-emerald-600" />
              Riwayat Penjualan Terselesaikan
            </h3>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">ID Transaksi</th>
                  <th className="px-6 py-4">Jenis Limbah</th>
                  <th className="px-6 py-4">Mitra Pengolah</th>
                  <th className="px-6 py-4">Berat Terjual</th>
                  <th className="px-6 py-4">Total Pendapatan</th>
                  <th className="px-6 py-4">Tanggal Selesai</th>
                </tr>
              </thead>
              <tbody>
                {riwayatPenjualan.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">#TRX-{item.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{item.jenis}</td>
                    <td className="px-6 py-4">{item.mitra}</td>
                    <td className="px-6 py-4">{item.berat} kg</td>
                    <td className="px-6 py-4 text-emerald-700 font-bold">{formatRupiah(item.totalHarga)}</td>
                    <td className="px-6 py-4">{item.tanggalSelesai}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- MODAL FORM (Tampil jika isModalOpen === true) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {isEditing ? "Edit Catatan Limbah" : "Tambah Catatan Baru"}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Limbah</label>
                <input
                  type="text"
                  name="jenis"
                  value={formData.jenis}
                  onChange={handleInputChange}
                  placeholder="Contoh: Sekam Padi, Tongkol Jagung"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Berat (kg)</label>
                  <input
                    type="number"
                    name="berat"
                    value={formData.berat}
                    onChange={handleInputChange}
                    placeholder="Contoh: 500"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    name="tanggal"
                    value={formData.tanggal}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimasi Harga (Rp)</label>
                <input
                  type="number"
                  name="estimasiHarga"
                  value={formData.estimasiHarga}
                  onChange={handleInputChange}
                  placeholder="Contoh: 250000"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeModal} className="border-gray-300">
                  Batal
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
                  {isEditing ? "Simpan Perubahan" : "Simpan Data"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}