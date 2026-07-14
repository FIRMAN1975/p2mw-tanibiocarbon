import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/config/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { Factory, ShoppingBag, CheckCircle2, Clock, Truck, ShieldCheck, LogOut, ArrowRight, AlertCircle, PlusCircle, Layers, User, MapPin, Trash2, Phone, CreditCard, Image as ImageIcon, Check, X, ZoomIn, Sprout, Lock, AlertTriangle, MessageCircle, Star, FlaskConical, Navigation, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import { calculateDistance, formatWhatsAppLink } from "@/utils/helpers";

// --- HELPER CROPPER ---
const getCroppedImgWebP = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.src = imageSrc; image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Canvas kosong"));
        resolve({ file: new File([blob], `mitra_${Date.now()}.webp`, { type: "image/webp" }), previewUrl: URL.createObjectURL(blob) });
      }, "image/webp", 0.8);
    };
    image.onerror = (error) => reject(error);
  });
};

// --- MAPS COMPONENT ---
function LocationPickerWithReverseGeocode({ pinLocation, setPinLocation, alamatText, setAlamatText }) {
  const inputRef = useRef(null);
  const places = useMapsLibrary("places");
  const geocoding = useMapsLibrary("geocoding");
  const [placeAutocomplete, setPlaceAutocomplete] = useState(null);
  const [geocoder, setGeocoder] = useState(null);
  const map = useMap();

  useEffect(() => {
    if (places && inputRef.current) setPlaceAutocomplete(new places.Autocomplete(inputRef.current, { fields: ["geometry", "name", "formatted_address"], componentRestrictions: { country: "id" } }));
    if (geocoding) setGeocoder(new geocoding.Geocoder());
  }, [places, geocoding]);

  useEffect(() => {
    if (!placeAutocomplete) return;
    placeAutocomplete.addListener("place_changed", () => {
      const place = placeAutocomplete.getPlace();
      if (place.geometry?.location) {
        const newLat = place.geometry.location.lat(); const newLng = place.geometry.location.lng();
        setPinLocation({ lat: newLat, lng: newLng }); setAlamatText(place.formatted_address || place.name);
        if (map) { map.panTo({ lat: newLat, lng: newLng }); map.setZoom(16); }
      }
    });
  }, [placeAutocomplete, setPinLocation, setAlamatText, map]);

  const handleMapClick = (ev) => {
    if (!ev.detail.latLng) return;
    const newLat = ev.detail.latLng.lat; const newLng = ev.detail.latLng.lng;
    setPinLocation({ lat: newLat, lng: newLng });
    if (geocoder) geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results, status) => { if (status === "OK" && results[0]) setAlamatText(results[0].formatted_address); });
  };

  return (
    <div className="border rounded-xl p-4 bg-slate-50 border-slate-300">
      <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-600" /> Titik Lokasi Pabrik / Gudang Anda *</label>
      <input ref={inputRef} type="text" placeholder="Ketik atau klik peta untuk mengisi otomatis..." value={alamatText} onChange={(e) => setAlamatText(e.target.value)} className="w-full p-3 border rounded-xl text-sm mb-3 focus:ring-2 focus:ring-blue-500 outline-none" />
      <div className="w-full h-72 rounded-xl overflow-hidden border relative"><Map defaultCenter={pinLocation} defaultZoom={13} onClick={handleMapClick}><Marker position={pinLocation} /></Map></div>
    </div>
  );
}

