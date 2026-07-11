import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  LogOut, 
  Factory, 
  Package, 
  Flame, 
  CheckCircle, 
  ArrowRight, 
  Plus, 
  ClipboardCheck,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Import komponen Dialog dari shadcn
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function MitraPage() {
  const { user, logout } = useAuth();

  // --- STATE DATA DUMMY ---
  const [bahanBakuMasuk, setBahanBakuMasuk] = useState([
    { id: "IN-001", petani: "Bapak Budi", jenis: "Sekam Padi", berat: 1200, tanggal: "2026-07-10", status: "Menunggu Validasi" },
    { id: "IN-002", petani: "Kelompok Tani Makmur", jenis: "Tongkol Jagung", berat: 850, tanggal: "2026-07-11", status: "Menunggu Validasi" },
  ]);

  const [batchProduksi, setBatchProduksi] = useState([
    { id: "BCH-991", bahanBaku: "Sekam Padi", beratInput: 1000, beratOutput: 320, suhu: "450°C", status: "Tervalidasi MRV" },
    { id: "BCH-992", bahanBaku: "Batang Singkong", beratInput: 1500, beratOutput: 480, suhu: "500°C", status: "Menunggu Audit" },
  ]);

  // --- STATE FORM PRODUKSI ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    bahanBaku: "",
    beratInput: "",
    suhu: "",
    beratOutput: "",
  });

  // --- HANDLERS ---
  const handleTerimaBahan = (id) => {
    const konfirmasi = window.confirm(`Terima dan validasi bahan baku dengan ID ${id}? (Ini akan memicu pencairan dana ke petani)`);
    if (konfirmasi) {
      setBahanBakuMasuk(bahanBakuMasuk.filter(item => item.id !== id));
      alert("Bahan baku divalidasi. Dana Escrow diteruskan ke Petani.");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleCatatProduksi = (e) => {
    e.preventDefault();
    const newBatch = {
      id: `BCH-${Math.floor(Math.random() * 1000) + 100}`,
      bahanBaku: formData.bahanBaku,
      beratInput: Number(formData.beratInput),
      beratOutput: Number(formData.beratOutput),
      suhu: `${formData.suhu}°C`,
      status: "Menunggu Audit",
    };
    
    setBatchProduksi([newBatch, ...batchProduksi]);
    setIsDialogOpen(false);
    setFormData({ bahanBaku: "", beratInput: "", suhu: "", beratOutput: "" });
  };

  return (
    <div className="min-h-screen bg-blue-50/40 pb-12">
      {/* Navbar */}
      <header className="bg-white border-b border-blue-100 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-blue-100 p-2 rounded-lg"><Factory className="text-blue-700 w-6 h-6" /></div>
          <h1 className="text-xl font-bold text-blue-900">Portal Mitra Pengolah</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden md:inline-block">{user?.email}</span>
          <Button variant="outline" onClick={logout} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* --- BAGIAN RINGKASAN KPI --- */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">Dashboard Operasional</h2>
          <p className="text-gray-500 mt-1">Pantau aliran bahan baku dan metrik produksi fasilitas Anda.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Bahan Baku Diterima</CardTitle>
              <Package className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">12.4 Ton</div>
              <p className="text-xs text-blue-600 mt-1">Akumulasi bulan ini</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Biochar</CardTitle>
              <Flame className="w-4 h-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">3.8 Ton</div>
              <p className="text-xs text-gray-500 mt-1">Rata-rata yield konversi 30%</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Sertifikasi MRV</CardTitle>
              <CheckCircle className="w-4 h-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">85% Tervalidasi</div>
              <p className="text-xs text-gray-500 mt-1">Siap diserap oleh Buyer</p>
            </CardContent>
          </Card>
        </div>

        {/* --- SECTION 1: INBOUND (Penerimaan Bahan Baku) --- */}
        <div className="mb-10">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <ClipboardCheck className="w-5 h-5 mr-2 text-blue-600" />
              Antrean Bahan Baku Masuk
            </h3>
            <p className="text-sm text-gray-500">Lakukan verifikasi fisik saat limbah dari petani tiba di fasilitas Anda.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-blue-100 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-blue-50 border-b border-blue-100">
                <tr>
                  <th className="px-6 py-4">ID Pengiriman</th>
                  <th className="px-6 py-4">Nama Petani</th>
                  <th className="px-6 py-4">Jenis Limbah</th>
                  <th className="px-6 py-4">Berat Diklaim (kg)</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {bahanBakuMasuk.length > 0 ? (
                  bahanBakuMasuk.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-xs text-blue-600">{item.id}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.petani}</td>
                      <td className="px-6 py-4">{item.jenis}</td>
                      <td className="px-6 py-4 font-semibold">{item.berat} kg</td>
                      <td className="px-6 py-4 flex justify-center">
                        <Button size="sm" onClick={() => handleTerimaBahan(item.id)} className="bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" /> Verifikasi & Terima
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                      Tidak ada antrean pengiriman saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- SECTION 2: OUTBOUND (Produksi Biochar) --- */}
        <div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <Activity className="w-5 h-5 mr-2 text-orange-600" />
                Data Produksi & Pirolisis
              </h3>
              <p className="text-sm text-gray-500">Catat hasil akhir pembakaran limbah untuk didaftarkan sebagai kredit karbon.</p>
            </div>

            {/* INTEGRASI SHADCN DIALOG */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Catat Batch Baru
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Input Parameter Produksi</DialogTitle>
                  <DialogDescription>
                    Masukkan data operasional pirolisis. Data ini digunakan untuk kalkulasi yield dan verifikasi audit karbon.
                  </DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleCatatProduksi} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bahan Baku (Input)</label>
                    <input
                      type="text"
                      name="bahanBaku"
                      value={formData.bahanBaku}
                      onChange={handleInputChange}
                      placeholder="Contoh: Sekam Padi Campur"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Berat Input (kg)</label>
                      <input
                        type="number"
                        name="beratInput"
                        value={formData.beratInput}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Suhu Pirolisis (°C)</label>
                      <input
                        type="number"
                        name="suhu"
                        value={formData.suhu}
                        onChange={handleInputChange}
                        placeholder="Maks: 600"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-md border border-slate-200 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hasil Biochar Bersih (kg)</label>
                    <input
                      type="number"
                      name="beratOutput"
                      value={formData.beratOutput}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-2 italic">
                      *Berdasarkan model Random Forest historis, estimasi yield optimal pada rentang suhu ini adalah ~30-35%.
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                      Simpan Data Produksi
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">ID Batch</th>
                  <th className="px-6 py-4">Bahan Baku</th>
                  <th className="px-6 py-4">Proses Pirolisis</th>
                  <th className="px-6 py-4">Yield / Output</th>
                  <th className="px-6 py-4">Status Sertifikasi</th>
                </tr>
              </thead>
              <tbody>
                {batchProduksi.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-700">{item.id}</td>
                    <td className="px-6 py-4">{item.bahanBaku}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{item.beratInput} kg</span>
                        <span className="text-xs text-gray-500">Suhu: {item.suhu}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center font-bold text-orange-600">
                        <ArrowRight className="w-4 h-4 mr-2" /> {item.beratOutput} kg
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.status === 'Tervalidasi MRV' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}