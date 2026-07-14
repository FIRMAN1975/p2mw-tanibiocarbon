import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/config/firebase";
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { Sprout, PlusCircle, User, MapPin, Trash2, Layers, Phone, CreditCard, LogOut, Image as ImageIcon, Check, X, ZoomIn, ShieldAlert, Lock, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
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
        resolve({ file: new File([blob], `petani_${Date.now()}.webp`, { type: "image/webp" }), previewUrl: URL.createObjectURL(blob) });
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

  // Listener Autocomplete (Saat pilih dari dropdown Google)
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

    // Panggil API Geocoding Google untuk mengambil string alamat
    if (geocoder) {
      geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => {
        if (status === "OK" && results[0]) {
          setAlamatText(results[0].formatted_address); // Update otomatis box input alamat!
        } else {
          console.warn("Alamat detail tidak ditemukan di titik koordinat ini.");
        }
      });
    }
  };

  return (
    <div className="border rounded-xl p-4 bg-slate-50 border-slate-300">
      <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-red-600" /> Titik Penjemputan Truk Kargo (Cari atau Klik Langsung di Peta) *
      </label>
      <p className="text-xs text-slate-500 mb-3">
        Ketik nama desa/patokan ATAU <span className="font-bold text-green-700">klik langsung pada peta</span>. Alamat teks akan diperbarui secara otomatis!
      </p>

      {/* INPUT ALAMAT TEKS */}
      <input
        ref={inputRef}
        type="text"
        required
        placeholder="🔍 Ketik atau klik peta untuk mengisi alamat penjemputan otomatis..."
        value={alamatText}
        onChange={(e) => setAlamatText(e.target.value)}
        className="w-full p-3 border border-slate-300 rounded-xl text-sm mb-3 bg-white focus:ring-2 focus:ring-green-500 outline-none text-slate-800 font-medium shadow-sm"
      />

      {/* KANVAS PETA INTERAKTIF */}
      <div className="w-full h-72 rounded-xl overflow-hidden border border-slate-300 shadow-inner relative">
        <Map defaultCenter={pinLocation} defaultZoom={13} onClick={handleMapClick}>
          <Marker position={pinLocation} />
        </Map>
      </div>
      
      <div className="flex justify-between items-center mt-2">
        <span className="text-[11px] text-green-700 font-semibold">✨ Fitur Aktif: Klik titik mana saja di peta, alamat di atas langsung berubah!</span>
        <p className="text-xs text-slate-400 font-mono">Lat: {pinLocation.lat.toFixed(5)}, Lng: {pinLocation.lng.toFixed(5)}</p>
      </div>
    </div>
  );
}