// --- TIMELINE TRACKER ---
function OrderTimelineTracker({ status }) {
  const steps = [
    { key: "WAITING_PAYMENT_SIMULATION", label: "Dipesan" },
    { key: "PAID_ESCROW", label: "Dana Escrow" },
    { key: "SHIPPED", label: "Truk Dikirim" },
    { key: "CARGO_DELIVERED", label: "Tiba" },
    { key: "ESCROW_RELEASED", label: "Selesai" },
  ];
  let currentIndex = steps.findIndex((s) => s.key === status);
  if (currentIndex === -1) currentIndex = 0;

  return (
    <div className="w-full py-3 my-2 border-y border-slate-100">
      <div className="flex justify-between items-center relative">
        <div className="absolute top-3 left-0 right-0 h-1 bg-slate-200 mx-6"><div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}></div></div>
        {steps.map((step, idx) => (
          <div key={step.key} className="flex flex-col items-center z-10">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${idx <= currentIndex ? "bg-blue-600 text-white shadow-md" : "bg-slate-200 text-slate-500"} ${idx === currentIndex ? "ring-4 ring-blue-200 scale-110" : ""}`}>{idx + 1}</div>
            <span className={`text-[10px] mt-1 font-bold ${idx === currentIndex ? "text-blue-700" : "text-slate-400"}`}>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MAIN PAGE ---
export default function MitraPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("belanja"); // belanja, pesanan_masuk, etalase, upload, profil
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  // STATE DATA
  const [buyerOrders, setBuyerOrders] = useState([]); // Mitra sebagai Pembeli
  const [sellerOrders, setSellerOrders] = useState([]); // Mitra sebagai Penjual Olahan
  const [myProducts, setMyProducts] = useState([]);

  // Form Upload
  const [namaKomoditas, setNamaKomoditas] = useState("");
  const [kategori, setKategori] = useState("Biochar / Arang");
  const [beratTon, setBeratTon] = useState("");
  const [hargaPerTon, setHargaPerTon] = useState("");
  const [kadarAir, setKadarAir] = useState("");
  const [kadarKarbon, setKadarKarbon] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [alamatText, setAlamatText] = useState("");
  const [pinLocation, setPinLocation] = useState({ lat: -6.200000, lng: 106.816666 });
  const [croppedImages, setCroppedImages] = useState([]);

  // Cropper
  const [isCropping, setIsCropping] = useState(false);
  const [currentImageSrc, setCurrentImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Profil
  const [phone, setPhone] = useState("");
  const [rekening, setRekening] = useState("");
  const [alamatLahan, setAlamatLahan] = useState("");

  // Review Modal
  const [reviewOrder, setReviewOrder] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewText, setReviewText] = useState("");

  // READ DATA REAL-TIME
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data); setPhone(data.phone || ""); setRekening(data.rekening_bank || ""); setAlamatLahan(data.alamat_lahan || "");
        if (data.lokasi) setPinLocation(data.lokasi);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => { // Sebagai Buyer
    if (!user?.uid) return;
    const unsub = onSnapshot(query(collection(db, "orders"), where("buyerId", "==", user.uid)), (snap) => {
      setBuyerOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => { // Sebagai Seller (Pesanan Masuk)
    if (!user?.uid) return;
    const unsub = onSnapshot(query(collection(db, "orders"), where("farmerId", "==", user.uid)), (snap) => {
      setSellerOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => { // Dagangan Sendiri
    if (!user?.uid) return;
    const unsub = onSnapshot(query(collection(db, "products"), where("farmerId", "==", user.uid)), (snap) => {
      setMyProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  // AKSI: PROFIL & VERIFIKASI
  const handleSaveProfile = async (e) => {
    e.preventDefault(); const tId = toast.loading("Menyimpan...");
    try { await updateDoc(doc(db, "users", user.uid), { phone, rekening_bank: rekening, alamat_lahan: alamatLahan, lokasi: pinLocation }); toast.success("Profil disimpan!", { id: tId }); } 
    catch (err) { toast.error("Gagal.", { id: tId }); }
  };
  const handleAjukanVerifikasi = async () => {
    if (!phone || !rekening || !alamatLahan) return toast.error("Lengkapi data!");
    await updateDoc(doc(db, "users", user.uid), { verificationStatus: "pending", updatedAt: serverTimestamp() });
    toast.success("Pengajuan dikirim ke Admin!");
  };

  // AKSI: SEBAGAI PEMBELI (BUYER)
  const handleBayarEscrow = async (order) => {
    await updateDoc(doc(db, "orders", order.id), { status: "PAID_ESCROW" });
    toast.success("Berhasil bayar ke Escrow!");
  };
  const handleTerimaKargo = async (order) => {
    if (!window.confirm("Kargo sudah tiba di pabrik?")) return;
    await updateDoc(doc(db, "orders", order.id), { status: "CARGO_DELIVERED" });
    toast.success("Kargo Diterima! Admin akan mencairkan dana.");
  };
  const handleKirimUlasan = async (e) => {
    e.preventDefault();
    await updateDoc(doc(db, "orders", reviewOrder.id), { rating: ratingValue, reviewText });
    toast.success("Ulasan disimpan!"); setReviewOrder(null);
  };

  // AKSI: SEBAGAI PENJUAL (SELLER)
  const handleKirimTruk = async (orderId) => {
    const nopol = prompt("Nomor Polisi Truk:"); const supir = prompt("Nama Supir:");
    if (!nopol || !supir) return toast.error("Batal kirim. Nopol/Supir wajib diisi!");
    await updateDoc(doc(db, "orders", orderId), { status: "SHIPPED", no_polisi: nopol, nama_supir: supir });
    toast.success("Truk diberangkatkan!");
  };
  const handleToggleStatus = async (id, stat) => { await updateDoc(doc(db, "products", id), { status: stat === "tersedia" ? "terjual" : "tersedia" }); };
  const handleDeleteProduct = async (id) => { if (window.confirm("Hapus dagangan?")) await deleteDoc(doc(db, "products", id)); };

  // CROPPER & UPLOAD
  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);
  const handleSaveCrop = async () => {
    const webpData = await getCroppedImgWebP(currentImageSrc, croppedAreaPixels);
    setCroppedImages((p) => [...p, webpData]); setIsCropping(false); setCurrentImageSrc(null);
  };
  const handleUploadKomoditas = async (e) => {
    e.preventDefault();
    if (userProfile?.verificationStatus !== "verified") return toast.error("Akun belum diverifikasi!");
    if (croppedImages.length === 0) return toast.error("Pilih foto!");
    setLoading(true); const tId = toast.loading("Mengupload...");
    try {
      const urls = await Promise.all(croppedImages.map(async (item, i) => {
        const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_${i}.webp`);
        await uploadBytes(fileRef, item.file); return await getDownloadURL(fileRef);
      }));
      await addDoc(collection(db, "products"), {
        farmerId: user.uid, farmerName: user.displayName || "Mitra Industri", farmerPhone: phone, sellerRole: "Mitra Industri (Pemasok Olahan)",
        nama_komoditas: namaKomoditas, kategori, berat_ton: Number(beratTon), harga_per_ton: Number(hargaPerTon),
        kadar_air: kadarAir, kadar_karbon: kadarKarbon, deskripsi, fotoUrls: urls, status: "tersedia",
        lokasi: { alamat_text: alamatText, lat: pinLocation.lat, lng: pinLocation.lng }, createdAt: serverTimestamp(),
      });
      toast.success("Berhasil diupload!", { id: tId });
      setNamaKomoditas(""); setBeratTon(""); setHargaPerTon(""); setCroppedImages([]); setActiveTab("etalase");
    } catch (err) { toast.error("Gagal.", { id: tId }); } finally { setLoading(false); }
  };

  const isVerified = userProfile?.verificationStatus === "verified";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-blue-900 text-white px-6 py-4 flex justify-between items-center shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-2"><Factory className="w-6 h-6 text-blue-300" /><span className="font-black text-lg">TaniBioCarbon <span className="font-normal text-blue-300">| Mitra</span></span></div>
        <div className="flex gap-4"><a href="/marketplace" className="bg-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold">+ Beli Pasokan</a><button onClick={logout} className="p-2 bg-blue-950 rounded-lg"><LogOut className="w-4 h-4 text-red-300" /></button></div>
      </header>

      {/* 5 TABS NAV */}
      <div className="bg-white border-b px-6 flex gap-6 overflow-x-auto shadow-sm">
        <button onClick={() => setActiveTab("belanja")} className={`py-4 font-bold text-sm flex gap-2 border-b-2 ${activeTab==="belanja"?"border-blue-600 text-blue-800":"border-transparent text-slate-500"}`}><ArrowDownToLine className="w-4 h-4"/> Belanjaan Saya ({buyerOrders.length})</button>
        <button onClick={() => setActiveTab("pesanan_masuk")} className={`py-4 font-bold text-sm flex gap-2 border-b-2 ${activeTab==="pesanan_masuk"?"border-blue-600 text-blue-800":"border-transparent text-slate-500"}`}><ArrowUpFromLine className="w-4 h-4"/> Pesanan Masuk ({sellerOrders.length})</button>
        <button onClick={() => setActiveTab("etalase")} className={`py-4 font-bold text-sm flex gap-2 border-b-2 ${activeTab==="etalase"?"border-blue-600 text-blue-800":"border-transparent text-slate-500"}`}><Layers className="w-4 h-4"/> Etalase ({myProducts.length})</button>
        <button onClick={() => setActiveTab("upload")} className={`py-4 font-bold text-sm flex gap-2 border-b-2 ${activeTab==="upload"?"border-blue-600 text-blue-800":"border-transparent text-slate-500"}`}><PlusCircle className="w-4 h-4"/> Upload Olahan {!isVerified && <Lock className="w-3.5 h-3.5 text-amber-500"/>}</button>
        <button onClick={() => setActiveTab("profil")} className={`py-4 font-bold text-sm flex gap-2 border-b-2 ${activeTab==="profil"?"border-blue-600 text-blue-800":"border-transparent text-slate-500"}`}><User className="w-4 h-4"/> Profil</button>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        
        {/* TAB: BELANJAAN SAYA (BUYER) */}
        {activeTab === "belanja" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-800 mb-4">Riwayat Pengadaan Bahan Mentah (Buyer)</h2>
            {buyerOrders.map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-2xl border shadow-sm">
                <div className="flex justify-between border-b pb-3 mb-3">
                  <div><span className="text-xs font-bold text-slate-400">TRX: {item.id.slice(0,8)}</span><h3 className="text-lg font-black">{item.productName}</h3><p className="text-sm">Pemasok: {item.farmerName}</p></div>
                  <div className="text-right"><p className="text-xs font-bold">Total Nilai</p><p className="text-lg font-black text-blue-700">Rp {item.totalPrice?.toLocaleString()}</p></div>
                </div>
                <OrderTimelineTracker status={item.status} />
                {item.status === "SHIPPED" && (
                  <div className="bg-purple-50 p-3 mt-3 rounded-lg flex justify-between items-center"><p className="text-xs font-bold text-purple-800">🚚 Truk Dalam Perjalanan (Nopol: {item.no_polisi})</p><button onClick={()=>handleTerimaKargo(item)} className="bg-purple-600 text-white text-xs px-4 py-2 rounded-lg font-bold">Konfirmasi Tiba</button></div>
                )}
                <div className="flex justify-between items-center mt-4">
                  <a href={formatWhatsAppLink(item.farmerPhone, "Halo")} target="_blank" rel="noreferrer" className="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-lg font-bold">Chat WA Pemasok</a>
                  {item.status === "WAITING_PAYMENT_SIMULATION" && <button onClick={()=>handleBayarEscrow(item)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Bayar Escrow</button>}
                  {item.status === "ESCROW_RELEASED" && !item.rating && <button onClick={()=>setReviewOrder(item)} className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg text-xs font-bold">Beri Rating Mutu</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: PESANAN MASUK (SELLER) */}
        {activeTab === "pesanan_masuk" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-black text-slate-800 mb-4">Pesanan Masuk (Jual Produk Olahan)</h2>
            {sellerOrders.map((item) => (
              <div key={item.id} className="bg-white p-5 rounded-2xl border shadow-sm">
                <div className="flex justify-between">
                  <div><span className="text-xs font-bold text-slate-400">TRX: {item.id.slice(0,8)}</span><h3 className="text-lg font-black">{item.productName}</h3><p className="text-sm">Pembeli: {item.buyerName}</p></div>
                  <div className="text-right"><p className="text-lg font-black text-green-700">Rp {item.totalPrice?.toLocaleString()}</p></div>
                </div>
                <div className="mt-4 border-t pt-4">
                  {item.status === "PAID_ESCROW" && <button onClick={()=>handleKirimTruk(item.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold">🚚 Kirim Armada Truk (Input Nopol)</button>}
                  {item.status === "SHIPPED" && <span className="text-xs text-purple-700 font-bold">Truk Sedang Mengantar...</span>}
                  {item.status === "WAITING_PAYMENT_SIMULATION" && <span className="text-xs text-slate-500">Menunggu Pembeli Bayar...</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: ETALASE & UPLOAD (SELLER) */}
        {activeTab === "etalase" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {myProducts.map(item => (
              <div key={item.id} className="bg-white rounded-xl border p-4"><img src={item.fotoUrls[0]} className="w-full h-32 object-cover rounded-lg mb-3"/><h3 className="font-bold">{item.nama_komoditas}</h3><p className="text-sm mb-3">Rp {item.harga_per_ton?.toLocaleString()} / Ton</p><button onClick={()=>handleToggleStatus(item.id, item.status)} className="w-full bg-slate-100 p-2 rounded text-xs font-bold">{item.status}</button></div>
            ))}
          </div>
        )}

        {activeTab === "upload" && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            {!isVerified ? <p className="text-center font-bold text-amber-600">Akun belum diverifikasi Admin!</p> : (
              <form onSubmit={handleUploadKomoditas} className="space-y-4">
                <input type="text" placeholder="Nama Produk (Misal: Biochar Grade A)" value={namaKomoditas} onChange={e=>setNamaKomoditas(e.target.value)} className="w-full p-3 border rounded-xl text-sm" required/>
                <div className="flex gap-4"><input type="number" placeholder="Stok (Ton)" value={beratTon} onChange={e=>setBeratTon(e.target.value)} className="w-full p-3 border rounded-xl text-sm" required/><input type="number" placeholder="Harga/Ton" value={hargaPerTon} onChange={e=>setHargaPerTon(e.target.value)} className="w-full p-3 border rounded-xl text-sm" required/></div>
                <input type="file" onChange={handleFileSelect} className="w-full p-2 border border-dashed rounded-xl"/>
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""} libraries={["places", "geocoding"]}><LocationPickerWithReverseGeocode pinLocation={pinLocation} setPinLocation={setPinLocation} alamatText={alamatText} setAlamatText={setAlamatText} /></APIProvider>
                <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">Upload Dagangan</button>
              </form>
            )}
          </div>
        )}

        {/* TAB: PROFIL */}
        {activeTab === "profil" && (
          <div className="bg-white p-6 rounded-2xl border shadow-sm">
            <div className="mb-4">{!isVerified ? <button onClick={handleAjukanVerifikasi} className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-xs">Ajukan Verifikasi</button> : <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded">✔ Terverifikasi</span>}</div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <input type="text" placeholder="Nomor Telepon" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3 border rounded-xl text-sm"/>
              <input type="text" placeholder="Alamat Pabrik" value={alamatLahan} onChange={e=>setAlamatLahan(e.target.value)} className="w-full p-3 border rounded-xl text-sm"/>
              <input type="text" placeholder="Rekening Bank" value={rekening} onChange={e=>setRekening(e.target.value)} className="w-full p-3 border rounded-xl text-sm"/>
              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl">Simpan Profil</button>
            </form>
          </div>
        )}
      </main>

      {/* MODAL CROPPER & RATING (Sederhana untuk mematikan error tag) */}
      {isCropping && (
        <div className="fixed inset-0 z-50 bg-black/80 p-6 flex flex-col"><Cropper image={currentImageSrc} crop={crop} zoom={zoom} aspect={4/3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom}/><button onClick={handleSaveCrop} className="absolute bottom-10 right-10 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold z-50">Potong & Simpan</button></div>
      )}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleKirimUlasan} className="bg-white p-6 rounded-2xl w-full max-w-sm"><h3 className="font-bold mb-4">Beri Rating (1-5)</h3><input type="number" min="1" max="5" value={ratingValue} onChange={e=>setRatingValue(e.target.value)} className="w-full border p-2 mb-4"/><textarea placeholder="Ulasan..." value={reviewText} onChange={e=>setReviewText(e.target.value)} className="w-full border p-2 mb-4"></textarea><button type="submit" className="w-full bg-amber-500 text-white p-2 rounded-lg font-bold">Kirim</button></form>
        </div>
      )}
    </div>
  );
}