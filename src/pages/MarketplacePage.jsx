import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/config/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import { Sprout, Search, MapPin, Tag, Layers, Phone, Building2, CheckCircle2, X, ArrowRight, ShoppingBag, LogOut, Factory } from "lucide-react";

export default function MarketplacePage() {
  const { user, userData, logout } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // State untuk Filter & Pencarian
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [selectedSource, setSelectedSource] = useState("Semua"); // 'Semua' | 'Petani' | 'Mitra'

  // State untuk Modal Detail Produk & Galeri Foto
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // 1. READ: Ambil SEMUA produk dari Firestore yang berstatus "tersedia" (Public Read)
  useEffect(() => {
    const q = query(collection(db, "products"), where("status", "==", "tersedia"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(items);
    });
    return () => unsubscribe();
  }, []);

  // 2. FILTER LOGIC: Filter berdasarkan pencarian teks, kategori, dan sumber penjual
  const filteredProducts = products.filter((item) => {
    const isMitraSeller = item.sellerRole && item.sellerRole.includes("Mitra");
    
    const matchCategory = selectedCategory === "Semua" || item.kategori === selectedCategory;
    const matchSource =
      selectedSource === "Semua" ||
      (selectedSource === "Mitra" ? isMitraSeller : !isMitraSeller);
    
    const matchSearch =
      item.nama_komoditas?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.lokasi?.alamat_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.farmerName?.toLowerCase().includes(searchTerm.toLowerCase());
      
    return matchCategory && matchSource && matchSearch;
  });

  // 3. SIMULASI BOOKING / PEMESANAN
  const handleSimulasiBooking = async (product) => {
    if (!user) return alert("Harap login terlebih dahulu untuk melakukan pemesanan.");
    if (user.uid === product.farmerId) return alert("Anda tidak dapat memesan komoditas milik Anda sendiri.");

    const confirmBooking = window.confirm(
      `Konfirmasi Booking Kargo:\n\nItem: ${product.nama_komoditas} (${product.berat_ton} Ton)\nPemasok: ${product.farmerName}\nTotal Harga: Rp ${(product.berat_ton * product.harga_per_ton).toLocaleString("id-ID")}\n\nStatus barang akan diubah menjadi "Dipesan" agar diamankan untuk Anda.`
    );

    if (!confirmBooking) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, "products", product.id), {
        status: "dipesan",
        bookedBy: user.uid,
        bookedByName: user.displayName || "Pembeli Marketplace",
      });

      await addDoc(collection(db, "orders"), {
        productId: product.id,
        productName: product.nama_komoditas,
        farmerId: product.farmerId,
        farmerName: product.farmerName,
        sellerRole: product.sellerRole || "Petani Raw Material",
        buyerId: user.uid,
        buyerName: user.displayName || "Pembeli Marketplace",
        buyerEmail: user.email,
        totalTon: product.berat_ton,
        pricePerTon: product.harga_per_ton,
        totalPrice: product.berat_ton * product.harga_per_ton,
        status: "WAITING_PAYMENT_SIMULATION",
        createdAt: serverTimestamp(),
      });

      alert("🎉 Booking Berhasil! Barang telah diamankan untuk Anda. Integrasi pembayaran Xendit akan dilanjutkan pada tahap berikutnya.");
      setSelectedProduct(null);
    } catch (error) {
      console.error("Error booking:", error);
      alert("Gagal memproses pesanan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // Helper boolean untuk mengecek apakah produk di modal milik Mitra
  const isSelectedMitraSeller = selectedProduct?.sellerRole?.includes("Mitra");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER NAVBAR */}
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Sprout className="w-6 h-6 text-green-400" />
          <span className="font-extrabold text-lg tracking-wide text-white">TaniBioCarbon <span className="text-green-400 font-normal">| Marketplace</span></span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{user.displayName}</p>
                <span className="text-[11px] bg-green-900 text-green-300 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Role: {userData?.role || "User"}
                </span>
              </div>
              <button onClick={logout} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm flex items-center gap-1 transition">
                <LogOut className="w-4 h-4 text-red-400" /> <span className="hidden md:inline">Keluar</span>
              </button>
            </>
          ) : (
            <a href="/" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
              Login Akun
            </a>
          )}
        </div>
      </header>

      {/* HERO SECTION & SEARCH BAR */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white px-6 py-10 shadow-inner">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
            Bursa Pasokan Raw Material & Produk Olahan Biomassa
          </h1>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto mb-8">
            Temukan suplai limbah mentah langsung dari Petani atau beli produk olahan (Biochar/Wood Pellet) dari Mitra Industri terverifikasi.
          </p>

          {/* BOX PENCARIAN & FILTER MULTIPLE */}
          <div className="bg-white p-3 rounded-2xl shadow-xl flex flex-col md:flex-row gap-3 max-w-4xl mx-auto text-slate-800">
            <div className="flex-1 flex items-center gap-2 px-3 bg-slate-100 rounded-xl border border-slate-200">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari komoditas, nama desa, atau kabupaten..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2.5 bg-transparent text-sm focus:outline-none font-medium"
              />
            </div>

            {/* FILTER KATEGORI */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-2.5 px-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer"
            >
              <option value="Semua">Semua Kategori</option>
              <option value="Limbah Pertanian">Limbah Pertanian</option>
              <option value="Limbah Kehutanan">Limbah Kehutanan</option>
              <option value="Biochar / Arang">Biochar / Arang</option>
              <option value="Karbon Aktif">Karbon Aktif</option>
              <option value="Wood Pellet">Wood Pellet</option>
            </select>

            {/* FILTER SUMBER PASOKAN (PETANI VS MITRA) */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="py-2.5 px-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-500 cursor-pointer text-blue-900 font-bold"
            >
              <option value="Semua">Semua Pemasok</option>
              <option value="Petani">🌾 Khusus Petani (Raw Material)</option>
              <option value="Mitra">🏭 Khusus Mitra Industri (Olahan)</option>
            </select>
          </div>
        </div>
      </div>

      {/* KONTEN KATALOG PRODUK */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 my-4">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm font-bold text-slate-600">
            Menampilkan <span className="text-green-700 font-extrabold">{filteredProducts.length}</span> pasokan siap kirim
          </p>
          {(searchTerm || selectedCategory !== "Semua" || selectedSource !== "Semua") && (
            <button
              onClick={() => { setSearchTerm(""); setSelectedCategory("Semua"); setSelectedSource("Semua"); }}
              className="text-xs text-red-600 hover:underline font-semibold"
            >
              Reset Semua Filter
            </button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-lg">Komoditas Tidak Ditemukan</h3>
            <p className="text-sm text-slate-500 mt-1">Belum ada pasokan yang sesuai dengan filter atau kata kunci pencarian Anda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((item) => {
              const isMitraSeller = item.sellerRole && item.sellerRole.includes("Mitra");

              return (
                <div
                  key={item.id}
                  onClick={() => { setSelectedProduct(item); setActiveImageIndex(0); }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-green-400 transition cursor-pointer overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    {/* THUMBNAIL FOTO UTAMA (WEBP) */}
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      <img
                        src={item.fotoUrls?.[0] || "/placeholder.png"}
                        alt={item.nama_komoditas}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider">
                        {item.kategori}
                      </span>

                      {/* BADGE SUMBER PENJUAL (PETANI VS MITRA) */}
                      <span className={`absolute top-3 right-3 text-[10px] font-extrabold px-2.5 py-1 rounded-md shadow flex items-center gap-1 ${
                        isMitraSeller 
                          ? "bg-blue-600 text-white" 
                          : "bg-green-600 text-white"
                      }`}>
                        {isMitraSeller ? <Factory className="w-3 h-3" /> : <Sprout className="w-3 h-3" />}
                        {isMitraSeller ? "Mitra Industri" : "Petani Raw"}
                      </span>

                      {item.fotoUrls?.length > 1 && (
                        <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded font-mono">
                          +{item.fotoUrls.length - 1} Foto
                        </span>
                      )}
                    </div>

                    {/* INFO RINGKAS */}
                    <div className="p-5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        {isMitraSeller ? (
                          <Factory className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <Sprout className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        )}
                        <span className="font-bold text-slate-700 truncate">{item.farmerName}</span>
                        <span className="text-[10px] text-slate-400">({isMitraSeller ? "Olahan Pabrik" : "Lahan Petani"})</span>
                      </div>

                      <h3 className="font-extrabold text-lg text-slate-900 group-hover:text-green-700 transition line-clamp-1">
                        {item.nama_komoditas}
                      </h3>

                      <div className="flex items-center gap-1 text-xs text-slate-500 mt-1.5">
                        <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span className="truncate font-medium">{item.lokasi?.alamat_text || "Lokasi terlampir di peta"}</span>
                      </div>

                      <div className="my-4 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                        <div>
                          <p className="text-[11px] text-slate-400 uppercase font-bold">Stok Siap Kirim</p>
                          <p className="font-black text-slate-800 text-base">{item.berat_ton} Ton</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-slate-400 uppercase font-bold">Harga / Ton</p>
                          <p className={`font-black text-lg ${isMitraSeller ? "text-blue-700" : "text-green-700"}`}>
                            Rp {item.harga_per_ton?.toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* TOMBOL ACTION CARD */}
                  <div className="px-5 pb-5 pt-0">
                    <button className="w-full bg-slate-100 group-hover:bg-slate-900 text-slate-700 group-hover:text-white font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2">
                      Lihat Detail & Peta Logistik <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* =========================================================================
          MODAL OVERLAY: DETAIL PRODUK + GOOGLE MAPS READ-ONLY + BOOKING
         ========================================================================= */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 sm:p-6 animate-fadeIn overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col">
            
            {/* MODAL HEADER */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <span className={`text-xs text-white px-2.5 py-1 rounded font-bold uppercase tracking-wider ${isSelectedMitraSeller ? "bg-blue-600" : "bg-green-600"}`}>
                  {selectedProduct.kategori}
                </span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded font-semibold">
                  {isSelectedMitraSeller ? "🏭 Produk Olahan Mitra" : "🌾 Raw Material Petani"}
                </span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL BODY (SCROLLABLE) */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* SECTION 1: GALERI FOTO INTERAKTIF */}
              <div>
                <div className="aspect-[16/9] sm:aspect-[21/9] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 mb-3">
                  <img
                    src={selectedProduct.fotoUrls?.[activeImageIndex] || "/placeholder.png"}
                    alt="Foto Utama"
                    className="w-full h-full object-cover"
                  />
                </div>
                {selectedProduct.fotoUrls?.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedProduct.fotoUrls.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                          activeImageIndex === idx ? "border-slate-900 scale-95 shadow-sm" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={url} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION 2: DESKRIPSI & INFO PEMASOK */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="md:col-span-2 space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Deskripsi & Spesifikasi</h4>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {selectedProduct.deskripsi || "Tidak ada catatan deskripsi yang disertakan."}
                  </p>
                </div>
                <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Informasi Pemasok</h4>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-10 h-10 rounded-full font-black flex items-center justify-center text-base shrink-0 ${
                      isSelectedMitraSeller ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                    }`}>
                      {isSelectedMitraSeller ? <Factory className="w-5 h-5" /> : <Sprout className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{selectedProduct.farmerName}</p>
                      <p className={`text-xs font-semibold ${isSelectedMitraSeller ? "text-blue-700" : "text-green-700"}`}>
                        {isSelectedMitraSeller ? "Mitra Industri Terverifikasi" : "Petani Terverifikasi"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: GOOGLE MAPS READ-ONLY */}
              <div className="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-red-600" /> {isSelectedMitraSeller ? "Titik Lokasi Gudang / Pabrik Mitra" : "Titik Penjemputan Truk / Gudang Petani"}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedProduct.lokasi?.alamat_text}</p>
                  </div>
                  <span className="text-[11px] bg-red-50 text-red-700 font-semibold px-2.5 py-1 rounded-md border border-red-100 shrink-0">
                    Peta Logistik
                  </span>
                </div>

                <div className="w-full h-64 rounded-xl overflow-hidden border border-slate-300 relative">
                  <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}>
                    <Map
                      defaultCenter={{
                        lat: selectedProduct.lokasi?.lat || -6.200000,
                        lng: selectedProduct.lokasi?.lng || 106.816666,
                      }}
                      defaultZoom={15}
                      gestureHandling={"cooperative"}
                    >
                      <Marker
                        position={{
                          lat: selectedProduct.lokasi?.lat || -6.200000,
                          lng: selectedProduct.lokasi?.lng || 106.816666,
                        }}
                      />
                    </Map>
                  </APIProvider>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-right font-mono">
                  Koordinat: {selectedProduct.lokasi?.lat?.toFixed(5)}, {selectedProduct.lokasi?.lng?.toFixed(5)}
                </p>
              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 border-t border-slate-800">
              <div className="w-full sm:w-auto text-center sm:text-left">
                <p className="text-xs text-slate-400">Total Pembayaran Kargo ({selectedProduct.berat_ton} Ton):</p>
                <p className={`text-2xl font-black ${isSelectedMitraSeller ? "text-blue-400" : "text-green-400"}`}>
                  Rp {(selectedProduct.berat_ton * selectedProduct.harga_per_ton).toLocaleString("id-ID")}
                </p>
              </div>

              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition flex-1 sm:flex-initial"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={loading || user?.uid === selectedProduct.farmerId}
                  onClick={() => handleSimulasiBooking(selectedProduct)}
                  className={`px-6 py-3 disabled:bg-slate-700 text-white rounded-xl font-extrabold text-sm shadow-lg transition flex items-center justify-center gap-2 flex-1 sm:flex-initial ${
                    isSelectedMitraSeller ? "bg-blue-600 hover:bg-blue-500" : "bg-green-600 hover:bg-green-500"
                  }`}
                >
                  {loading ? "Memproses..." : "Pesan & Booking Kargo (Simulasi)"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}