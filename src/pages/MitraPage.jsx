import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/config/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { Factory, ShoppingBag, Truck, AlertTriangle, PlusCircle, Layers, Settings, MapPin, Trash2, Check, X, ZoomIn, Lock, MessageCircle, Star, FlaskConical, Image as ImageIcon, UploadCloud, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import { calculateDistance, formatWhatsAppLink } from "@/utils/helpers";

const getCroppedImgWebP = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.src = imageSrc; image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob((blob) => { resolve({ file: new File([blob], `mitra_${Date.now()}.webp`, { type: "image/webp" }), previewUrl: URL.createObjectURL(blob) }); }, "image/webp", 0.8);
    };
  });
};

function LocationPickerWithReverseGeocode({ pinLocation, setPinLocation, alamatText, setAlamatText }) {
  const inputRef = useRef(null); const places = useMapsLibrary("places"); const geocoding = useMapsLibrary("geocoding"); const [placeAutocomplete, setPlaceAutocomplete] = useState(null); const [geocoder, setGeocoder] = useState(null); const map = useMap();
  useEffect(() => { if (places && inputRef.current) setPlaceAutocomplete(new places.Autocomplete(inputRef.current, { fields: ["geometry", "name", "formatted_address"], componentRestrictions: { country: "id" } })); if (geocoding) setGeocoder(new geocoding.Geocoder()); }, [places, geocoding]);
  useEffect(() => {
    if (!placeAutocomplete) return;
    placeAutocomplete.addListener("place_changed", () => {
      const place = placeAutocomplete.getPlace();
      if (place.geometry?.location) { setPinLocation({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }); setAlamatText(place.formatted_address || place.name); if (map) map.panTo({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }); }
    });
  }, [placeAutocomplete, setPinLocation, setAlamatText, map]);
  const handleMapClick = (ev) => {
    if (!ev.detail.latLng) return;
    setPinLocation({ lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng });
    if (geocoder) geocoder.geocode({ location: { lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng } }, (res, status) => { if (status === "OK" && res[0]) setAlamatText(res[0].formatted_address); });
  };
  return (
    <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
      <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-500" /> Titik Gudang / Pabrik Mitra *</label>
      <input ref={inputRef} type="text" placeholder="Cari alamat atau klik pada peta..." value={alamatText} onChange={e => setAlamatText(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm mb-4 focus:ring-2 focus:ring-slate-900 outline-none transition-all bg-white"/>
      <div className="w-full h-64 rounded-xl overflow-hidden relative border border-slate-200 shadow-inner"><Map defaultCenter={pinLocation} defaultZoom={13} onClick={handleMapClick}><Marker position={pinLocation} /></Map></div>
    </div>
  );
}

function OrderTimelineTracker({ status }) {
  const steps = [{ key: "WAITING_PAYMENT_SIMULATION", label: "Dipesan" }, { key: "PAID_ESCROW", label: "Dana Escrow" }, { key: "SHIPPED", label: "Dikirim" }, { key: "CARGO_DELIVERED", label: "Tiba" }, { key: "ESCROW_RELEASED", label: "Selesai" }];
  let currentIndex = steps.findIndex((s) => s.key === status); if (currentIndex === -1) currentIndex = 0;
  return (
    <div className="w-full py-4 px-2 my-2 border-y border-slate-100">
      <div className="flex justify-between items-center relative">
        <div className="absolute top-2.5 left-0 right-0 h-[3px] bg-slate-200 mx-4"><div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}></div></div>
        {steps.map((step, idx) => (
          <div key={step.key} className="flex flex-col items-center z-10">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${idx <= currentIndex ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"} ${idx === currentIndex ? "ring-4 ring-slate-200 scale-125" : ""}`}>{idx + 1}</div>
            <span className={`text-[9px] mt-2 font-bold uppercase tracking-wider ${idx === currentIndex ? "text-slate-900" : "text-slate-400"}`}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MitraPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("belanja");
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const [buyerOrders, setBuyerOrders] = useState([]); 
  const [sellerOrders, setSellerOrders] = useState([]); 
  const [myProducts, setMyProducts] = useState([]);

  // Form Upload
  const [namaKomoditas, setNamaKomoditas] = useState(""); const [kategori, setKategori] = useState("Biochar / Arang"); const [beratTon, setBeratTon] = useState(""); const [hargaPerTon, setHargaPerTon] = useState("");
  const [kadarAir, setKadarAir] = useState(""); const [kadarKarbon, setKadarKarbon] = useState(""); const [deskripsi, setDeskripsi] = useState("");
  const [alamatText, setAlamatText] = useState(""); const [pinLocation, setPinLocation] = useState({ lat: -6.200000, lng: 106.816666 }); const [croppedImages, setCroppedImages] = useState([]);

  // Cropper & Review
  const [isCropping, setIsCropping] = useState(false); const [currentImageSrc, setCurrentImageSrc] = useState(null); const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [reviewOrder, setReviewOrder] = useState(null); const [ratingValue, setRatingValue] = useState(5); const [reviewText, setReviewText] = useState("");

  const [phone, setPhone] = useState(""); const [rekening, setRekening] = useState(""); const [alamatLahan, setAlamatLahan] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    onSnapshot(doc(db, "users", user.uid), (docSnap) => { if (docSnap.exists()) { const data = docSnap.data(); setUserProfile(data); setPhone(data.phone || ""); setRekening(data.rekening_bank || ""); setAlamatLahan(data.alamat_lahan || ""); if (data.lokasi) setPinLocation(data.lokasi); }});
    onSnapshot(query(collection(db, "orders"), where("buyerId", "==", user.uid)), (snap) => setBuyerOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt)));
    onSnapshot(query(collection(db, "orders"), where("farmerId", "==", user.uid)), (snap) => setSellerOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt)));
    onSnapshot(query(collection(db, "products"), where("farmerId", "==", user.uid)), (snap) => setMyProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [user]);

  const handleAjukanVerifikasi = async () => { if (!phone || !rekening || !alamatLahan) return toast.error("Lengkapi data!"); await updateDoc(doc(db, "users", user.uid), { verificationStatus: "pending", updatedAt: serverTimestamp() }); toast.success("Pengajuan dikirim ke Admin!"); };
  const handleSaveProfile = async (e) => { e.preventDefault(); await updateDoc(doc(db, "users", user.uid), { phone, rekening_bank: rekening, alamat_lahan: alamatLahan, lokasi: pinLocation }); toast.success("Profil disimpan!"); };

  const handleBayarEscrow = async (order) => {
    // Jika link invoice sudah pernah dibuat sebelumnya, langsung buka tanpa membuat baru
    if (order.xenditInvoiceUrl) {
      window.location.href = order.xenditInvoiceUrl;
      return;
    }

    const toastId = toast.loading("Membuat Invoice Pembayaran Xendit...");
    try {
      // Menggunakan URL resmi Cloud Functions 2nd Gen milik Anda
      const functionUrl = "https://createxenditinvoice-3y6f5g6cma-uc.a.run.app";

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          buyerEmail: user?.email || "pembeli@tanibiocarbon.com",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan pada server");
      }

      if (data.invoiceUrl) {
        toast.success("Mengarahkan ke halaman pembayaran...", { id: toastId });
        // Arahkan peramban pengguna ke halaman checkout resmi Xendit!
        window.location.href = data.invoiceUrl;
      } else {
        throw new Error("URL Invoice tidak ditemukan");
      }
    } catch (error) {
      console.error("Payment Gateway Error:", error);
      toast.error(error.message || "Gagal membuat pembayaran. Coba lagi.", { id: toastId });
    }
  };
  const handleTerimaKargo = async (order) => { if (!window.confirm("Kargo sudah tiba di pabrik?")) return; await updateDoc(doc(db, "orders", order.id), { status: "CARGO_DELIVERED" }); toast.success("Kargo Diterima!"); };
  const handleKirimUlasan = async (e) => { e.preventDefault(); await updateDoc(doc(db, "orders", reviewOrder.id), { rating: ratingValue, reviewText }); toast.success("Ulasan disimpan!"); setReviewOrder(null); };

  const handleKirimTruk = async (orderId) => { const nopol = prompt("Nomor Polisi Truk:"); const supir = prompt("Nama Supir:"); if (!nopol || !supir) return toast.error("Wajib diisi!"); await updateDoc(doc(db, "orders", orderId), { status: "SHIPPED", no_polisi: nopol.toUpperCase(), nama_supir: supir }); toast.success("Truk diberangkatkan!"); };

  const handleFileSelect = (e) => { const reader = new FileReader(); reader.addEventListener("load", () => { setCurrentImageSrc(reader.result); setIsCropping(true); setZoom(1); setCrop({ x: 0, y: 0 }); }); reader.readAsDataURL(e.target.files[0]); e.target.value = null; };
  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);
  const handleSaveCrop = async () => { const webpData = await getCroppedImgWebP(currentImageSrc, croppedAreaPixels); setCroppedImages((p) => [...p, webpData]); setIsCropping(false); setCurrentImageSrc(null); };
  
  const handleUploadKomoditas = async (e) => {
    e.preventDefault(); if (userProfile?.verificationStatus !== "verified") return toast.error("Akun belum diverifikasi!"); if (croppedImages.length === 0) return toast.error("Pilih foto!");
    setLoading(true); const tId = toast.loading("Mengupload...");
    try {
      const urls = await Promise.all(croppedImages.map(async (item, i) => { const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_${i}.webp`); await uploadBytes(fileRef, item.file); return await getDownloadURL(fileRef); }));
      await addDoc(collection(db, "products"), { farmerId: user.uid, farmerName: user.displayName, farmerPhone: phone, sellerRole: "Mitra Industri (Olahan)", nama_komoditas: namaKomoditas, kategori, berat_ton: Number(beratTon), harga_per_ton: Number(hargaPerTon), kadar_air: kadarAir, kadar_karbon: kadarKarbon, deskripsi, fotoUrls: urls, status: "tersedia", lokasi: { alamat_text: alamatText, lat: pinLocation.lat, lng: pinLocation.lng }, createdAt: serverTimestamp() });
      toast.success("Berhasil diupload!", { id: tId }); setNamaKomoditas(""); setCroppedImages([]); setActiveTab("etalase");
    } catch (err) { toast.error("Gagal.", { id: tId }); } finally { setLoading(false); }
  };
  const handleToggleStatus = async (id, stat) => { await updateDoc(doc(db, "products", id), { status: stat === "tersedia" ? "terjual" : "tersedia" }); };
  const handleDeleteProduct = async (id) => { if (window.confirm("Hapus dagangan?")) await deleteDoc(doc(db, "products", id)); };

  const isVerified = userProfile?.verificationStatus === "verified";

  const TabButton = ({ id, icon: Icon, label, count }) => (
    <button onClick={() => setActiveTab(id)} className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-semibold text-sm transition-colors whitespace-nowrap ${activeTab === id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
      <Icon className="w-4 h-4" /> {label} {count !== undefined && <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{count}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* SECONDARY NAVIGATION */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            <TabButton id="belanja" icon={ArrowDownToLine} label="Belanjaan Saya" count={buyerOrders.length} />
            <TabButton id="pesanan_masuk" icon={ArrowUpFromLine} label="Pesanan Masuk" count={sellerOrders.length} />
            <TabButton id="etalase" icon={Layers} label="Etalase Pabrik" count={myProducts.length} />
            <TabButton id="upload" icon={PlusCircle} label="Jual Olahan" />
            <TabButton id="profil" icon={Settings} label="Profil Pabrik" />
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 mt-4">
        {!isVerified && (
          <div className="mb-8 bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3"><div className="bg-amber-100 p-2 rounded-xl"><AlertTriangle className="w-5 h-5 text-amber-600" /></div><div><h4 className="font-bold text-slate-900">Pabrik Belum Terverifikasi</h4><p className="text-sm text-slate-600">Lengkapi profil dan ajukan verifikasi agar dapat berjualan di Marketplace.</p></div></div>
            <button onClick={() => setActiveTab("profil")} className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm">Buka Profil</button>
          </div>
        )}

        {/* TAB 1: BELANJAAN (BUYER) */}
        {activeTab === "belanja" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pengadaan Bahan Mentah</h2>
            {buyerOrders.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-3xl"><ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-bold text-slate-900">Belum ada pembelian</h3></div>
            ) : (
              <div className="space-y-5">
                {buyerOrders.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between border-b border-slate-100 pb-4">
                      <div><span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">TRX: {item.id.slice(0,8)}</span><h3 className="text-xl font-black text-slate-900 mt-2">{item.productName} ({item.totalTon} Ton)</h3><p className="text-sm text-slate-600">Pemasok: <span className="font-semibold text-slate-900">{item.farmerName}</span></p></div>
                      <div className="text-left md:text-right mt-3 md:mt-0"><p className="text-[10px] text-slate-400 font-bold uppercase">Total Nilai</p><p className="text-xl font-black text-green-600">Rp {item.totalPrice?.toLocaleString()}</p></div>
                    </div>
                    
                    <OrderTimelineTracker status={item.status} />

                    {item.status === "SHIPPED" && (
                      <div className="bg-slate-900 text-white p-4 mt-2 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3"><Truck className="w-5 h-5 text-blue-400"/><div><p className="text-sm font-bold text-blue-400">Truk Dalam Perjalanan!</p><p className="text-xs text-slate-300">Nopol: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-white">{item.no_polisi}</span></p></div></div>
                        <button onClick={()=>handleTerimaKargo(item)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold w-full sm:w-auto transition-colors">Konfirmasi Kargo Tiba</button>
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-2">
                      <a href={formatWhatsAppLink(item.farmerPhone, "Halo")} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition-colors"><MessageCircle className="w-4 h-4"/> Chat Pemasok</a>
                      <div className="flex gap-2">
                        {item.status === "WAITING_PAYMENT_SIMULATION" && <button onClick={()=>handleBayarEscrow(item)} className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-colors">Bayar Escrow</button>}
                        {item.status === "ESCROW_RELEASED" && !item.rating && <button onClick={()=>setReviewOrder(item)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400 fill-amber-400"/> Beri Penilaian</button>}
                        {item.rating && <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-amber-500"/> {item.rating} Bintang</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PESANAN MASUK (SELLER) */}
        {activeTab === "pesanan_masuk" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Pesanan Olahan Masuk</h2>
            {sellerOrders.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed border-slate-300 rounded-3xl"><Factory className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-bold text-slate-900">Belum ada pesanan</h3></div>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1"><span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">TRX: {item.id.slice(0,8)}</span><h3 className="text-xl font-black text-slate-900 mt-2">{item.productName} ({item.totalTon} Ton)</h3><p className="text-sm text-slate-600">Pembeli: <span className="font-semibold text-slate-900">{item.buyerName}</span></p></div>
                    <div className="w-full md:w-64 flex flex-col justify-between items-start md:items-end">
                      <div className="text-left md:text-right mb-4 md:mb-0"><p className="text-[10px] text-slate-400 font-bold uppercase">Pendapatan</p><p className="text-xl font-black text-green-600">Rp {item.totalPrice?.toLocaleString()}</p></div>
                      <div className="w-full text-right">
                        {item.status === "PAID_ESCROW" && <button onClick={()=>handleKirimTruk(item.id)} className="w-full md:w-auto bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg"><Truck className="w-4 h-4 inline mr-1"/> Input Nopol Truk</button>}
                        {item.status === "SHIPPED" && <span className="inline-flex text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-200"><Truck className="w-4 h-4 mr-1"/> Mengantar Kargo</span>}
                        {item.status === "WAITING_PAYMENT_SIMULATION" && <span className="inline-flex text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">⏳ Menunggu Pembayaran</span>}
                        {(item.status === "CARGO_DELIVERED" || item.status === "ESCROW_RELEASED") && <span className="inline-flex text-xs font-bold text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-200"><Check className="w-4 h-4 mr-1"/> Selesai</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ETALASE PABRIK */}
        {activeTab === "etalase" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Etalase Olahan Pabrik</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myProducts.map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden"><img src={item.fotoUrls[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/><div className="absolute top-3 left-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-800 uppercase">{item.status}</div></div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-slate-900 mb-4 line-clamp-1">{item.nama_komoditas}</h3>
                    <div className="mt-auto space-y-3">
                      <div className="flex justify-between items-end"><div className="text-xs text-slate-500 font-medium">Stok<p className="text-slate-900 font-bold text-base">{item.berat_ton} Ton</p></div><div className="text-xs text-slate-500 font-medium text-right">Harga / Ton<p className="text-green-600 font-black text-base">Rp {item.harga_per_ton?.toLocaleString()}</p></div></div>
                      <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100"><button onClick={()=>handleToggleStatus(item.id, item.status)} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 py-2 rounded-xl text-xs font-bold transition-colors border border-slate-200">{item.status === "tersedia" ? "Tandai Terjual" : "Tandai Tersedia"}</button><button onClick={()=>handleDeleteProduct(item.id)} className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5"/> Hapus</button></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: UPLOAD */}
        {activeTab === "upload" && (
          <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            {!isVerified ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5"><Lock className="w-8 h-8 text-slate-400" /></div><h3 className="text-xl font-black text-slate-900 mb-2">Akses Terkunci</h3><p className="text-slate-500 mb-8">Admin perlu memverifikasi rekening pabrik Anda terlebih dahulu.</p><button onClick={() => setActiveTab("profil")} className="bg-slate-900 text-white font-bold py-3 px-8 rounded-xl shadow-lg">Lengkapi Profil</button></div>
            ) : (
              <form onSubmit={handleUploadKomoditas} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div><h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Jual Produk Olahan</h2></div>
                <div className="space-y-4">
                  <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Nama Produk</label><input type="text" placeholder="Misal: Biochar Grade A" value={namaKomoditas} onChange={e=>setNamaKomoditas(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:bg-white outline-none transition-all" required/></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Kategori</label><select value={kategori} onChange={e=>setKategori(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none"><option value="Biochar / Arang">Biochar / Arang</option><option value="Karbon Aktif">Karbon Aktif</option><option value="Wood Pellet">Wood Pellet</option></select></div>
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Stok (Ton)</label><input type="number" step="0.1" value={beratTon} onChange={e=>setBeratTon(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:bg-white outline-none" required/></div>
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Harga/Ton (Rp)</label><input type="number" value={hargaPerTon} onChange={e=>setHargaPerTon(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:bg-white outline-none" required/></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5"><FlaskConical className="w-4 h-4 text-amber-500"/> Kadar Air (%)</label><input type="text" placeholder="< 12%" value={kadarAir} onChange={e=>setKadarAir(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:bg-white outline-none"/></div>
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5"><FlaskConical className="w-4 h-4 text-purple-500"/> Kadar Karbon (%)</label><input type="text" placeholder="> 75%" value={kadarKarbon} onChange={e=>setKadarKarbon(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 focus:bg-white outline-none"/></div>
                  </div>
                  <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
                    <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-blue-500"/> Foto Produk</label>
                    <label className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-semibold px-5 py-3 rounded-xl cursor-pointer shadow-sm w-full md:w-auto"><UploadCloud className="w-4 h-4"/> Pilih Foto<input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" /></label>
                    {croppedImages.length > 0 && (<div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-3">{croppedImages.map((img, index) => (<div key={index} className="relative aspect-[4/3] rounded-xl overflow-hidden border"><img src={img.previewUrl} className="w-full h-full object-cover" /><button type="button" onClick={() => setCroppedImages(p => p.filter((_, i) => i !== index))} className="absolute top-1.5 right-1.5 bg-white/90 p-1.5 rounded-full"><X className="w-3 h-3"/></button></div>))}</div>)}
                  </div>
                  <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Deskripsi</label><textarea rows="3" value={deskripsi} onChange={e=>setDeskripsi(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none"></textarea></div>
                  <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""} libraries={["places", "geocoding"]}>
                    <LocationPickerWithReverseGeocode pinLocation={pinLocation} setPinLocation={setPinLocation} alamatText={alamatText} setAlamatText={setAlamatText} />
                  </APIProvider>
                  <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50">Publikasikan Dagangan</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 5: PROFIL */}
        {activeTab === "profil" && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                <div><h2 className="text-2xl font-extrabold text-slate-900">Profil & Rekening</h2></div>
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${isVerified ? "bg-green-50 text-green-700 border border-green-200" : userProfile?.verificationStatus === "pending" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                  {isVerified ? <><Check className="w-4 h-4"/> Terverifikasi</> : userProfile?.verificationStatus === "pending" ? "Menunggu Verifikasi" : "Belum Verifikasi"}
                </div>
              </div>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">No. Telepon Pabrik</label><input type="text" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"/></div>
                <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Alamat Gudang</label><input type="text" value={alamatLahan} onChange={e=>setAlamatLahan(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"/></div>
                <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Rekening Perusahaan</label><input type="text" value={rekening} onChange={e=>setRekening(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"/></div>
                <div className="pt-4 flex gap-4">
                  <button type="submit" className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-bold py-3.5 rounded-xl shadow-sm">Simpan</button>
                  {!isVerified && userProfile?.verificationStatus !== "pending" && (
                    <button type="button" onClick={handleAjukanVerifikasi} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg">Ajukan Verifikasi</button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* RATING MODAL */}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h3 className="text-xl font-black text-slate-900 mb-1">Nilai Kargo</h3>
            <p className="text-sm text-slate-500 mb-6">Bagaimana kualitas pesanan {reviewOrder.productName}?</p>
            <form onSubmit={handleKirimUlasan} className="space-y-6">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button type="button" key={star} onClick={() => setRatingValue(star)} className="p-1 focus:outline-none hover:scale-110 transition-transform">
                    <Star className={`w-10 h-10 ${star <= ratingValue ? "text-amber-400 fill-amber-400" : "text-slate-200"}`} />
                  </button>
                ))}
              </div>
              <textarea rows="3" placeholder="Tuliskan ulasan..." value={reviewText} onChange={e=>setReviewText(e.target.value)} className="w-full p-4 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none"></textarea>
              <div className="flex gap-3">
                <button type="button" onClick={() => setReviewOrder(null)} className="w-full py-3.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Batal</button>
                <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition-colors">Kirim Ulasan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CROPPER MODAL */}
      {isCropping && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-sm p-4 sm:p-8 flex flex-col animate-in fade-in">
          <div className="flex justify-between items-center text-white mb-6">
            <h3 className="font-bold text-lg">Sesuaikan Bingkai Foto (4:3)</h3>
            <button onClick={() => { setIsCropping(false); setCurrentImageSrc(null); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition"><X className="w-6 h-6" /></button>
          </div>
          <div className="relative flex-1 w-full max-w-4xl mx-auto rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-black">
            <Cropper image={currentImageSrc} crop={crop} zoom={zoom} aspect={4/3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom}/>
          </div>
          <div className="max-w-4xl mx-auto w-full mt-6 bg-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto"><ZoomIn className="w-5 h-5 text-slate-400" /><input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full sm:w-48" /></div>
            <button onClick={handleSaveCrop} className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all">Potong & Simpan</button>
          </div>
        </div>
      )}
    </div>
  );
}