import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/config/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { Sprout, ShoppingBag, CheckCircle2, Clock, Truck, LogOut, PlusCircle, Layers, User, MapPin, Lock, AlertTriangle } from "lucide-react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";

const getCroppedImgWebP = (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.src = imageSrc; image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = pixelCrop.width; canvas.height = pixelCrop.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
      canvas.toBlob((blob) => { resolve({ file: new File([blob], `petani_${Date.now()}.webp`, { type: "image/webp" }), previewUrl: URL.createObjectURL(blob) }); }, "image/webp", 0.8);
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
      if (place.geometry?.location) {
        setPinLocation({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }); setAlamatText(place.formatted_address); if (map) map.panTo({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      }
    });
  }, [placeAutocomplete, setPinLocation, setAlamatText, map]);
  const handleMapClick = (ev) => {
    if (!ev.detail.latLng) return;
    setPinLocation({ lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng });
    if (geocoder) geocoder.geocode({ location: { lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng } }, (res, status) => { if (status === "OK" && res[0]) setAlamatText(res[0].formatted_address); });
  };
  return (
    <div className="border rounded-xl p-4 bg-slate-50"><input ref={inputRef} type="text" placeholder="Cari / klik peta..." value={alamatText} onChange={e => setAlamatText(e.target.value)} className="w-full p-3 border rounded-xl text-sm mb-3"/><div className="w-full h-64 rounded-xl overflow-hidden relative"><Map defaultCenter={pinLocation} defaultZoom={13} onClick={handleMapClick}><Marker position={pinLocation} /></Map></div></div>
  );
}

