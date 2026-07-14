import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/config/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { Factory, ShoppingBag, CheckCircle2, Clock, Truck, ShieldCheck, LogOut, ArrowRight, AlertCircle, PlusCircle, Layers, User, MapPin, Trash2, Phone, CreditCard, Image as ImageIcon, Check, X, ZoomIn, Sprout, Lock, AlertTriangle } from "lucide-react";
import Cropper from "react-easy-crop";

// =========================================================================
// 1. HELPER: KANVAS POTONG & KONVERSI WEBP (KOMPRESI GAMBAR)
// =========================================================================
const getCroppedImgWebP = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas kosong"));
        resolve({ file: new File([blob], `mitra_${Date.now()}.webp`, { type: "image/webp" }), previewUrl: URL.createObjectURL(blob) });
      }, "image/webp", 0.8);
    };
    image.onerror = (error) => reject(error);
  });
};

// =========================================================================
// 2. KOMPONEN MAPS DENGAN AUTOCOMPLETE & REVERSE GEOCODING (KLIK PETA -> ALAMAT TEKS)
// =========================================================================
function LocationPickerWithReverseGeocode({ pinLocation, setPinLocation, alamatText, setAlamatText }) {
  const [placeAutocomplete, setPlaceAutocomplete] = useState(null);
  const inputRef = useRef(null);
  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");
  const [geocoder, setGeocoder] = useState(null);
  const map = useMap();

  // Inisialisasi Autocomplete & Geocoder
  useEffect(() => {
    if (places && inputRef.current) {
      setPlaceAutocomplete(new places.Autocomplete(inputRef.current, { fields: ["geometry", "name", "formatted_address"], componentRestrictions: { country: "id" } }));
    }
    if (geocoding) setGeocoder(new geocoding.Geocoder());
  }, [places, geocoding]);

  // Listener Autocomplete
  useEffect(() => {
    if (!placeAutocomplete) return;
    placeAutocomplete.addListener("place_changed", () => {
      const place = placeAutocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();
        setPinLocation({ lat: newLat, lng: newLng });
        setAlamatText(place.formatted_address || place.name);
        if (map) { map.panTo({ lat: newLat, lng: newLng }); map.setZoom(16); }
      }
    });
  }, [placeAutocomplete, setPinLocation, setAlamatText, map]);

  // FUNGSI REVERSE GEOCODING: Klik Peta -> Terjemahkan ke Alamat Teks Otomatis!
  const handleMapClick = (ev) => {
    if (!ev.detail.latLng) return;
    const newLat = ev.detail.latLng.lat;
    const newLng = ev.detail.latLng.lng;
    setPinLocation({ lat: newLat, lng: newLng });

    if (geocoder) {
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          setAlamatText(results[0].formatted_address); // Update otomatis box input alamat pabrik!
        } else {
          console.warn("Alamat detail tidak ditemukan di titik koordinat ini.");
        }
      });
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-slate-50 border-slate-300">
      <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-red-600" /> Titik Penjemputan / Gudang Pabrik Mitra (Cari atau Klik Peta) *
      </label>
      <p className="text-xs text-slate-500 mb-3">
        Ketik alamat pabrik ATAU <span className="font-bold text-blue-700">klik langsung pada peta</span>. Alamat teks akan diperbarui secara otomatis!
      </p>

      <input
        ref={inputRef}
        type="text"
        required
        placeholder="🔍 Ketik atau klik peta untuk mengisi alamat pabrik otomatis..."
        value={alamatText}
        onChange={(e) => setAlamatText(e.target.value)}
        className="w-full p-3 border border-slate-300 rounded-xl text-sm mb-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium shadow-sm"
      />

      <div className="w-full h-72 rounded-xl overflow-hidden border border-slate-300 shadow-inner relative">
        <Map defaultCenter={pinLocation} defaultZoom={13} onClick={handleMapClick}>
          <Marker position={pinLocation} />
        </Map>
      </div>
      
      <div className="flex justify-between items-center mt-2">
        <span className="text-[11px] text-blue-700 font-semibold">✨ Fitur Aktif: Klik titik mana saja di peta, alamat di atas langsung berubah!</span>
        <p className="text-xs text-slate-400 font-mono">Lat: {pinLocation.lat.toFixed(5)}, Lng: {pinLocation.lng.toFixed(5)}</p>
      </div>
    </div>
  );
}