// =========================================================================
// 3. KOMPONEN UTAMA PORTAL PETANI
// =========================================================================
export default function PetaniPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("etalase");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);

  // REAL-TIME USER PROFILE (Untuk memantau status verifikasi akun secara langsung)
  const [userProfile, setUserProfile] = useState(null);

  // State Form Upload Komoditas
  const [namaKomoditas, setNamaKomoditas] = useState("");
  const [kategori, setKategori] = useState("Limbah Pertanian");
  const [beratTon, setBeratTon] = useState("");
  const [hargaPerTon, setHargaPerTon] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [alamatText, setAlamatText] = useState("");
  const [pinLocation, setPinLocation] = useState({ lat: -6.200000, lng: 106.816666 });
  const [croppedImages, setCroppedImages] = useState([]);

  // State Cropper
  const [isCropping, setIsCropping] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // State Profil Petani
  const [phone, setPhone] = useState("");
  const [rekening, setRekening] = useState("");
  const [alamatLahan, setAlamatLahan] = useState("");

  // --- READ 1: Ambil Data Profil Pengguna Secara Real-time (Status Verifikasi) ---
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

  // --- READ 2: Ambil Data Dagangan Milik Sendiri (Ownership) ---
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "products"), where("farmerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProducts(items);
    });
    return () => unsubscribe();
  }, [user]);

  // --- AKSI: AJUKAN VERIFIKASI KE ADMIN ---
  const handleAjukanVerifikasi = async () => {
    if (!phone || !rekening || !alamatLahan) {
      alert("⚠️ Harap lengkapi Nomor WhatsApp, Domisili, dan Rekening Bank terlebih dahulu sebelum mengajukan verifikasi!");
      return;
    }
    setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        verificationStatus: "pending",
        updatedAt: serverTimestamp()
      });
      alert("🎉 Pengajuan verifikasi berhasil dikirim! Silakan tunggu Admin memeriksa data rekening Anda.");
    } catch (error) { alert("Gagal mengajukan verifikasi."); }
    finally { setLoading(false); }
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

  // --- CREATE: Upload Dagangan ke Marketplace (Hanya Bisa Jika Verified!) ---
  const handleUploadKomoditas = async (e) => {
    e.preventDefault();
    if (userProfile?.verificationStatus !== "verified") return alert("⚠️ Akun Anda belum diverifikasi oleh Admin!");
    if (croppedImages.length === 0) return alert("Harap upload & potong minimal 1 foto komoditas!");
    if (!beratTon || !hargaPerTon || !namaKomoditas || !alamatText) return alert("Harap lengkapi semua data wajib!");

    setLoading(true);
    try {
      const uploadPromises = croppedImages.map(async (item, index) => {
        const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_img_${index}.webp`);
        await uploadBytes(fileRef, item.file);
        return await getDownloadURL(fileRef);
      });
      const fotoUrls = await Promise.all(uploadPromises);

      await addDoc(collection(db, "products"), {
        farmerId: user.uid,
        farmerName: user.displayName || "Petani",
        farmerPhone: phone || "Belum dicantumkan",
        sellerRole: "Petani Raw Material",
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

      alert("🎉 Komoditas berhasil di-upload ke etalase Marketplace!");
      setNamaKomoditas(""); setBeratTon(""); setHargaPerTon(""); setDeskripsi(""); setAlamatText(""); setCroppedImages([]); setActiveTab("etalase");
    } catch (error) { alert("Gagal mengupload produk."); } 
    finally { setLoading(false); }
  };

  const handleDeleteProduct = async (id) => { if (window.confirm("Yakin ingin menghapus komoditas ini?")) await deleteDoc(doc(db, "products", id)); };
  const handleToggleStatus = async (id, currentStatus) => { await updateDoc(doc(db, "products", id), { status: currentStatus === "tersedia" ? "terjual" : "tersedia" }); };
  const handleSaveProfile = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await updateDoc(doc(db, "users", user.uid), { phone, rekening_bank: rekening, alamat_lahan: alamatLahan });
      alert("🎉 Profil berhasil diperbarui!");
    } catch (error) { alert("Gagal memperbarui profil."); } 
    finally { setLoading(false); }
  };

  const statusVerifikasi = userProfile?.verificationStatus || "unverified";
  const isVerified = statusVerifikasi === "verified";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* HEADER NAVBAR */}
      <header className="bg-green-700 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Sprout className="w-6 h-6 text-green-300" />
          <span className="font-extrabold text-lg tracking-wide">TaniBioCarbon | Portal Petani</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user?.displayName}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              isVerified ? "bg-green-900 text-green-200 border border-green-400" : "bg-amber-500 text-slate-950"
            }`}>
              {isVerified ? "✔ Terverifikasi" : "⏳ Belum Verifikasi"}
            </span>
          </div>
          <button onClick={logout} className="p-2 bg-green-800 hover:bg-green-900 rounded-lg text-sm flex items-center gap-1 transition">
            <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Keluar</span>
          </button>
        </div>
      </header>

      {/* 3 TAB NAVIGATION */}
      <div className="bg-white border-b px-6 flex gap-6 shadow-sm overflow-x-auto">
        <button onClick={() => setActiveTab("etalase")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition ${activeTab === "etalase" ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <Layers className="w-4 h-4" /> Etalase Saya ({products.length})
        </button>
        <button onClick={() => setActiveTab("upload")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition relative ${activeTab === "upload" ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <PlusCircle className="w-4 h-4" /> Upload Komoditas Baru
          {!isVerified && <Lock className="w-3.5 h-3.5 text-amber-500 inline ml-1" />}
        </button>
        <button onClick={() => setActiveTab("profil")} className={`py-4 font-bold text-sm flex items-center gap-2 border-b-2 whitespace-nowrap transition ${activeTab === "profil" ? "border-green-600 text-green-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          <User className="w-4 h-4" /> Profil & Verifikasi Rekening
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
                <h4 className="font-bold text-slate-900 text-sm">Akun Anda Belum Dapat Berjualan (Status: {statusVerifikasi.toUpperCase()})</h4>
                <p className="text-xs text-slate-600">Lengkapi data rekening bank di tab Profil lalu tekan tombol ajukan verifikasi agar dibukakan izin oleh Admin.</p>
              </div>
            </div>
            <button onClick={() => setActiveTab("profil")} className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-xs shrink-0 transition shadow">
              Buka Tab Profil & Verifikasi
            </button>
          </div>
        )}

        {/* =========================================================================
            TAB 1: ETALASE SAYA
           ========================================================================= */}
        {activeTab === "etalase" && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800">Daftar Komoditas Lahan Anda</h2>
              <p className="text-sm text-slate-500">Hanya Anda yang dapat melihat dan mengedit barang di halaman ini (Hak Milik/Ownership).</p>
            </div>
            {products.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                <Sprout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">Belum ada komoditas yang di-upload.</p>
                {isVerified && <button onClick={() => setActiveTab("upload")} className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition">+ Mulai Upload Barang Pertama</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="bg-slate-100 p-2 grid grid-cols-2 gap-1 h-48 overflow-y-auto">
                        {item.fotoUrls && item.fotoUrls.map((url, index) => (
                          <img key={index} src={url} alt={`Foto ${index + 1}`} className={`w-full h-full object-cover rounded ${item.fotoUrls.length === 1 ? "col-span-2 h-44" : "h-22"}`} />
                        ))}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{item.kategori}</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded capitalize ${item.status === "tersedia" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>{item.status}</span>
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 mb-1">{item.nama_komoditas}</h3>
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{item.deskripsi || "Tidak ada deskripsi detail."}</p>
                        <div className="space-y-1 text-sm border-t pt-3">
                          <div className="flex justify-between"><span className="text-slate-500">Berat Stok:</span> <span className="font-bold text-slate-800">{item.berat_ton} Ton</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Harga / Ton:</span> <span className="font-bold text-green-700">Rp {item.harga_per_ton.toLocaleString("id-ID")}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Total Estimasi:</span> <span className="font-black text-slate-900">Rp {(item.berat_ton * item.harga_per_ton).toLocaleString("id-ID")}</span></div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 pt-2"><MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" /> <span className="truncate">{item.lokasi?.alamat_text}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-3 border-t flex gap-2">
                      <button onClick={() => handleToggleStatus(item.id, item.status)} className="flex-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold py-1.5 px-3 rounded text-xs transition">
                        {item.status === "tersedia" ? "Tandai Terjual" : "Set Tersedia"}
                      </button>
                      <button onClick={() => handleDeleteProduct(item.id)} className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded border border-red-200 transition" title="Hapus Barang">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: FORM UPLOAD (GATEKEEPER LOCKED JIKA BELUM VERIFIED)
           ========================================================================= */}
        {activeTab === "upload" && (
          <div>
            {!isVerified ? (
              <div className="bg-white border-2 border-amber-300 rounded-3xl p-8 max-w-2xl mx-auto text-center shadow-lg my-10">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2">Form Upload Terkunci Sementara</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  Untuk menjaga kualitas pasokan di Marketplace TaniBioCarbon, hanya Petani yang rekening bank dan alamatnya telah <span className="font-bold text-green-700">Diverifikasi oleh Admin</span> yang dapat mulai menjual komoditas.
                </p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-left mb-6 space-y-1 font-medium text-slate-700">
                  <p>1. Buka Tab <span className="font-bold">"Profil & Verifikasi Rekening"</span>.</p>
                  <p>2. Lengkapi Nomor WhatsApp, Alamat Lahan, dan Rekening Bank.</p>
                  <p>3. Tekan tombol <span className="font-bold text-green-700">"📢 Ajukan Verifikasi ke Admin"</span>.</p>
                </div>
                <button
                  onClick={() => setActiveTab("profil")}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl shadow transition"
                >
                  Lengkapi Profil & Ajukan Sekarang
                </button>
              </div>
            ) : (
              /* FORM UPLOAD TERBUKA JIKA VERIFIED */
              <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm max-w-3xl mx-auto animate-fadeIn">
                <h2 className="text-xl font-bold text-slate-900 mb-1">Upload Stok Raw Material Baru</h2>
                <p className="text-sm text-slate-500 mb-6">Sesuaikan posisi foto (4:3) dan tentukan koordinat akurat pada peta agar ongkir truk bisa dihitung.</p>

                <form onSubmit={handleUploadKomoditas} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nama Komoditas / Limbah Tani *</label>
                    <input type="text" required placeholder="Contoh: Bonggol Jagung Kering / Sekam Padi / Batang Singkong" value={namaKomoditas} onChange={(e) => setNamaKomoditas(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Kategori *</label>
                      <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none">
                        <option value="Limbah Pertanian">Limbah Pertanian</option>
                        <option value="Limbah Kehutanan">Limbah Kehutanan</option>
                        <option value="Biochar / Arang">Biochar / Arang</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Berat Stok (Ton) *</label>
                      <input type="number" step="0.1" required placeholder="0.0" value={beratTon} onChange={(e) => setBeratTon(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Harga per Ton (Rp) *</label>
                      <input type="number" required placeholder="1200000" value={hargaPerTon} onChange={(e) => setHargaPerTon(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                  </div>

                  {/* SECTION: CROPPER WEBP */}
                  <div className="p-5 border-2 border-dashed border-green-400 rounded-xl bg-green-50/40">
                    <label className="block text-sm font-bold text-green-900 mb-1 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-green-700" /> Upload & Potong Foto Komoditas (Format WebP) *</label>
                    <p className="text-xs text-slate-600 mb-4">Pilih foto satu per satu untuk menyesuaikan bingkainya (Rasio 4:3).</p>
                    <label className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm cursor-pointer shadow-sm transition">
                      <PlusCircle className="w-4 h-4" /> Pilih & Potong Foto
                      <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                    </label>
                    {croppedImages.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <p className="text-xs font-bold text-green-800 mb-2">Siap Diupload ({croppedImages.length} Foto):</p>
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
                    <label className="block text-sm font-bold text-slate-700 mb-1">Deskripsi Kondisi Barang</label>
                    <textarea rows="3" placeholder="Jelaskan kadar air (misal: < 15%), kondisi kebersihan, atau akses jalan truk..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"></textarea>
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

                  <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition disabled:bg-slate-300">
                    {loading ? "Mengupload Foto WebP & Menyimpan..." : "Simpan & Tampilkan di Etalase Marketplace"}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: PROFIL & PENGAJUAN VERIFIKASI REKENING
           ========================================================================= */}
        {activeTab === "profil" && (
          <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm max-w-xl mx-auto">
            
            {/* BOX STATUS VERIFIKASI */}
            <div className={`p-4 rounded-xl border mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
              isVerified ? "bg-green-50 border-green-300 text-green-900" :
              statusVerifikasi === "pending" ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-slate-100 border-slate-300 text-slate-800"
            }`}>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Status Verifikasi Akun</p>
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
                  className="bg-green-600 hover:bg-green-700 text-white font-black px-4 py-2.5 rounded-xl text-xs shadow transition shrink-0"
                >
                  📢 Ajukan Verifikasi ke Admin
                </button>
              )}
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-1">Pengaturan Profil & Rekening Penerimaan Escrow</h2>
            <p className="text-sm text-slate-500 mb-6">Data ini wajib diisi dengan valid agar Admin dapat menyetujui izin berjualan Anda dan mencairkan dana Escrow saat kargo laku.</p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><Phone className="w-4 h-4 text-green-600" /> Nomor WhatsApp / Telepon Aktif *</label>
                <input type="tel" placeholder="081234567890" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-green-600" /> Domisili / Wilayah Lahan Pertanian *</label>
                <input type="text" placeholder="Kab. Lamongan, Jawa Timur" value={alamatLahan} onChange={(e) => setAlamatLahan(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-green-600" /> Informasi Rekening Bank / E-Wallet *</label>
                <input type="text" placeholder="BCA - 1234567890 - a.n. Firman Hutasoit" value={rekening} onChange={(e) => setRekening(e.target.value)} className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" />
                <p className="text-xs text-slate-400 mt-1">Pastikan nama rekening sesuai KTP untuk menghindari keterlambatan pencairan dana.</p>
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
            <div><h3 className="font-bold text-sm sm:text-base">Sesuaikan Bingkai Foto Card (Rasio 4:3)</h3><p className="text-xs text-slate-300">Geser posisi foto atau gunakan slider Zoom.</p></div>
            <button onClick={() => { setIsCropping(false); setCurrentImageSrc(null); }} className="p-1.5 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition"><X className="w-5 h-5" /></button>
          </div>
          <div className="relative flex-1 my-4 w-full max-w-3xl mx-auto bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
            <Cropper image={currentImageSrc} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
          </div>
          <div className="w-full max-w-3xl mx-auto bg-slate-900 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 z-10 border border-slate-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <ZoomIn className="w-5 h-5 text-slate-400" /><input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="w-full sm:w-48 accent-green-500 cursor-pointer" /><span className="text-xs font-mono text-slate-300 w-10">{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex gap-3 w-full sm:w-auto justify-end">
              <button type="button" onClick={() => { setIsCropping(false); setCurrentImageSrc(null); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-sm transition">Batal</button>
              <button type="button" onClick={handleSaveCrop} className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-sm shadow flex items-center gap-1.5 transition"><Check className="w-4 h-4" /> Potong & Simpan (.WebP)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}