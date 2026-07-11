import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  LogOut, 
  Building2, 
  Globe, 
  ShieldCheck, 
  CreditCard, 
  ShoppingCart, 
  FileText,
  BadgeCheck
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
} from "@/components/ui/dialog";

export default function CompanyPage() {
  const { user, logout } = useAuth();

  // --- STATE DUMMY: MARKETPLACE KREDIT KARBON ---
  const [kreditTersedia, setKreditTersedia] = useState([
    { id: "CRD-881", sumber: "Mitra Biochar Indo", volume: 50, hargaPerTon: 250000, metode: "Pirolisis Sekam Padi", verifikasi: "Standar MRV Nasional" },
    { id: "CRD-882", sumber: "CV Tani Maju", volume: 120, hargaPerTon: 240000, metode: "Pirolisis Tongkol Jagung", verifikasi: "Standar MRV Nasional" },
  ]);

  // --- STATE DUMMY: PORTOFOLIO PERUSAHAAN ---
  const [portofolio, setPortofolio] = useState([
    { id: "TRX-701", idKredit: "CRD-805", volume: 200, totalHarga: 50000000, tanggal: "2026-06-15", status: "Sertifikat Terbit" },
  ]);

  // --- STATE UNTUK MODAL PEMBELIAN ---
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedKredit, setSelectedKredit] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- HANDLERS ---
  const handleBukaModalBeli = (kredit) => {
    setSelectedKredit(kredit);
    setIsDialogOpen(true);
  };

  const handleKonfirmasiBeli = () => {
    setIsProcessing(true);
    
    // Simulasi proses pembayaran Escrow Xendit / API Call
    setTimeout(() => {
      // Pindahkan dari kreditTersedia ke portofolio
      const newTrx = {
        id: `TRX-${Math.floor(Math.random() * 1000) + 500}`,
        idKredit: selectedKredit.id,
        volume: selectedKredit.volume,
        totalHarga: selectedKredit.volume * selectedKredit.hargaPerTon,
        tanggal: new Date().toISOString().split('T')[0],
        status: "Sertifikat Terbit",
      };

      setPortofolio([newTrx, ...portofolio]);
      setKreditTersedia(kreditTersedia.filter((item) => item.id !== selectedKredit.id));
      
      setIsProcessing(false);
      setIsDialogOpen(false);
      setSelectedKredit(null);
      alert("Pembelian berhasil! Dana telah masuk ke Escrow dan sertifikat karbon Anda telah diterbitkan.");
    }, 1500);
  };

  // Fungsi utilitas untuk format Rupiah
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(angka);
  };

  // Kalkulasi total aset (Portofolio)
  const totalVolumeKarbon = portofolio.reduce((acc, curr) => acc + curr.volume, 0);
  const totalInvestasi = portofolio.reduce((acc, curr) => acc + curr.totalHarga, 0);

  return (
    <div className="min-h-screen bg-purple-50/40 pb-12">
      {/* Navbar */}
      <header className="bg-white border-b border-purple-100 px-6 py-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-purple-100 p-2 rounded-lg"><Building2 className="text-purple-700 w-6 h-6" /></div>
          <h1 className="text-xl font-bold text-purple-900">Portal Korporat & ESG</h1>
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
          <h2 className="text-2xl font-semibold text-gray-800">Ringkasan Portofolio ESG</h2>
          <p className="text-gray-500 mt-1">Pantau total serapan emisi dan pendanaan lingkungan perusahaan Anda.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="border-l-4 border-l-purple-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Kredit Terserap</CardTitle>
              <Globe className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{totalVolumeKarbon} Ton CO₂e</div>
              <p className="text-xs text-purple-600 mt-1">Sertifikat aktif & tervalidasi</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-600 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Investasi Escrow</CardTitle>
              <CreditCard className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatRupiah(totalInvestasi)}</div>
              <p className="text-xs text-gray-500 mt-1">Tersalurkan ke ekosistem petani</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Dampak Lingkungan</CardTitle>
              <ShieldCheck className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">Tier 1 ESG</div>
              <p className="text-xs text-gray-500 mt-1">Sesuai standar pelaporan keberlanjutan</p>
            </CardContent>
          </Card>
        </div>

        {/* --- SECTION 1: MARKETPLACE KREDIT KARBON --- */}
        <div className="mb-10">
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-purple-600" />
              Bursa Kredit Karbon Tersedia
            </h3>
            <p className="text-sm text-gray-500">Beli kredit karbon yang telah diverifikasi (MRV) dari mitra pengolah biochar.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-purple-50 border-b border-purple-100">
                <tr>
                  <th className="px-6 py-4">ID Kredit</th>
                  <th className="px-6 py-4">Sumber / Mitra</th>
                  <th className="px-6 py-4">Volume (Ton CO₂e)</th>
                  <th className="px-6 py-4">Harga / Ton</th>
                  <th className="px-6 py-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {kreditTersedia.length > 0 ? (
                  kreditTersedia.map((item) => (
                    <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-purple-600">{item.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.sumber}</div>
                        <div className="text-xs text-gray-500">{item.metode}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-800">{item.volume} Ton</td>
                      <td className="px-6 py-4 font-medium text-gray-700">{formatRupiah(item.hargaPerTon)}</td>
                      <td className="px-6 py-4 flex justify-center">
                        <Button size="sm" onClick={() => handleBukaModalBeli(item)} className="bg-purple-600 hover:bg-purple-700 text-white h-8">
                          Beli Kredit
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-gray-400">
                      Belum ada kredit karbon baru yang tersedia di bursa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* --- SECTION 2: RIWAYAT TRANSAKSI & SERTIFIKAT --- */}
        <div>
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Sertifikat & Riwayat Transaksi
            </h3>
            <p className="text-sm text-gray-500">Daftar kredit karbon yang telah Anda akuisisi dan sah digunakan untuk laporan ESG.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">ID Transaksi</th>
                  <th className="px-6 py-4">ID Kredit Karbon</th>
                  <th className="px-6 py-4">Tanggal Pembelian</th>
                  <th className="px-6 py-4">Volume Serapan</th>
                  <th className="px-6 py-4">Total Investasi</th>
                  <th className="px-6 py-4">Status Dokumen</th>
                </tr>
              </thead>
              <tbody>
                {portofolio.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.id}</td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-700">{item.idKredit}</td>
                    <td className="px-6 py-4">{item.tanggal}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{item.volume} Ton</td>
                    <td className="px-6 py-4 font-medium text-blue-700">{formatRupiah(item.totalHarga)}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full w-max">
                        <BadgeCheck className="w-3 h-3 mr-1" /> {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* --- MODAL KONFIRMASI PEMBELIAN (SHADCN DIALOG) --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-purple-900">Konfirmasi Akuisisi Karbon</DialogTitle>
            <DialogDescription>
              Tinjau kembali rincian kredit karbon sebelum dana diteruskan ke sistem Escrow.
            </DialogDescription>
          </DialogHeader>
          
          {selectedKredit && (
            <div className="space-y-4 mt-2">
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ID Kredit:</span>
                  <span className="font-mono font-medium text-gray-900">{selectedKredit.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Mitra Pengolah:</span>
                  <span className="font-medium text-gray-900">{selectedKredit.sumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Volume Serapan:</span>
                  <span className="font-bold text-gray-900">{selectedKredit.volume} Ton CO₂e</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Harga per Ton:</span>
                  <span className="font-medium text-gray-900">{formatRupiah(selectedKredit.hargaPerTon)}</span>
                </div>
                <div className="border-t border-purple-200 pt-2 mt-2 flex justify-between">
                  <span className="font-semibold text-purple-900">Total Pembayaran:</span>
                  <span className="font-bold text-purple-700 text-lg">
                    {formatRupiah(selectedKredit.volume * selectedKredit.hargaPerTon)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">
                Dengan menekan "Bayar", dana akan diamankan melalui sistem Escrow dan disalurkan ke Petani & Mitra sesuai porsi yang disepakati.
              </p>

              <div className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isProcessing}
                >
                  Batal
                </Button>
                <Button 
                  type="button" 
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white" 
                  onClick={handleKonfirmasiBeli}
                  disabled={isProcessing}
                >
                  {isProcessing ? "Memproses Pembayaran..." : "Bayar & Terbitkan Sertifikat"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}