export default function PetaniPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("etalase");
  const [userProfile, setUserProfile] = useState(null);
  const [orders, setOrders] = useState([]); // SELLER ORDERS
  const [products, setProducts] = useState([]);

  const [namaKomoditas, setNamaKomoditas] = useState(""); const [kategori, setKategori] = useState("Limbah Pertanian"); const [beratTon, setBeratTon] = useState(""); const [hargaPerTon, setHargaPerTon] = useState("");
  const [alamatText, setAlamatText] = useState(""); const [pinLocation, setPinLocation] = useState({ lat: -6.200000, lng: 106.816666 }); const [croppedImages, setCroppedImages] = useState([]);
  const [isCropping, setIsCropping] = useState(false); const [currentImageSrc, setCurrentImageSrc] = useState(null); const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [phone, setPhone] = useState(""); const [rekening, setRekening] = useState(""); const [alamatLahan, setAlamatLahan] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    onSnapshot(doc(db, "users", user.uid), (docSnap) => { if (docSnap.exists()) { const data = docSnap.data(); setUserProfile(data); setPhone(data.phone || ""); setRekening(data.rekening_bank || ""); setAlamatLahan(data.alamat_lahan || ""); if (data.lokasi) setPinLocation(data.lokasi); }});
    onSnapshot(query(collection(db, "products"), where("farmerId", "==", user.uid)), (snap) => setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    onSnapshot(query(collection(db, "orders"), where("farmerId", "==", user.uid)), (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a,b)=> b.createdAt - a.createdAt)));
  }, [user]);

  const handleAjukanVerifikasi = async () => { await updateDoc(doc(db, "users", user.uid), { verificationStatus: "pending" }); toast.success("Diajukan ke Admin!"); };
  const handleSaveProfile = async (e) => { e.preventDefault(); await updateDoc(doc(db, "users", user.uid), { phone, rekening_bank: rekening, alamat_lahan: alamatLahan, lokasi: pinLocation }); toast.success("Tersimpan!"); };
  const handleKirimTruk = async (orderId) => {
    const nopol = prompt("Nomor Polisi Truk:"); const supir = prompt("Nama Supir:");
    if (!nopol || !supir) return toast.error("Wajib diisi!");
    await updateDoc(doc(db, "orders", orderId), { status: "SHIPPED", no_polisi: nopol, nama_supir: supir }); toast.success("Truk Berangkat!");
  };

  const handleFileSelect = (e) => { const reader = new FileReader(); reader.addEventListener("load", () => { setCurrentImageSrc(reader.result); setIsCropping(true); setZoom(1); setCrop({ x: 0, y: 0 }); }); reader.readAsDataURL(e.target.files[0]); e.target.value = null; };
  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);
  const handleSaveCrop = async () => { const webpData = await getCroppedImgWebP(currentImageSrc, croppedAreaPixels); setCroppedImages((p) => [...p, webpData]); setIsCropping(false); };
  
  const handleUploadKomoditas = async (e) => {
    e.preventDefault();
    if (userProfile?.verificationStatus !== "verified") return toast.error("Belum terverifikasi!");
    const tId = toast.loading("Mengupload...");
    const urls = await Promise.all(croppedImages.map(async (item, i) => { const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_${i}.webp`); await uploadBytes(fileRef, item.file); return await getDownloadURL(fileRef); }));
    await addDoc(collection(db, "products"), { farmerId: user.uid, farmerName: user.displayName, sellerRole: "Petani Raw Material", nama_komoditas: namaKomoditas, kategori, berat_ton: Number(beratTon), harga_per_ton: Number(hargaPerTon), fotoUrls: urls, status: "tersedia", lokasi: { alamat_text: alamatText, lat: pinLocation.lat, lng: pinLocation.lng }, createdAt: serverTimestamp() });
    toast.success("Berhasil!", { id: tId }); setNamaKomoditas(""); setCroppedImages([]); setActiveTab("etalase");
  };

  const isVerified = userProfile?.verificationStatus === "verified";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-green-700 text-white px-6 py-4 flex justify-between items-center"><div className="flex items-center gap-2"><Sprout className="w-6 h-6"/><span className="font-black text-lg">TaniBioCarbon | Petani</span></div><button onClick={logout} className="p-2 bg-green-800 rounded"><LogOut className="w-4 h-4"/></button></header>
      <div className="bg-white border-b px-6 flex gap-6 overflow-x-auto">
        <button onClick={() => setActiveTab("etalase")} className={`py-4 font-bold ${activeTab==="etalase"?"border-b-2 border-green-600 text-green-700":""}`}>Etalase ({products.length})</button>
        <button onClick={() => setActiveTab("pesanan_masuk")} className={`py-4 font-bold ${activeTab==="pesanan_masuk"?"border-b-2 border-green-600 text-green-700":""}`}>Pesanan Masuk ({orders.length})</button>
        <button onClick={() => setActiveTab("upload")} className={`py-4 font-bold ${activeTab==="upload"?"border-b-2 border-green-600 text-green-700":""}`}>Upload</button>
        <button onClick={() => setActiveTab("profil")} className={`py-4 font-bold ${activeTab==="profil"?"border-b-2 border-green-600 text-green-700":""}`}>Profil</button>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6">
        {activeTab === "etalase" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map(item => (<div key={item.id} className="bg-white rounded-xl border p-4"><img src={item.fotoUrls[0]} className="w-full h-32 object-cover rounded-lg mb-3"/><h3 className="font-bold">{item.nama_komoditas}</h3></div>))}
          </div>
        )}
        
        {activeTab === "pesanan_masuk" && (
          <div className="space-y-4">
            {orders.map(item => (
              <div key={item.id} className="bg-white p-5 rounded-2xl border">
                <div className="flex justify-between"><div><span className="text-xs font-bold">TRX: {item.id.slice(0,8)}</span><h3 className="text-lg font-black">{item.productName}</h3></div><div className="text-right"><p className="text-lg font-black text-green-700">Rp {item.totalPrice?.toLocaleString()}</p></div></div>
                <div className="mt-4 border-t pt-4">
                  {item.status === "PAID_ESCROW" && <button onClick={()=>handleKirimTruk(item.id)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold">🚚 Kirim Armada Truk (Input Nopol)</button>}
                  {item.status === "SHIPPED" && <span className="text-xs text-purple-700 font-bold">Truk Sedang Mengantar...</span>}
                  {item.status === "WAITING_PAYMENT_SIMULATION" && <span className="text-xs text-slate-500">Menunggu Pembeli Bayar...</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "upload" && (
          <div className="bg-white p-6 rounded-2xl border">
            {!isVerified ? <p className="text-amber-600 font-bold text-center">Akun belum diverifikasi Admin!</p> : (
              <form onSubmit={handleUploadKomoditas} className="space-y-4">
                <input type="text" placeholder="Nama Komoditas" value={namaKomoditas} onChange={e=>setNamaKomoditas(e.target.value)} className="w-full p-3 border rounded-xl" required/>
                <div className="flex gap-4"><input type="number" placeholder="Stok (Ton)" value={beratTon} onChange={e=>setBeratTon(e.target.value)} className="w-full p-3 border rounded-xl" required/><input type="number" placeholder="Harga/Ton" value={hargaPerTon} onChange={e=>setHargaPerTon(e.target.value)} className="w-full p-3 border rounded-xl" required/></div>
                <input type="file" onChange={handleFileSelect} className="w-full p-2 border border-dashed rounded-xl"/>
                <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""} libraries={["places", "geocoding"]}><LocationPickerWithReverseGeocode pinLocation={pinLocation} setPinLocation={setPinLocation} alamatText={alamatText} setAlamatText={setAlamatText} /></APIProvider>
                <button type="submit" className="w-full bg-green-600 text-white font-bold py-3 rounded-xl">Upload Dagangan</button>
              </form>
            )}
          </div>
        )}

        {activeTab === "profil" && (
          <div className="bg-white p-6 rounded-2xl border">
            <div className="mb-4">{!isVerified ? <button onClick={handleAjukanVerifikasi} className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-xs">Ajukan Verifikasi</button> : <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded">✔ Terverifikasi</span>}</div>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <input type="text" placeholder="Nomor WA" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3 border rounded-xl"/>
              <input type="text" placeholder="Alamat Lahan" value={alamatLahan} onChange={e=>setAlamatLahan(e.target.value)} className="w-full p-3 border rounded-xl"/>
              <input type="text" placeholder="Rekening Bank" value={rekening} onChange={e=>setRekening(e.target.value)} className="w-full p-3 border rounded-xl"/>
              <button type="submit" className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl">Simpan Profil</button>
            </form>
          </div>
        )}
      </main>

      {isCropping && (
        <div className="fixed inset-0 z-50 bg-black/80 p-6 flex flex-col"><Cropper image={currentImageSrc} crop={crop} zoom={zoom} aspect={4/3} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom}/><button onClick={handleSaveCrop} className="absolute bottom-10 right-10 bg-green-600 text-white px-6 py-2 rounded-lg font-bold z-50">Potong & Simpan</button></div>
      )}
    </div>
  );
}