import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/config/firebase";
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";
import { Sprout, Store, Inbox, UploadCloud, Settings, MapPin, Trash2, Check, X, ZoomIn, Lock, AlertTriangle, Truck, FlaskConical, Image as ImageIcon, Wallet, Calculator, FileText, ArrowDownToLine, ArrowUpFromLine, MessageCircle, Star, AlertOctagon, ShoppingBag } from "lucide-react";
import Cropper from "react-easy-crop";
import toast from "react-hot-toast";
import WalletDashboard from "@/components/wallet/WalletDashboard";
import { formatWhatsAppLink } from "@/utils/helpers";

import InputOngkirModal from "@/components/orders/InputOngkirModal";
import ShippingProofModal from "@/components/orders/ShippingProofModal";
import NegoOngkirModal from "@/components/orders/NegoOngkirModal";
import DisputeModal from "@/components/orders/DisputeModal";
import OrderChatModal from "@/components/orders/OrderChatModal";

const getCroppedImgWebP = (imageSrc, pixelCrop) => { return new Promise((resolve) => { const image = new Image(); image.src = imageSrc; image.crossOrigin = "anonymous"; image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = pixelCrop.width; canvas.height = pixelCrop.height; const ctx = canvas.getContext("2d"); ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height); canvas.toBlob((blob) => { resolve({ file: new File([blob], `petani_${Date.now()}.webp`, { type: "image/webp" }), previewUrl: URL.createObjectURL(blob) }); }, "image/webp", 0.8); }; }); };

