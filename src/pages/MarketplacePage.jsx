import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/config/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Search, MapPin, Factory, Sprout, ShoppingBag, ArrowRight, FlaskConical, Navigation, Layers } from "lucide-react";
import toast from "react-hot-toast";
import { calculateDistance } from "@/utils/helpers";
import AuthModal from "@/components/auth/AuthModal"; // Modal Login Seamless
import * as Dialog from "@radix-ui/react-dialog"; // Untuk Modal Detail Produk

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
  const [pendingBuyProduct, setPendingBuyProduct] = useState(null); // Menyimpan state barang jika user harus login dulu

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
      setPendingBuyProduct(product); // Simpan niat beli
      setIsAuthModalOpen(true); // Buka modal login
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
      setSelectedProduct(null); // Tutup modal detail
    } catch (err) {
      toast.error("Gagal memproses. Coba lagi.", { id: toastId });
    } finally {
      setIsProcessingBuy(false);
      setPendingBuyProduct(null);
    }
  };

  // Helper Kategori Badges
  const categories = ["Semua", "Biochar / Arang", "Wood Pellet", "Briket Biomassa", "Limbah Pertanian"];

  return (
    <div className="w-full bg-slate-50 min-h-screen pb-20">
      {/* HEADER HERO (SaaS Style) */}
      <section className="bg-white border-b border-slate-200 pt-16 pb-12 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Pasokan Biomassa & <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-400">Biochar Terverifikasi</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            Temukan bahan mentah untuk industri Anda langsung dari sumbernya. Transparansi kualitas lab dan kalkulasi logistik secara real-time.
          </p>
          
          {/* SEARCH BAR MODERN */}
          <div className="mt-8 max-w-xl mx-auto relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-green-500 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Cari komoditas atau lokasi..." 
              value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
              className="block w-full pl-11 pr-4 py-3.5 bg-slate-100 border-transparent rounded-2xl text-base text-slate-900 focus:bg-white focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all outline-none shadow-sm"
            />
          </div>

          {/* FILTER PILLS */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {categories.map(cat => (
              <button 
                key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${selectedCategory === cat ? "bg-slate-900 text-white shadow-md scale-105" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT GRID */}
      <section className="max-w-7xl mx-auto px-6 mt-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">Katalog Tersedia</h2>
          <span className="text-sm font-medium text-slate-500">{filteredProducts.length} Hasil</span>
        </div>

        {loadingInitial ? (
          /* SKELETON LOADING (SaaS Best Practice) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-sm">
                <div className="w-full h-40 bg-slate-200 animate-pulse rounded-xl"></div>
                <div className="h-5 bg-slate-200 animate-pulse rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 animate-pulse rounded w-1/2"></div>
                <div className="pt-4 border-t flex justify-between">
                  <div className="h-4 bg-slate-200 animate-pulse rounded w-1/3"></div>
                  <div className="h-4 bg-slate-200 animate-pulse rounded w-1/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          /* EMPTY STATE */
          <div className="text-center py-24 bg-white border border-dashed border-slate-300 rounded-3xl">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Tidak ada produk ditemukan</h3>
            <p className="text-slate-500 mt-1">Coba gunakan kata kunci lain atau ubah kategori filter Anda.</p>
            <button onClick={()=>{setSearchTerm(""); setSelectedCategory("Semua");}} className="mt-6 text-green-600 font-semibold hover:underline">Reset Filter</button>
          </div>
        ) : (
          /* PRODUCT CARDS */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(item => {
              const isMitra = item.sellerRole?.includes("Mitra");
              const jarak = calculateDistance(userData?.lokasi?.lat, userData?.lokasi?.lng, item.lokasi?.lat, item.lokasi?.lng);

              return (
                <div 
                  key={item.id} onClick={() => setSelectedProduct(item)}
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
                      {item.kadar_air && <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1"><FlaskConical className="w-3 h-3"/> Air: {item.kadar_air}%</span>}
                      {jarak && <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1"><Navigation className="w-3 h-3"/> {jarak} km</span>}
                    </div>

                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">Stok</p><p className="font-black text-slate-800">{item.berat_ton} Ton</p></div>
                      <div className="text-right"><p className="text-[10px] text-slate-400 font-bold uppercase">Harga/Ton</p><p className="font-black text-lg text-green-600">Rp {item.harga_per_ton?.toLocaleString()}</p></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SEAMLESS AUTH MODAL */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onOpenChange={setIsAuthModalOpen} 
        onSuccess={() => {
          // Jika sukses login dan ada barang pending, langsung eksekusi belinya!
          if (pendingBuyProduct) executeBooking(pendingBuyProduct);
        }}
      />

      {/* PRODUCT DETAIL MODAL (Shadcn Style Dialog) */}
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
                  <img src={selectedProduct.fotoUrls[0]} className="w-full aspect-[16/9] object-cover rounded-2xl mb-6 shadow-sm border border-slate-100" alt="Produk" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 mb-1">{selectedProduct.nama_komoditas}</h2>
                      <div className="flex items-center gap-2 text-sm text-slate-500"><MapPin className="w-4 h-4 text-slate-400"/> {selectedProduct.lokasi?.alamat_text}</div>
                    </div>
                    <div className="text-right bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-0.5">Total Estimasi</p>
                      <p className="text-2xl font-black text-green-600">Rp {(selectedProduct.berat_ton * selectedProduct.harga_per_ton).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Detail & Spesifikasi</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white p-3 rounded-xl border border-slate-100"><p className="text-[10px] text-slate-400 font-bold uppercase">Stok Tersedia</p><p className="font-bold text-slate-800">{selectedProduct.berat_ton} Ton</p></div>
                      <div className="bg-white p-3 rounded-xl border border-slate-100"><p className="text-[10px] text-slate-400 font-bold uppercase">Kadar Air Lab</p><p className="font-bold text-slate-800">{selectedProduct.kadar_air || "-"}</p></div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{selectedProduct.deskripsi || "Tidak ada deskripsi detail."}</p>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-white flex justify-end gap-3">
                  <Dialog.Close asChild><button className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition">Batal</button></Dialog.Close>
                  <button 
                    disabled={isProcessingBuy}
                    onClick={() => initiateBooking(selectedProduct)} 
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-900/20 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
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