// =========================================================================
// 3. KOMPONEN UTAMA PORTAL MITRA INDUSTRI
// =========================================================================
export default function MitraPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("pesanan");
  const [loadingId, setLoadingId] = useState(null);
  const [loading, setLoading] = useState(false);

  // REAL-TIME USER PROFILE (Untuk memantau status verifikasi akun)
  const [userProfile, setUserProfile] = useState(null);

  // State Data
  const [orders, setOrders] = useState([]);
  const [myProducts, setMyProducts] = useState([]);

  // State Form Upload Dagangan Mitra
  const [namaKomoditas, setNamaKomoditas] = useState("");
  const [kategori, setKategori] = useState("Biochar / Arang");
  const [beratTon, setBeratTon] = useState("");
  const [hargaPerTon, setHargaPerTon] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [alamatText, setAlamatText] = useState("");
  const [pinLocation, setPinLocation] = useState({ lat: -6.200000, lng: 106.816666 });
  const [croppedImages, setCroppedImages] = useState([]);

  // State Cropper Modal
  const [isCropping, setIsCropping] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // State Profil Mitra
  const [phone, setPhone] = useState("");
  const [rekening, setRekening] = useState("");
  const [alamatLahan, setAlamatLahan] = useState("");

  // --- READ 1: Ambil Profil Pengguna Real-time (Status Verifikasi) ---
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data);
        setPhone(data.phone || "");
        setRekening(data.rekening_bank || "");
        setAlamatLahan(data.alamat_lahan || "");
      }
    });
    return () => unsub();
  }, [user]);

  // --- READ 2: Ambil Pesanan Belanja Mitra ---
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "orders"), where("buyerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOrders(items);
    });
    return () => unsubscribe();
  }, [user]);

  // --- READ 3: Ambil Dagangan Olahan Mitra ---
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "products"), where("farmerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMyProducts(items);
    });
    return () => unsubscribe();
  }, [user]);

  // --- AKSI: AJUKAN VERIFIKASI KE ADMIN ---
  const handleAjukanVerifikasi = async () => {
    if (!phone || !rekening || !alamatLahan) {
      alert("⚠️ Harap lengkapi Nomor Telepon Pabrik, Domisili, dan Rekening Bank terlebih dahulu!");
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        verificationStatus: "pending",
        updatedAt: serverTimestamp()
      });
      alert("🎉 Pengajuan verifikasi pabrik berhasil dikirim ke Admin!");
    } catch (error) { alert("Gagal mengajukan verifikasi."); }
    finally { setLoading(false); }
  };

  // --- FITUR BUYER ---
  const handleSimulasiBayarEscrow = async (order) => {
    setLoadingId(order.id);
    try {
      await updateDoc(doc(db, "orders", order.id), { status: "PAID_ESCROW", paidAt: new Date() });
      alert("🎉 Pembayaran Berhasil! Dana Anda diamankan di Escrow.");
    } catch (error) { alert("Gagal memproses pembayaran."); } 
    finally { setLoadingId(null); }
  };

  const handleKonfirmasiTerimaKargo = async (order) => {
    if (!window.confirm("Apakah kargo sudah sampai di pabrik?\n\nDengan ini Anda mengizinkan Admin mencairkan dana ke Petani.")) return;
    setLoadingId(order.id);
    try {
      await updateDoc(doc(db, "orders", order.id), { status: "CARGO_DELIVERED", deliveredAt: new Date() });
      alert("✅ Konfirmasi berhasil! Notifikasi dikirim ke Admin.");
    } catch (error) { alert("Gagal mengupdate status."); } 
    finally { setLoadingId(null); }
  };

  // --- LOGIKA CROPPER WEBP ---
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener("load", () => { setCurrentImageSrc(reader.result); setIsCropping(true); setZoom(1); setCrop({ x: 0, y: 0 }); });
      reader.readAsDataURL(e.target.files[0]);
    }
    e.target.value = null;
  };
  const onCropComplete = useCallback((_, croppedAreaPixels) => { setCroppedAreaPixels(croppedAreaPixels); }, []);
  const handleSaveCrop = async () => {
    try {
      const webpData = await getCroppedImgWebP(currentImageSrc, croppedAreaPixels);
      setCroppedImages((prev) => [...prev, webpData]);
      setIsCropping(false); setCurrentImageSrc(null);
    } catch (e) { alert("Gagal memproses gambar."); }
  };
  const removeImage = (indexToRemove) => { setCroppedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove)); };

  // --- FITUR SELLER: Upload Dagangan ke Marketplace (Hanya Bisa Jika Verified!) ---
  const handleUploadKomoditas = async (e) => {
    e.preventDefault();
    if (userProfile?.verificationStatus !== "verified") return alert("⚠️ Akun pabrik Anda belum diverifikasi oleh Admin!");
    if (croppedImages.length === 0) return alert("Harap upload & potong minimal 1 foto produk!");
    if (!beratTon || !hargaPerTon || !namaKomoditas || !alamatText) return alert("Harap lengkapi data wajib!");

    setLoading(true);
    try {
      const uploadPromises = croppedImages.map(async (item, index) => {
        const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_mitra_${index}.webp`);
        await uploadBytes(fileRef, item.file);
        return await getDownloadURL(fileRef);
      });
      const fotoUrls = await Promise.all(uploadPromises);

      await addDoc(collection(db, "products"), {
        farmerId: user.uid,
        farmerName: user.displayName || "Mitra Industri",
        farmerPhone: phone || "Belum dicantumkan",
        sellerRole: "Mitra Industri (Pemasok Olahan)",
        nama_komoditas: namaKomoditas,
        kategori: kategori,
        berat_ton: Number(beratTon),
        harga_per_ton: Number(hargaPerTon),
        deskripsi: deskripsi,
        fotoUrls: fotoUrls,
        status: "tersedia",
        lokasi: { alamat_text: alamatText, lat: pinLocation.lat, lng: pinLocation.lng },
        createdAt: serverTimestamp(),
      });

      alert("🎉 Produk olahan berhasil di-upload ke Marketplace!");
      setNamaKomoditas(""); setBeratTon(""); setHargaPerTon(""); setDeskripsi(""); setAlamatText(""); setCroppedImages([]); setActiveTab("etalase");
    } catch (error) { alert("Gagal mengupload produk."); } 
    finally { setLoading(false); }
  };

  const handleDeleteProduct = async (id) => { if (window.confirm("Yakin ingin menghapus dagangan ini?")) await deleteDoc(doc(db, "products", id)); };
  const handleToggleStatus = async (id, currentStatus) => { await updateDoc(doc(db, "products", id), { status: currentStatus === "tersedia" ? "terjual" : "tersedia" }); };
  const handleSaveProfile = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { phone, rekening_bank: rekening, alamat_lahan: alamatLahan });
      alert("🎉 Profil berhasil diperbarui!");
    } catch (error) { alert("Gagal memperbarui profil."); } 
    finally { setLoading(false); }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "WAITING_PAYMENT_SIMULATION": return { label: "Menunggu Bayar", color: "bg-amber-100 text-amber-800", icon: Clock };
      case "PAID_ESCROW": return { label: "Dana Ditahan Escrow", color: "bg-blue-100 text-blue-800", icon: ShieldCheck };
      case "CARGO_DELIVERED": return { label: "Kargo Diterima", color: "bg-purple-100 text-purple-800", icon: Truck };
      case "ESCROW_RELEASED": return { label: "Selesai (Cair)", color: "bg-green-100 text-green-800", icon: CheckCircle2 };
      default: return { label: status, color: "bg-slate-100 text-slate-800", icon: AlertCircle };
    }
  };

  const statusVerifikasi = userProfile?.verificationStatus || "unverified";
  const isVerified = statusVerifikasi === "verified";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER NAVBAR */}
      <header className="bg-blue-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <Factory className="w-6 h-6 text-blue-300" />
          <span className="font-black text-lg tracking-wide">TaniBioCarbon <span className="text-blue-300 font-normal">| Portal Mitra Industri</span></span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/marketplace" className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow">
            + Beli Pasokan <ArrowRight className="w-3.5 h-3.5" />
          </a>
          <button onClick={logout} className="p-2 bg-blue-950 hover:bg-slate-900 rounded-lg text-sm flex items-center gap-1 transition text-red-300 font-bold">
            <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* 4 TAB NAVIGATION */}
      <div className="bg-white border-b px-6 flex gap-6 shadow-sm overflow-x-auto">
        <button onClick={() => setActiveTab("pesanan")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition ${activeTab === "pesanan" ? "border-blue-600 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <ShoppingBag className="w-4 h-4" /> Belanjaan Saya ({orders.length})
        </button>
        <button onClick={() => setActiveTab("etalase")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition ${activeTab === "etalase" ? "border-blue-600 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <Layers className="w-4 h-4" /> Etalase Dagangan Saya ({myProducts.length})
        </button>
        <button onClick={() => setActiveTab("upload")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition relative ${activeTab === "upload" ? "border-blue-600 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <PlusCircle className="w-4 h-4" /> + Jual Produk Olahan Baru
          {!isVerified && <Lock className="w-3.5 h-3.5 text-amber-500 inline ml-1" />}
        </button>
        <button onClick={() => setActiveTab("profil")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition ${activeTab === "profil" ? "border-blue-600 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <User className="w-4 h-4" /> Profil & Verifikasi Pabrik
        </button>
      </div>

      {/* KONTEN UTAMA */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        
        {/* BANNER PERINGATAN JIKA BELUM VERIFIKASI */}
        {!isVerified && (
          <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Pabrik Anda Belum Dapat Berjualan (Status: {statusVerifikasi.toUpperCase()})</h4>
                <p className="text-xs text-slate-600">Lengkapi data rekening bank di tab Profil lalu tekan tombol ajukan verifikasi agar dibukakan izin oleh Admin.</p>
              </div>
            </div>
            <button onClick={() => setActiveTab("profil")} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-xs shrink-0 transition shadow">
              Buka Tab Profil & Verifikasi
            </button>
          </div>
        )}

        {/* =========================================================================
            TAB 1: RIWAYAT BELANJA
           ========================================================================= */}
        {activeTab === "pesanan" && (
          <div>
            <div className="mb-6"><h2 className="text-2xl font-black text-slate-800">Riwayat Pengadaan Bahan Mentah</h2><p className="text-sm text-slate-500">Pantau pasokan yang Anda beli dari Petani dan kelola pencairan dana Escrow.</p></div>
            {orders.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-600 font-medium">Belum ada pesanan bahan mentah aktif.</p>
                <a href="/marketplace" className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow transition inline-block">Buka Marketplace Sekarang</a>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((item) => {
                  const badge = getStatusBadge(item.status); const BadgeIcon = badge.icon; const isProcessing = loadingId === item.id;
                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2"><span className="font-mono text-xs text-slate-400 font-bold">ID: {item.id.slice(0, 8)}...</span><span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${badge.color}`}><BadgeIcon className="w-3.5 h-3.5" /> {badge.label}</span></div>
                        <h3 className="text-lg font-black text-slate-900">{item.productName}</h3><p className="text-xs text-slate-500">Pemasok: <span className="font-bold text-slate-700">{item.farmerName}</span> | Volume: <span className="font-bold text-slate-800">{item.totalTon} Ton</span></p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                        <div className="text-left md:text-right"><p className="text-[11px] text-slate-400 font-bold uppercase">Total Nilai Kargo</p><p className="text-lg font-black text-blue-700">Rp {item.totalPrice?.toLocaleString("id-ID")}</p></div>
                        <div className="w-full sm:w-auto flex flex-col gap-2">
                          {item.status === "WAITING_PAYMENT_SIMULATION" && <button disabled={isProcessing} onClick={() => handleSimulasiBayarEscrow(item)} className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow transition disabled:bg-slate-300">{isProcessing ? "Memproses..." : "Bayar ke Escrow (Simulasi)"}</button>}
                          {item.status === "PAID_ESCROW" && <button disabled={isProcessing} onClick={() => handleKonfirmasiTerimaKargo(item)} className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-4 py-2.5 rounded-xl text-xs shadow transition disabled:bg-slate-300 flex items-center gap-1.5"><Truck className="w-4 h-4" /> Konfirmasi Terima Kargo</button>}
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
            TAB 2: ETALASE DAGANGAN SAYA
           ========================================================================= */}
        {activeTab === "etalase" && (
          <div>
            <div className="mb-6"><h2 className="text-2xl font-black text-slate-800">Daftar Produk Olahan Pabrik Anda</h2><p className="text-sm text-slate-500">Produk yang Anda upload di sini akan tampil di Marketplace untuk dibeli oleh Company atau pembeli besar.</p></div>
            {myProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
                <Factory className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-600 font-medium">Anda belum mengupload produk olahan untuk dijual.</p>
                {isVerified && <button onClick={() => setActiveTab("upload")} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition">+ Jual Dagangan Pertama</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myProducts.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="bg-slate-100 p-2 grid grid-cols-2 gap-1 h-48 overflow-y-auto">
                        {item.fotoUrls && item.fotoUrls.map((url, index) => (<img key={index} src={url} alt={`Foto ${index + 1}`} className={`w-full h-full object-cover rounded ${item.fotoUrls.length === 1 ? "col-span-2 h-44" : "h-22"}`} />))}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2"><span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{item.kategori}</span><span className={`text-xs font-bold px-2 py-1 rounded capitalize ${item.status === "tersedia" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"}`}>{item.status}</span></div>
                        <h3 className="font-bold text-lg text-slate-900 mb-1">{item.nama_komoditas}</h3><p className="text-xs text-slate-500 mb-4 line-clamp-2">{item.deskripsi || "Tidak ada deskripsi detail."}</p>
                        <div className="space-y-1 text-sm border-t pt-3">
                          <div className="flex justify-between"><span className="text-slate-500">Stok Siap Jual:</span> <span className="font-bold text-slate-800">{item.berat_ton} Ton</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Harga / Ton:</span> <span className="font-bold text-blue-700">Rp {item.harga_per_ton.toLocaleString("id-ID")}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Total Estimasi:</span> <span className="font-black text-slate-900">Rp {(item.berat_ton * item.harga_per_ton).toLocaleString("id-ID")}</span></div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 pt-2"><MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" /> <span className="truncate">{item.lokasi?.alamat_text}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-3 border-t flex gap-2">
                      <button onClick={() => handleToggleStatus(item.id, item.status)} className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-1.5 px-3 rounded text-xs transition">{item.status === "tersedia" ? "Tandai Terjual" : "Set Tersedia"}</button>
                      <button onClick={() => handleDeleteProduct(item.id)} className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded border border-red-200 transition" title="Hapus Barang"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: FORM UPLOAD (GATEKEEPER LOCKED JIKA BELUM VERIFIED)
           ========================================================================= */}
        {activeTab === "upload" && (
          <div>
            {!isVerified ? (
              <div className="bg-white border-2 border-amber-300 rounded-3xl p-8 max-w-2xl mx-auto text-center shadow-lg my-10">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8" /></div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Form Jual Produk Terkunci Sementara</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Untuk menjaga standar kualitas di Marketplace TaniBioCarbon, hanya Mitra Industri yang rekening bank dan pabriknya telah <span className="font-bold text-blue-700">Diverifikasi oleh Admin</span> yang dapat menjual produk olahan.
                </p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-left mb-6 space-y-1 font-medium text-slate-700">
                  <p>1. Buka Tab <span className="font-bold">"Profil & Verifikasi Pabrik"</span>.</p>
                  <p>2. Lengkapi Nomor Telepon Pabrik, Domisili, dan Rekening Bank.</p>
                  <p>3. Tekan tombol <span className="font-bold text-blue-700">"📢 Ajukan Verifikasi ke Admin"</span>.</p>
                </div>
                <button onClick={() => setActiveTab("profil")} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl shadow transition">Lengkapi Profil & Ajukan Sekarang</button>
              </div>
            ) : (
              /* FORM TERBUKA JIKA VERIFIED */
              <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Upload Dagangan Produk Olahan Baru</h2>
                <p className="text-sm text-slate-500 mb-6">Jual hasil olahan biomassa pabrik Anda ke Marketplace. Sistem kompresi ke <span className="font-bold text-blue-600">.WebP</span> aktif.</p>

                <form onSubmit={handleUploadKomoditas} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nama Produk Olahan *</label>
                    <input type="text" required placeholder="Contoh: Biochar Grade A / Karbon Aktif / Briket Sekam / Wood Pellet" value={namaKomoditas} onChange={(e) => setNamaKomoditas(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Kategori Produk *</label>
                      <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="Biochar / Arang">Biochar / Arang</option>
                        <option value="Karbon Aktif">Karbon Aktif</option>
                        <option value="Briket Biomassa">Briket Biomassa</option>
                        <option value="Wood Pellet">Wood Pellet</option>
                        <option value="Limbah Pertanian">Limbah Pertanian (Mentah)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Stok Siap Jual (Ton) *</label>
                      <input type="number" step="0.1" required placeholder="0.0" value={beratTon} onChange={(e) => setBeratTon(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Harga per Ton (Rp) *</label>
                      <input type="number" required placeholder="2500000" value={hargaPerTon} onChange={(e) => setHargaPerTon(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>

                  {/* SECTION: CROPPER WEBP */}
                  <div className="p-5 border-2 border-dashed border-blue-400 rounded-xl bg-blue-50/40">
                    <label className="block text-sm font-bold text-blue-900 mb-1 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-blue-700" /> Upload & Potong Foto Produk (Format WebP) *</label>
                    <p className="text-xs text-slate-600 mb-4">Pilih foto satu per satu untuk menyesuaikan bingkainya (Rasio 4:3).</p>
                    <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm cursor-pointer shadow-sm transition"><PlusCircle className="w-4 h-4" /> Pilih & Potong Foto<input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" /></label>
                    {croppedImages.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <p className="text-xs font-bold text-blue-800 mb-2">Siap Diupload ({croppedImages.length} Foto):</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {croppedImages.map((img, index) => (
                            <div key={index} className="relative group rounded-lg overflow-hidden border border-slate-300 bg-white aspect-[4/3] shadow-sm">
                              <img src={img.previewUrl} alt="Crop preview" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-80 hover:opacity-100 transition shadow"><X className="w-3.5 h-3.5" /></button>
                              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">{(img.file.size / 1024).toFixed(0)} KB (WebP)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Deskripsi & Spesifikasi Teknis</label>
                    <textarea rows="3" placeholder="Jelaskan kadar karbon absolut, tingkat kelembapan, kapasitas kemasan, atau sertifikasi pabrik..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                  </div>

                  {/* GOOGLE MAPS DENGAN REVERSE GEOCODING (KLIK PETA LANGSUNG MENGISI ALAMAT!) */}
                  <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""} libraries={["places", "geocoding"]}>
                    <LocationPickerWithReverseGeocode
                      pinLocation={pinLocation}
                      setPinLocation={setPinLocation}
                      alamatText={alamatText}
                      setAlamatText={setAlamatText}
                    />
                  </APIProvider>

                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition disabled:bg-slate-300">
                    {loading ? "Mengupload Foto WebP & Menyimpan..." : "Simpan & Tampilkan Dagangan di Marketplace"}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: PROFIL & PENGAJUAN VERIFIKASI PABRIK
           ========================================================================= */}
        {activeTab === "profil" && (
          <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm max-w-xl mx-auto">
            
            {/* BOX STATUS VERIFIKASI */}
            <div className={`p-4 rounded-xl border mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
              isVerified ? "bg-green-50 border-green-300 text-green-900" :
              statusVerifikasi === "pending" ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-slate-100 border-slate-300 text-slate-800"
            }`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Status Verifikasi Akun Pabrik</p>
                <p className="text-base font-black flex items-center gap-1.5 mt-0.5">
                  {isVerified ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
                  {statusVerifikasi === "verified" ? "✔ TERVERIFIKASI (SIAP JUAL)" :
                   statusVerifikasi === "pending" ? "⏳ MENUNGGU VERIFIKASI ADMIN" :
                   statusVerifikasi === "rejected" ? "❌ DITOLAK ADMIN (PERBAIKI DATA)" : "⚪ BELUM MENGAJUKAN VERIFIKASI"}
                </p>
              </div>

              {!isVerified && statusVerifikasi !== "pending" && (
                <button
                  onClick={handleAjukanVerifikasi}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow transition shrink-0"
                >
                  📢 Ajukan Verifikasi ke Admin
                </button>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Pengaturan Profil & Rekening Perusahaan</h2>
            <p className="text-sm text-slate-500 mb-6">Data rekening bank ini penting agar Admin dapat menyetujui izin berjualan Anda dan mencairkan dana Escrow saat dagangan produk olahan Anda laku terjual.</p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><Phone className="w-4 h-4 text-blue-600" /> Nomor WhatsApp / Telepon Pabrik *</label>
                <input type="tel" placeholder="081234567890" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-blue-600" /> Domisili / Wilayah Kawasan Industri *</label>
                <input type="text" placeholder="Kawasan Industri Gresik, Jawa Timur" value={alamatLahan} onChange={(e) => setAlamatLahan(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-blue-600" /> Rekening Bank Perusahaan / Mitra *</label>
                <input type="text" placeholder="Mandiri - 1234567890 - a.n. PT Tani Bio Carbon Mitra" value={rekening} onChange={(e) => setRekening(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded-xl shadow transition mt-4">
                {loading ? "Menyimpan..." : "Simpan Pembaruan Profil"}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* MODAL OVERLAY: CROPPER WEBP */}
      {isCropping && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-between p-4 sm:p-6 animate-fadeIn">
          <div className="flex justify-between items-center text-white bg-slate-900/60 p-3 rounded-lg backdrop-blur-sm z-10">
            <div><h3 className="font-bold text-sm sm:text-base">Sesuaikan Bingkai Foto Produk Olahan (4:3)</h3><p className="text-xs text-slate-300">Geser posisi foto atau gunakan slider Zoom.</p></div>
            <button onClick={() => { setIsCropping(false); setCurrentImageSrc(null); }} className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition"><X className="w-5 h-5" /></button>
          </div>
          <div className="relative flex-1 my-4 w-full max-w-3xl mx-auto bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
            <Cropper image={currentImageSrc} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
          </div>
          <div className="w-full max-w-3xl mx-auto bg-slate-900 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 z-10 border border-slate-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <ZoomIn className="w-5 h-5 text-slate-400" /><input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="w-full sm:w-48 accent-blue-500 cursor-pointer" /><span className="text-xs font-mono text-slate-300 w-10">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex gap-3 w-full sm:w-auto justify-end">
              <button type="button" onClick={() => { setIsCropping(false); setCurrentImageSrc(null); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-sm transition">Batal</button>
              <button type="button" onClick={handleSaveCrop} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow flex items-center gap-1.5 transition"><Check className="w-4 h-4" /> Potong & Simpan (.WebP)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}