function LocationPickerWithReverseGeocode({ pinLocation, setPinLocation, alamatText, setAlamatText }) { const inputRef = useRef(null); const places = useMapsLibrary("places"); const geocoding = useMapsLibrary("geocoding"); const [placeAutocomplete, setPlaceAutocomplete] = useState(null); const [geocoder, setGeocoder] = useState(null); const map = useMap(); useEffect(() => { if (places && inputRef.current) setPlaceAutocomplete(new places.Autocomplete(inputRef.current, { fields: ["geometry", "name", "formatted_address"], componentRestrictions: { country: "id" } })); if (geocoding) setGeocoder(new geocoding.Geocoder()); }, [places, geocoding]); useEffect(() => { if (!placeAutocomplete) return; placeAutocomplete.addListener("place_changed", () => { const place = placeAutocomplete.getPlace(); if (place.geometry?.location) { setPinLocation({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }); setAlamatText(place.formatted_address); if (map) map.panTo({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }); } }); }, [placeAutocomplete, setPinLocation, setAlamatText, map]); const handleMapClick = (ev) => { if (!ev.detail.latLng) return; setPinLocation({ lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng }); if (geocoder) geocoder.geocode({ location: { lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng } }, (res, status) => { if (status === "OK" && res[0]) setAlamatText(res[0].formatted_address); }); }; return ( <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50"> <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-red-500" /> Titik Penjemputan Truk Kargo *</label> <input ref={inputRef} type="text" placeholder="Cari alamat atau klik pada peta..." value={alamatText} onChange={e => setAlamatText(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm mb-4 outline-none bg-white"/> <div className="w-full h-64 rounded-xl overflow-hidden relative border border-slate-200 shadow-inner"><Map defaultCenter={pinLocation} defaultZoom={13} onClick={handleMapClick} gestureHandling="greedy"><Marker position={pinLocation} /></Map></div> </div> ); }

function OrderTimelineTracker({ status }) {
  if (status === "CANCELLED") return <div className="w-full py-4 px-4 my-2 bg-red-50 border border-red-200 rounded-xl text-center text-red-600 font-bold text-sm">Pesanan Dibatalkan</div>
  if (status === "DISPUTE") return <div className="w-full py-4 px-4 my-2 bg-red-600 border border-red-700 rounded-xl text-center text-white font-bold text-sm flex items-center justify-center gap-2"><AlertOctagon className="w-5 h-5"/> Transaksi Dalam Kendala (Dispute)</div>
  const steps = [{ key: "AWAITING_SHIPPING_COST", label: "Ongkir" }, { key: "WAITING_PAYMENT_SIMULATION", label: "Bayar" }, { key: "PAID_ESCROW", label: "Escrow" }, { key: "SHIPPED", label: "Dikirim" }, { key: "CARGO_DELIVERED", label: "Selesai" }];
  let currentIndex = steps.findIndex((s) => s.key === status); if (currentIndex === -1) currentIndex = 1; if (status === "ESCROW_RELEASED") currentIndex = 4;
  return ( <div className="w-full py-4 px-2 my-2 border-y border-slate-100"> <div className="flex justify-between items-center relative"> <div className="absolute top-2.5 left-0 right-0 h-[3px] bg-slate-200 mx-4"><div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}></div></div> {steps.map((step, idx) => ( <div key={step.key} className="flex flex-col items-center z-10"> <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all ${idx <= currentIndex ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"} ${idx === currentIndex ? "ring-4 ring-slate-200 scale-125" : ""}`}>{idx + 1}</div> <span className={`text-[9px] mt-2 font-bold uppercase tracking-wider ${idx === currentIndex ? "text-slate-900" : "text-slate-400"}`}>{step.label}</span> </div> ))} </div> </div> );
}

export default function PetaniPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("etalase");
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [buyerOrders, setBuyerOrders] = useState([]); 
  const [sellerOrders, setSellerOrders] = useState([]); 
  const [products, setProducts] = useState([]);

  const [ongkirOrder, setOngkirOrder] = useState(null);
  const [shippingOrder, setShippingOrder] = useState(null);
  const [negoOrder, setNegoOrder] = useState(null);
  const [disputeOrder, setDisputeOrder] = useState(null);
  const [chatOrder, setChatOrder] = useState(null); 
  
  const [reviewOrder, setReviewOrder] = useState(null); const [ratingValue, setRatingValue] = useState(5); const [reviewText, setReviewText] = useState("");

  // BARIS YANG HILANG SUDAH DIKEMBALIKAN DI SINI:
  const [namaKomoditas, setNamaKomoditas] = useState(""); const [kategori, setKategori] = useState("Limbah Pertanian"); const [beratTon, setBeratTon] = useState(""); const [hargaPerTon, setHargaPerTon] = useState("");
  const [kadarAir, setKadarAir] = useState(""); const [kadarKarbon, setKadarKarbon] = useState(""); const [deskripsi, setDeskripsi] = useState("");
  const [alamatText, setAlamatText] = useState(""); const [pinLocation, setPinLocation] = useState({ lat: -6.200000, lng: 106.816666 }); const [croppedImages, setCroppedImages] = useState([]);
  
  const [isCropping, setIsCropping] = useState(false); const [currentImageSrc, setCurrentImageSrc] = useState(null); const [crop, setCrop] = useState({ x: 0, y: 0 }); const [zoom, setZoom] = useState(1); const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [phone, setPhone] = useState(""); const [alamatLahan, setAlamatLahan] = useState(""); const [bankDetails, setBankDetails] = useState({ bankCode: "BCA", accountName: "", accountNumber: "" });

  const notifiedOrders = useRef(new Set());

  useEffect(() => {
    if (!user?.uid) return;
    onSnapshot(doc(db, "users", user.uid), (docSnap) => { if (docSnap.exists()) { const data = docSnap.data(); setUserProfile(data); setPhone(data.phone || ""); setBankDetails(data.bankDetails || { bankCode: "BCA", accountName: "", accountNumber: "" }); setAlamatLahan(data.alamat_lahan || ""); if (data.lokasi) setPinLocation(data.lokasi); } });
    onSnapshot(query(collection(db, "orders"), where("buyerId", "==", user.uid)), (snap) => setBuyerOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=> b.createdAt - a.createdAt))); 
    onSnapshot(query(collection(db, "orders"), where("farmerId", "==", user.uid)), (snap) => setSellerOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b)=> b.createdAt - a.createdAt)));
    onSnapshot(query(collection(db, "products"), where("farmerId", "==", user.uid)), (snap) => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  useEffect(() => {
    const allOrders = [...buyerOrders, ...sellerOrders];
    allOrders.forEach(order => {
       if (order.unreadChat?.[user?.uid]) {
          if (!notifiedOrders.current.has(order.id) && chatOrder?.id !== order.id) {
             toast(`Pesan baru dari ${order.buyerId === user?.uid ? order.farmerName : order.buyerName}`, { icon: '💬' });
             notifiedOrders.current.add(order.id);
          }
       } else {
          notifiedOrders.current.delete(order.id);
       }
    });
  }, [buyerOrders, sellerOrders, user?.uid, chatOrder]);

  const handleAjukanVerifikasi = async () => { if(!phone || !bankDetails.accountNumber || !bankDetails.accountName || !alamatLahan) return toast.error("Lengkapi profil dan data rekening!"); await updateDoc(doc(db, "users", user.uid), { verificationStatus: "pending" }); toast.success("Berhasil diajukan ke Admin!"); };
  const handleSaveProfile = async (e) => { e.preventDefault(); await updateDoc(doc(db, "users", user.uid), { phone, bankDetails, alamat_lahan: alamatLahan, lokasi: pinLocation }); toast.success("Profil tersimpan!"); };
  const handleBayarEscrow = async (order) => { if (order.xenditInvoiceUrl) return window.location.href = order.xenditInvoiceUrl; const toastId = toast.loading("Membuat Invoice Xendit..."); try { const functionUrl = import.meta.env.VITE_API_CREATE_INVOICE; const response = await fetch(functionUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, buyerEmail: user?.email }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); window.location.href = data.invoiceUrl; } catch (error) { toast.error("Gagal ke Xendit", { id: toastId }); } };
  const handleBatalkanPesanan = async (order) => { if (!window.confirm("Yakin batalkan pesanan ini? Stok kembali ke penjual.")) return; const toastId = toast.loading("Membatalkan pesanan..."); try { await updateDoc(doc(db, "orders", order.id), { status: "CANCELLED" }); const productSnap = await getDoc(doc(db, "products", order.productId)); if (productSnap.exists()) await updateDoc(doc(db, "products", order.productId), { berat_ton: (productSnap.data().berat_ton || 0) + order.totalTon, status: "tersedia" }); toast.success("Pesanan dibatalkan.", { id: toastId }); } catch (error) { toast.error("Gagal batal", { id: toastId }); } };
  const handleTerimaKargo = async (order) => { if (!window.confirm("Kargo sudah tiba sesuai pesanan?")) return; await updateDoc(doc(db, "orders", order.id), { status: "CARGO_DELIVERED" }); toast.success("Kargo Diterima!"); };
  const handleKirimUlasan = async (e) => { e.preventDefault(); await updateDoc(doc(db, "orders", reviewOrder.id), { rating: ratingValue, reviewText }); toast.success("Ulasan disimpan!"); setReviewOrder(null); };

  const handleFileSelect = (e) => { const reader = new FileReader(); reader.addEventListener("load", () => { setCurrentImageSrc(reader.result); setIsCropping(true); setZoom(1); setCrop({ x: 0, y: 0 }); }); reader.readAsDataURL(e.target.files[0]); e.target.value = null; };
  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), []);
  const handleSaveCrop = async () => { const webpData = await getCroppedImgWebP(currentImageSrc, croppedAreaPixels); setCroppedImages((p) => [...p, webpData]); setIsCropping(false); setCurrentImageSrc(null); };
  
  const handleUploadKomoditas = async (e) => { e.preventDefault(); if (userProfile?.verificationStatus !== "verified") return toast.error("Akun belum diverifikasi!"); if (croppedImages.length === 0) return toast.error("Upload 1 foto!"); const tId = toast.loading("Mengupload..."); setLoading(true); try { const urls = await Promise.all(croppedImages.map(async (item, i) => { const fileRef = ref(storage, `products/${user.uid}/${Date.now()}_${i}.webp`); await uploadBytes(fileRef, item.file); return await getDownloadURL(fileRef); })); await addDoc(collection(db, "products"), { farmerId: user.uid, farmerName: user.displayName, farmerPhone: phone, sellerRole: "Petani Raw Material", nama_komoditas: namaKomoditas, kategori, berat_ton: Number(beratTon), harga_per_ton: Number(hargaPerTon), kadar_air: kadarAir, kadar_karbon: kadarKarbon, deskripsi, fotoUrls: urls, status: "tersedia", lokasi: { alamat_text: alamatText, lat: pinLocation.lat, lng: pinLocation.lng }, createdAt: serverTimestamp() }); toast.success("Publikasi berhasil!", { id: tId }); setNamaKomoditas(""); setCroppedImages([]); setActiveTab("etalase"); } catch(err) { toast.error("Gagal upload", {id: tId}) } finally { setLoading(false); } };
  const handleToggleStatus = async (id, stat) => { await updateDoc(doc(db, "products", id), { status: stat === "tersedia" ? "terjual" : "tersedia" }); };
  const handleDeleteProduct = async (id) => { if (window.confirm("Hapus komoditas?")) await deleteDoc(doc(db, "products", id)); };

  const isVerified = userProfile?.verificationStatus === "verified";
  
  const hasUnreadBuyer = buyerOrders.some(o => o.unreadChat?.[user?.uid]);
  const hasUnreadSeller = sellerOrders.some(o => o.unreadChat?.[user?.uid]);

  const TabButton = ({ id, icon: Icon, label, count, hasUnread }) => ( 
    <button onClick={() => setActiveTab(id)} className={`relative py-4 px-1 inline-flex items-center gap-2 border-b-2 font-semibold text-sm transition-colors whitespace-nowrap ${activeTab === id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
      <Icon className="w-4 h-4" /> {label} 
      {count !== undefined && <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] ${activeTab === id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{count}</span>}
      {hasUnread && <span className="absolute top-3 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-6 overflow-x-auto no-scrollbar">
            <TabButton id="etalase" icon={Store} label="Etalase Saya" count={products.length} />
            <TabButton id="pesanan_masuk" icon={ArrowUpFromLine} label="Pesanan Masuk" count={sellerOrders.length} hasUnread={hasUnreadSeller} />
            <TabButton id="belanja" icon={ArrowDownToLine} label="Belanjaan Saya" count={buyerOrders.length} hasUnread={hasUnreadBuyer} />
            <TabButton id="upload" icon={UploadCloud} label="Jual Komoditas" />
            <TabButton id="dompet" icon={Wallet} label="Dompet" />
            <TabButton id="profil" icon={Settings} label="Pengaturan Akun" />
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 mt-4">
        {!isVerified && (
          <div className="mb-8 bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3"><div className="bg-amber-100 p-2 rounded-xl"><AlertTriangle className="w-5 h-5 text-amber-600" /></div><div><h4 className="font-bold text-slate-900">Akun Belum Terverifikasi</h4><p className="text-sm text-slate-600">Lengkapi profil dan ajukan verifikasi agar dapat berjualan.</p></div></div>
            <button onClick={() => setActiveTab("profil")} className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold">Buka Profil</button>
          </div>
        )}

        {/* TAB 1: BELANJAAN (PEMBELI) */}
        {activeTab === "belanja" && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-extrabold text-slate-900">Pengadaan Bahan Mentah</h2>
            {buyerOrders.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed rounded-3xl"><ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-bold">Belum ada pembelian</h3></div>
            ) : (
              <div className="space-y-5">
                {buyerOrders.map((item) => (
                  <div key={item.id} className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">TRX: {item.id.slice(0,8)}</span>
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 uppercase flex items-center gap-1">{item.shippingMethod === "pickup" ? <Store className="w-3 h-3"/> : <Truck className="w-3 h-3"/>} {item.shippingMethod === "pickup" ? "Ambil Sendiri" : "Diantar Penjual"}</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900">{item.productName} ({item.totalTon} Ton)</h3>
                        <p className="text-sm text-slate-600">Pemasok: <span className="font-semibold text-slate-900">{item.farmerName}</span></p>
                      </div>
                      <div className="text-left md:text-right mt-3 md:mt-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total Tagihan</p>
                        <p className={`text-xl font-black ${item.status === "CANCELLED" ? "text-slate-400 line-through" : "text-green-600"}`}>Rp {item.totalPrice?.toLocaleString()}</p>
                        {item.shippingCost > 0 && <p className="text-[10px] text-slate-500 font-medium">Kargo + Ongkir (Rp {item.shippingCost?.toLocaleString()})</p>}
                      </div>
                    </div>
                    
                    <OrderTimelineTracker status={item.status} />

                    {item.status === "SHIPPED" && (
                      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mt-2 shadow-md border border-slate-800">
                        <div className="flex items-start gap-4">
                          {item.fotoSuratJalan ? ( <a href={item.fotoSuratJalan} target="_blank" rel="noreferrer" className="block shrink-0 relative group"><img src={item.fotoSuratJalan} className="w-16 h-16 rounded-xl object-cover border-2 border-slate-700"/><div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><ZoomIn className="w-5 h-5 text-white"/></div></a> ) : ( <Truck className="w-8 h-8 text-blue-400 shrink-0"/> )}
                          <div><p className="text-sm font-bold text-blue-400 mb-1">Kargo Tiba? Lakukan Pengecekan</p><p className="text-xs text-slate-300">Nopol: <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-white">{item.no_polisi}</span></p></div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                           <button onClick={() => setDisputeOrder(item)} className="bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-xl text-sm font-bold w-full sm:w-auto transition-colors">Ajukan Kendala</button>
                           <button onClick={()=>handleTerimaKargo(item)} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl text-sm font-bold w-full sm:w-auto transition-colors">Kargo Sesuai (Terima)</button>
                        </div>
                      </div>
                    )}

                    {item.status === "DISPUTE" && (
                       <div className="bg-red-50 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 mt-2 border border-red-200">
                          <div>
                            <p className="text-sm font-bold text-red-700">Dana Escrow Dibekukan Sementara</p>
                            <p className="text-xs text-red-600 mt-1">Alasan Kendala: {item.disputeReason}</p>
                          </div>
                          <button onClick={() => setChatOrder(item)} className="relative bg-slate-900 text-white px-6 py-3 rounded-xl text-sm font-bold w-full sm:w-auto flex items-center justify-center gap-2">
                            <MessageCircle className="w-4 h-4"/> Buka Chat Resolusi
                            {item.unreadChat?.[user?.uid] && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                          </button>
                       </div>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-center mt-2 gap-3">
                      {item.status !== "DISPUTE" && (
                        <button onClick={() => setChatOrder(item)} className="relative w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2.5 rounded-xl transition-colors">
                          <MessageCircle className="w-4 h-4"/> Chat Platform
                          {item.unreadChat?.[user?.uid] && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                        </button>
                      )}
                      
                      <div className="w-full sm:w-auto flex flex-wrap justify-end gap-2">
                        {item.status === "AWAITING_SHIPPING_COST" && (
                          <><button onClick={()=>handleBatalkanPesanan(item)} className="w-full sm:w-auto bg-white border hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-bold">Batalkan Pesanan</button><span className="w-full sm:w-auto text-xs font-bold text-amber-600 bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200 text-center">{item.proposedShippingCost ? "⏳ Menunggu Penjual Membalas Nego" : "⏳ Menunggu Penjual Menghitung Ongkir"}</span></>
                        )}
                        {item.status === "WAITING_PAYMENT_SIMULATION" && (
                          <><button onClick={()=>handleBatalkanPesanan(item)} className="bg-white border px-4 py-2.5 rounded-xl text-sm font-bold">Batalkan</button>
                          {item.shippingMethod === "delivery" && item.shippingCost > 0 && (item.negoCount || 0) < 3 && (<button onClick={() => setNegoOrder(item)} className="bg-white border border-blue-200 hover:bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl text-sm font-bold">Nego Ongkir ({(item.negoCount || 0)}/3)</button>)}
                          <button onClick={()=>handleBayarEscrow(item)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg">Bayar Tagihan Escrow</button></>
                        )}
                        {item.status === "ESCROW_RELEASED" && !item.rating && <button onClick={()=>setReviewOrder(item)} className="bg-white border text-slate-900 px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-400 fill-amber-400"/> Beri Penilaian</button>}
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
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-extrabold text-slate-900">Pesanan Masuk</h2>
            {sellerOrders.length === 0 ? (
              <div className="text-center py-20 bg-white border border-dashed rounded-3xl"><Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-bold">Belum ada pesanan</h3></div>
            ) : (
              <div className="space-y-4">
                {sellerOrders.map(item => (
                  <div key={item.id} className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col md:flex-row justify-between gap-6 hover:shadow-md transition-all">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded">TRX: {item.id.slice(0,8)}</span>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 uppercase flex items-center gap-1">{item.shippingMethod === "pickup" ? <Store className="w-3 h-3"/> : <Truck className="w-3 h-3"/>} {item.shippingMethod === "pickup" ? "Ambil Sendiri" : "Minta Diantar"}</span>
                        {item.status === "CANCELLED" && <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 uppercase">DIBATALKAN</span>}
                      </div>
                      <h3 className="text-xl font-black text-slate-900">{item.productName} ({item.totalTon} Ton)</h3>
                      <p className="text-sm text-slate-600">Pembeli: <span className="font-semibold text-slate-900">{item.buyerName}</span></p>
                      {item.shippingMethod === "delivery" && <p className="text-xs text-slate-500 mt-1 flex items-start gap-1"><MapPin className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0"/> {item.deliveryAddress}</p>}
                    </div>

                    <div className="w-full md:w-64 flex flex-col justify-between items-start md:items-end">
                      <div className="text-left md:text-right mb-4 md:mb-0">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Total Tagihan (Kargo + Ongkir)</p>
                        <p className={`text-xl font-black ${item.status === "CANCELLED" ? "text-slate-400 line-through" : "text-green-600"}`}>Rp {item.totalPrice?.toLocaleString()}</p>
                      </div>
                      <div className="w-full text-right mt-auto flex flex-col items-end gap-2">
                        
                        {item.status === "DISPUTE" && (
                           <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-left w-full">
                              <p className="text-xs font-bold text-red-700">Pembeli Mengajukan Kendala</p>
                              <p className="text-xs text-red-600 mb-3">{item.disputeReason}</p>
                              <button onClick={() => setChatOrder(item)} className="relative bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold w-full flex items-center justify-center gap-2">
                                <MessageCircle className="w-4 h-4"/> Chat Pembeli
                                {item.unreadChat?.[user?.uid] && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                              </button>
                           </div>
                        )}

                        {item.status === "AWAITING_SHIPPING_COST" && (
                          <div className="flex flex-col items-end">
                            {item.proposedShippingCost && <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg mb-2 border border-blue-100">Pembeli Nego: Rp {item.proposedShippingCost.toLocaleString()}</span>}
                            <button onClick={() => setOngkirOrder(item)} className="w-full md:w-auto bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2"><Calculator className="w-4 h-4"/> {item.proposedShippingCost ? "Tanggapi Nego" : "Input Biaya Ongkir"}</button>
                          </div>
                        )}
                        {item.status === "WAITING_PAYMENT_SIMULATION" && <span className="inline-flex text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border">⏳ Menunggu Pembeli Bayar</span>}
                        {item.status === "PAID_ESCROW" && <button onClick={() => setShippingOrder(item)} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2"><Truck className="w-4 h-4"/> Berangkatkan Kargo</button>}
                        {item.status === "SHIPPED" && <div className="text-right"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-200 mb-2"><Truck className="w-4 h-4"/> Mengantar ke Lokasi</span><br/><a href={item.fotoSuratJalan} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><FileText className="w-3 h-3"/> Lihat Surat Jalan</a></div>}
                        {(item.status === "CARGO_DELIVERED" || item.status === "ESCROW_RELEASED") && <span className="inline-flex text-xs font-bold text-green-700 bg-green-50 px-3 py-2 rounded-xl border border-green-200"><Check className="w-4 h-4"/> Transaksi Selesai</span>}
                        
                        {item.status !== "DISPUTE" && item.status !== "CANCELLED" && (
                           <button onClick={() => setChatOrder(item)} className="relative w-full md:w-auto flex items-center justify-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg transition-colors">
                             <MessageCircle className="w-3.5 h-3.5"/> Chat Pembeli
                             {item.unreadChat?.[user?.uid] && <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                           </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ETALASE */}
        {activeTab === "etalase" && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-2xl font-extrabold text-slate-900">Etalase Komoditas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map(item => (
                <div key={item.id} className="bg-white rounded-2xl border overflow-hidden shadow-sm flex flex-col group">
                  <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden"><img src={item.fotoUrls[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/><div className="absolute top-3 left-3 bg-white/90 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase">{item.status}</div></div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg mb-4 line-clamp-1">{item.nama_komoditas}</h3>
                    <div className="mt-auto space-y-3">
                      <div className="flex justify-between items-end"><div className="text-xs text-slate-500 font-medium">Stok<p className="text-slate-900 font-bold text-base">{item.berat_ton} Ton</p></div><div className="text-xs text-slate-500 font-medium text-right">Harga / Ton<p className="text-green-600 font-black text-base">Rp {item.harga_per_ton?.toLocaleString()}</p></div></div>
                      <div className="grid grid-cols-2 gap-2 pt-4 border-t"><button onClick={()=>handleToggleStatus(item.id, item.status)} className="w-full bg-slate-50 border py-2 rounded-xl text-xs font-bold">{item.status === "tersedia" ? "Tandai Terjual" : "Tandai Tersedia"}</button><button onClick={()=>handleDeleteProduct(item.id)} className="w-full bg-red-50 text-red-600 border py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5"/> Hapus</button></div>
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
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-sm"><div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5"><Lock className="w-8 h-8 text-slate-400" /></div><h3 className="text-xl font-black text-slate-900 mb-2">Akses Terkunci</h3><p className="text-slate-500 mb-8">Admin perlu memverifikasi rekening bank Anda sebelum Anda dapat mengupload komoditas.</p><button onClick={() => setActiveTab("profil")} className="bg-slate-900 text-white font-bold py-3 px-8 rounded-xl shadow-lg">Lengkapi Profil</button></div>
            ) : (
              <form onSubmit={handleUploadKomoditas} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div><h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Jual Komoditas</h2></div>
                <div className="space-y-4">
                  <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Nama Komoditas</label><input type="text" value={namaKomoditas} onChange={e=>setNamaKomoditas(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" required/></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Kategori</label><select value={kategori} onChange={e=>setKategori(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"><option value="Limbah Pertanian">Limbah Pertanian</option><option value="Biochar / Arang">Biochar / Arang</option><option value="Karbon Aktif">Karbon Aktif</option><option value="Wood Pellet">Wood Pellet</option></select></div>
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Stok (Ton)</label><input type="number" step="0.1" value={beratTon} onChange={e=>setBeratTon(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" required/></div>
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Harga/Ton (Rp)</label><input type="number" value={hargaPerTon} onChange={e=>setHargaPerTon(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none" required/></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5"><FlaskConical className="w-4 h-4 text-amber-500"/> Kadar Air (%)</label><input type="text" value={kadarAir} onChange={e=>setKadarAir(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"/></div>
                    <div><label className="block text-sm font-semibold text-slate-900 mb-1.5 flex items-center gap-1.5"><FlaskConical className="w-4 h-4 text-purple-500"/> Kadar Karbon (%)</label><input type="text" value={kadarKarbon} onChange={e=>setKadarKarbon(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"/></div>
                  </div>
                  <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50/50">
                    <label className="block text-sm font-semibold text-slate-900 mb-3 flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-blue-500"/> Foto Komoditas</label>
                    <label className="inline-flex items-center gap-2 bg-white border border-slate-200 px-5 py-3 rounded-xl cursor-pointer shadow-sm"><UploadCloud className="w-4 h-4"/> Pilih Foto<input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" /></label>
                    {croppedImages.length > 0 && (<div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-3">{croppedImages.map((img, index) => (<div key={index} className="relative aspect-[4/3] rounded-xl overflow-hidden border"><img src={img.previewUrl} className="w-full h-full object-cover" /><button type="button" onClick={() => setCroppedImages(p => p.filter((_, i) => i !== index))} className="absolute top-1 right-1 bg-white p-1 rounded-full"><X className="w-3 h-3"/></button></div>))}</div>)}
                  </div>
                  <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Deskripsi Lengkap</label><textarea rows="3" value={deskripsi} onChange={e=>setDeskripsi(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"></textarea></div>
                  
                  <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""} libraries={["places", "geocoding"]}>
                    <LocationPickerWithReverseGeocode pinLocation={pinLocation} setPinLocation={setPinLocation} alamatText={alamatText} setAlamatText={setAlamatText} />
                  </APIProvider>
                  
                  <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50">Publikasikan ke Marketplace</button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 5: DOMPET */}
        {activeTab === "dompet" && <WalletDashboard orders={sellerOrders} bankDetails={bankDetails} />}

        {/* TAB 6: PROFIL */}
        {activeTab === "profil" && (
          <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
                <div><h2 className="text-2xl font-extrabold text-slate-900">Profil & Rekening</h2></div>
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${isVerified ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{isVerified ? "Terverifikasi" : "Belum Verifikasi"}</div>
              </div>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">No. WhatsApp / Telepon</label><input type="text" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"/></div>
                <div><label className="block text-sm font-semibold text-slate-900 mb-1.5">Alamat Lengkap</label><input type="text" value={alamatLahan} onChange={e=>setAlamatLahan(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"/></div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
                  <h4 className="font-bold text-sm text-slate-800">Detail Rekening Pencairan</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Nama Bank</label><select value={bankDetails.bankCode} onChange={e=>setBankDetails({...bankDetails, bankCode: e.target.value})} className="w-full p-3 border rounded-lg outline-none"><option value="BCA">BCA</option><option value="MANDIRI">Mandiri</option><option value="BRI">BRI</option></select></div>
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Rekening</label><input type="number" value={bankDetails.accountNumber} onChange={e=>setBankDetails({...bankDetails, accountNumber: e.target.value})} className="w-full p-3 border rounded-lg outline-none"/></div>
                    <div><label className="block text-xs font-semibold text-slate-700 mb-1">Atas Nama (Pemilik)</label><input type="text" value={bankDetails.accountName} onChange={e=>setBankDetails({...bankDetails, accountName: e.target.value})} className="w-full p-3 border rounded-lg outline-none"/></div>
                  </div>
                </div>
                <div className="pt-4 flex gap-4"><button type="submit" className="flex-1 bg-white border font-bold py-3.5 rounded-xl">Simpan Data</button>{!isVerified && <button type="button" onClick={handleAjukanVerifikasi} className="flex-1 bg-slate-900 text-white font-bold py-3.5 rounded-xl">Ajukan Verifikasi</button>}</div>
              </form>
            </div>
          </div>
        )}
      </main>

      <InputOngkirModal order={ongkirOrder} onClose={() => setOngkirOrder(null)} />
      <ShippingProofModal order={shippingOrder} onClose={() => setShippingOrder(null)} />
      <NegoOngkirModal order={negoOrder} onClose={() => setNegoOrder(null)} />
      <DisputeModal order={disputeOrder} onClose={() => setDisputeOrder(null)} />
      <OrderChatModal order={chatOrder} currentUser={user} onClose={() => setChatOrder(null)} />
    </div>
  );
}