import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/config/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Search, MapPin, Factory, Sprout, ShoppingBag, ArrowRight, FlaskConical, Navigation, Layers, X } from "lucide-react";
import toast from "react-hot-toast";
import { calculateDistance } from "@/utils/helpers";
import AuthModal from "@/components/auth/AuthModal";
import * as Dialog from "@radix-ui/react-dialog";
import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

export default function MarketplacePage() {
  const { user, userData } = useAuth();
  const [products, setProducts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isProcessingBuy, setIsProcessingBuy] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  
  // UI States
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingBuyProduct, setPendingBuyProduct] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Ambil Data Real-time
  useEffect(() => {
    const q = query(collection(db, "products"), where("status", "==", "tersedia"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingInitial(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredProducts = products.filter(item => {
    const matchCat = selectedCategory === "Semua" || item.kategori === selectedCategory;
    const matchSearch = item.nama_komoditas?.toLowerCase().includes(searchTerm.toLowerCase()) || item.lokasi?.alamat_text?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  // FLOW SEAMLESS: Booking Kargo
  const initiateBooking = (product) => {
    if (!user) {
      setPendingBuyProduct(product);
      setIsAuthModalOpen(true);
      return;
    }
    executeBooking(product);
  };

  const executeBooking = async (product) => {
    if (user?.uid === product.farmerId) return toast.error("Anda tidak bisa membeli produk sendiri.");
    
    setIsProcessingBuy(true);
    const toastId = toast.loading("Mengamankan kargo untuk Anda...");
    
    try {
      await updateDoc(doc(db, "products", product.id), { status: "dipesan", bookedBy: user.uid });
      await addDoc(collection(db, "orders"), {
        productId: product.id, productName: product.nama_komoditas,
        farmerId: product.farmerId, farmerName: product.farmerName, sellerRole: product.sellerRole || "Pemasok",
        buyerId: user.uid, buyerName: user.displayName || "Pembeli",
        totalTon: product.berat_ton, pricePerTon: product.harga_per_ton, totalPrice: product.berat_ton * product.harga_per_ton,
        status: "WAITING_PAYMENT_SIMULATION", createdAt: serverTimestamp(),
      });
      toast.success("Kargo diamankan! Lanjutkan pembayaran di Dashboard.", { id: toastId });
      setSelectedProduct(null);
    } catch (err) {
      toast.error("Gagal memproses. Coba lagi.", { id: toastId });
    } finally {
      setIsProcessingBuy(false);
      setPendingBuyProduct(null);
    }
  };

  const categories = ["Semua", "Biochar / Arang", "Wood Pellet", "Briket Biomassa", "Limbah Pertanian"];

  return (
    <div className="w-full bg-slate-50 min-h-screen pb-20">
      
      {/* HERO SECTION (Diperbaiki Simetrisnya) */}
      <section className="bg-white border-b border-slate-200 pt-20 pb-16 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Pasokan Biomassa & <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-400">Biochar Terverifikasi</span>
          </h1>
          
          {/* Teks Deskripsi dibuat lebih lebar agar menjadi 1 baris rapi di desktop */}
          <p className="mt-6 text-lg text-slate-500 max-w-3xl text-center leading-relaxed">
            Temukan bahan mentah untuk industri Anda langsung dari sumbernya dengan transparansi kualitas lab dan kalkulasi logistik yang akurat.
          </p>
          
          {/* Search Bar diperlebar agar seimbang dengan Teks Judul */}
          <div className="mt-10 w-full max-w-2xl relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-green-500 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Cari komoditas, lokasi, atau nama pemasok..." 
              value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
              className="block w-full pl-12 pr-6 py-4 bg-slate-100 border-transparent rounded-2xl text-base text-slate-900 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
            />
          </div>

          {/* Filter Kategori */}
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {categories.map(cat => (
              <button 
                key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${selectedCategory === cat ? "bg-slate-900 text-white shadow-md scale-105" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Katalog Tersedia</h2>
          <span className="text-sm font-medium text-slate-500">{filteredProducts.length} Hasil</span>
        </div>

        {loadingInitial ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
                <div className="w-full h-48 bg-slate-200 animate-pulse rounded-xl"></div>
                <div className="h-5 bg-slate-200 animate-pulse rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 animate-pulse rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-24 bg-white border border-dashed border-slate-300 rounded-3xl">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Tidak ada produk ditemukan</h3>
            <p className="text-slate-500 mt-1">Coba gunakan kata kunci lain atau ubah kategori filter Anda.</p>
          </div>
        ) : (
          /* GRID 3 KOLOM: Memastikan kartu cukup lebar agar nominal uang tidak terpotong */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 xl:gap-8">
            {filteredProducts.map(item => {
              const isMitra = item.sellerRole?.includes("Mitra");
              const jarak = calculateDistance(userData?.lokasi?.lat, userData?.lokasi?.lng, item.lokasi?.lat, item.lokasi?.lng);

              return (
                <div 
                  key={item.id} onClick={() => { setSelectedProduct(item); setActiveImageIndex(0); }}
                  className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img src={item.fotoUrls?.[0]} alt={item.nama_komoditas} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide">
                      {item.kategori}
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
                      {isMitra ? <Factory className="w-3.5 h-3.5 text-blue-600" /> : <Sprout className="w-3.5 h-3.5 text-green-600" />}
                      <span className="truncate">{item.farmerName}</span>
                    </div>
                    
                    <h3 className="font-bold text-lg text-slate-900 leading-tight mb-2 line-clamp-2">{item.nama_komoditas}</h3>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      {item.kadar_air && <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><FlaskConical className="w-3 h-3"/> Air: {item.kadar_air}%</span>}
                      {jarak && <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1"><Navigation className="w-3 h-3"/> {jarak} km</span>}
                    </div>

                    {/* Area Harga Diperbaiki agar nominal tidak bertumpuk */}
                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase truncate">Stok</p>
                        <p className="font-black text-slate-800 truncate">{item.berat_ton} Ton</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Harga / Ton</p>
                        <p className="font-black text-lg text-green-600 truncate">Rp {item.harga_per_ton?.toLocaleString("id-ID")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL AUTH SEAMLESS */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onOpenChange={setIsAuthModalOpen} 
        onSuccess={() => { if (pendingBuyProduct) executeBooking(pendingBuyProduct); }}
      />

      {/* MODAL DETAIL PRODUK */}
      <Dialog.Root open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-in fade-in" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {selectedProduct && (
              <>
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div className="flex items-center gap-2"><span className="text-xs bg-green-100 text-green-800 font-bold px-2.5 py-1 rounded-full uppercase">{selectedProduct.kategori}</span></div>
                  <Dialog.Close asChild><button className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition"><X className="w-5 h-5"/></button></Dialog.Close>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1">
                  <img src={selectedProduct.fotoUrls[activeImageIndex]} className="w-full aspect-[16/9] object-cover rounded-2xl mb-4 shadow-sm border border-slate-100" alt="Produk" />
                  
                  {selectedProduct.fotoUrls?.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-4">
                      {selectedProduct.fotoUrls.map((url, idx) => (<button key={idx} onClick={() => setActiveImageIndex(idx)} className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition ${activeImageIndex === idx ? "border-slate-900 scale-95" : "border-transparent opacity-60 hover:opacity-100"}`}><img src={url} className="w-full h-full object-cover" /></button>))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:justify-between items-start mb-6 gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 mb-1">{selectedProduct.nama_komoditas}</h2>
                      <div className="flex items-center gap-2 text-sm text-slate-500"><MapPin className="w-4 h-4 text-slate-400"/> {selectedProduct.lokasi?.alamat_text}</div>
                    </div>
                    <div className="text-left sm:text-right bg-slate-50 p-3 rounded-xl border border-slate-100 w-full sm:w-auto">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-0.5">Total Estimasi Kargo</p>
                      <p className="text-2xl font-black text-green-600">Rp {(selectedProduct.berat_ton * selectedProduct.harga_per_ton).toLocaleString("id-ID")}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <p className="text-sm text-slate-600 leading-relaxed">{selectedProduct.deskripsi || "Tidak ada deskripsi detail."}</p>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                  <Dialog.Close asChild><button className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition">Batal</button></Dialog.Close>
                  <button onClick={() => initiateBooking(selectedProduct)} disabled={isProcessingBuy} className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50">
                    {isProcessingBuy ? "Memproses..." : "Beli Sekarang (Escrow)"} <ArrowRight className="w-4 h-4"/>
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}