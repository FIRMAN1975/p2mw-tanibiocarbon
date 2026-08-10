import React, { useState, useEffect, useRef } from "react";
import { X, Truck, ShieldCheck, MapPin, Store } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/config/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { APIProvider, Map, Marker, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";

function DeliveryLocationPicker({ pinLocation, setPinLocation, address, setAddress }) {
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
        setPinLocation({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }); 
        setAddress(place.formatted_address || place.name); 
        if (map) map.panTo({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      }
    });
  }, [placeAutocomplete, setPinLocation, setAddress, map]);

  const handleMapClick = (ev) => {
    if (!ev.detail.latLng) return;
    setPinLocation({ lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng });
    if (geocoder) geocoder.geocode({ location: { lat: ev.detail.latLng.lat, lng: ev.detail.latLng.lng } }, (res, status) => { 
      if (status === "OK" && res[0]) setAddress(res[0].formatted_address); 
    });
  };

  return (
    <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
      <label className="block text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5"><Truck className="w-4 h-4 text-amber-500" /> Titik Lokasi Pabrik Penerima</label>
      <input ref={inputRef} type="text" placeholder="Cari alamat pabrik tujuan kargo..." value={address} onChange={e => setAddress(e.target.value)} className="w-full p-3.5 border border-slate-200 rounded-xl text-sm mb-4 focus:ring-2 focus:ring-slate-900 outline-none transition-all bg-white shadow-sm"/>
      <div className="w-full h-48 rounded-xl overflow-hidden relative border border-slate-200 shadow-inner">
        <Map defaultCenter={pinLocation} defaultZoom={13} onClick={handleMapClick} gestureHandling="greedy">
          <Marker position={pinLocation} />
        </Map>
      </div>
    </div>
  );
}

export default function CheckoutModal({ isOpen, onClose, product, user, userData }) {
  const [quantity, setQuantity] = useState(1);
  const [shippingMethod, setShippingMethod] = useState("delivery"); // 'delivery' atau 'pickup'
  const [address, setAddress] = useState("");
  const [pinLocation, setPinLocation] = useState({ lat: -6.200000, lng: 106.816666 });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && userData) {
      if (userData.alamat_lahan) setAddress(userData.alamat_lahan);
      if (userData.lokasi) setPinLocation(userData.lokasi);
      setQuantity(1);
      setShippingMethod("delivery");
    }
  }, [isOpen, userData]);

  if (!isOpen || !product) return null;

  const cargoPrice = quantity * product.harga_per_ton;

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (quantity < 1 || quantity > product.berat_ton) return toast.error(`Jumlah harus antara 1 hingga ${product.berat_ton} Ton`);
    if (shippingMethod === "delivery" && !address.trim()) return toast.error("Alamat pengiriman wajib diisi!");

    setIsProcessing(true);
    const toastId = toast.loading("Memproses pesanan Anda...");

    try {
      // 1. Tentukan status awal berdasarkan metode pengiriman
      const initialStatus = shippingMethod === "delivery" ? "AWAITING_SHIPPING_COST" : "WAITING_PAYMENT_SIMULATION";

      const orderData = {
        productId: product.id,
        productName: product.nama_komoditas,
        farmerId: product.farmerId,
        farmerName: product.farmerName,
        farmerPhone: product.farmerPhone,
        buyerId: user.uid,
        buyerName: user.displayName,
        buyerEmail: user.email,
        shippingMethod: shippingMethod,
        deliveryAddress: shippingMethod === "delivery" ? address : "Ambil di tempat penjual",
        deliveryLocation: shippingMethod === "delivery" ? { lat: pinLocation.lat, lng: pinLocation.lng } : null,
        totalTon: Number(quantity),
        pricePerTon: product.harga_per_ton,
        cargoPrice: cargoPrice,
        shippingCost: 0, 
        totalPrice: cargoPrice, // Nanti ditambah ongkir jika delivery
        status: initialStatus,
        createdAt: serverTimestamp(),
      };

      const orderRef = await addDoc(collection(db, "orders"), orderData);

      // Potong stok
      const sisaStok = product.berat_ton - quantity;
      await updateDoc(doc(db, "products", product.id), {
        berat_ton: sisaStok,
        status: sisaStok <= 0 ? "terjual" : "tersedia" 
      });

      // 2. Jika minta diantar, STOP di sini. Jangan panggil Xendit.
      if (shippingMethod === "delivery") {
        toast.success("Pesanan dikirim! Menunggu penjual memasukkan ongkos kirim.", { id: toastId });
        setIsProcessing(false);
        onClose();
        return;
      }

      // 3. Jika ambil sendiri (pickup), langsung bayar Escrow
      toast.loading("Membuka halaman pembayaran Xendit...", { id: toastId });
      const functionUrl = import.meta.env.VITE_API_CREATE_INVOICE;
      if (!functionUrl) throw new Error("URL API Create Invoice belum disetting di .env");

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderRef.id, buyerEmail: user.email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat invoice Xendit");

      toast.success("Mengarahkan ke Kasir...", { id: toastId });
      window.location.href = data.invoiceUrl;

    } catch (error) {
      console.error("Checkout Error:", error);
      toast.error(error.message || "Terjadi kesalahan saat checkout", { id: toastId });
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div><h3 className="text-lg font-black text-slate-900">Purchase Order Kargo</h3><p className="text-xs text-slate-500 font-medium">Sistem Pembayaran Escrow</p></div>
          <button onClick={onClose} disabled={isProcessing} className="p-2 bg-white hover:bg-slate-200 rounded-full transition-colors text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="flex gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <img src={product.fotoUrls?.[0] || "/placeholder.jpg"} className="w-20 h-20 object-cover rounded-xl shadow-sm" />
            <div>
              <h4 className="font-bold text-slate-900 line-clamp-1">{product.nama_komoditas}</h4>
              <p className="text-xs text-slate-500 mb-1">Pemasok: {product.farmerName}</p>
              <p className="text-sm font-black text-green-600">Rp {product.harga_per_ton.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/ Ton</span></p>
            </div>
          </div>

          <form id="checkout-form" onSubmit={handleCheckout} className="space-y-5">
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className="text-sm font-semibold text-slate-900">Jumlah Pembelian (Ton)</label>
                <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Tersedia: {product.berat_ton} Ton</span>
              </div>
              <input type="number" min="1" max={product.berat_ton} step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-slate-900 outline-none transition-all" required disabled={isProcessing}/>
            </div>

            {/* OPSI PENGIRIMAN */}
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Metode Pengiriman</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShippingMethod("delivery")} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${shippingMethod === "delivery" ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200"}`}>
                  <Truck className={`w-6 h-6 mb-1 ${shippingMethod === "delivery" ? "text-slate-900" : "text-slate-400"}`} />
                  <span className={`text-xs font-bold ${shippingMethod === "delivery" ? "text-slate-900" : "text-slate-500"}`}>Minta Diantar</span>
                </button>
                <button type="button" onClick={() => setShippingMethod("pickup")} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${shippingMethod === "pickup" ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-200"}`}>
                  <Store className={`w-6 h-6 mb-1 ${shippingMethod === "pickup" ? "text-slate-900" : "text-slate-400"}`} />
                  <span className={`text-xs font-bold ${shippingMethod === "pickup" ? "text-slate-900" : "text-slate-500"}`}>Ambil Sendiri</span>
                </button>
              </div>
            </div>

            {shippingMethod === "delivery" && (
              <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""} libraries={["places", "geocoding"]}>
                <DeliveryLocationPicker pinLocation={pinLocation} setPinLocation={setPinLocation} address={address} setAddress={setAddress} />
              </APIProvider>
            )}
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-slate-500">Total Harga Kargo</span>
            <span className="text-2xl font-black text-slate-900">Rp {cargoPrice.toLocaleString()}</span>
          </div>
          
          <div className="flex items-start gap-2 mb-4 bg-blue-50 text-blue-700 p-3 rounded-xl text-xs font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5"/>
            {shippingMethod === "delivery" 
              ? <p>Karena Anda meminta diantar, penjual akan menghitung ongkos kirim terlebih dahulu sebelum Anda dapat membayar.</p>
              : <p>Dana Escrow akan diamankan platform sampai Anda tiba di lokasi dan memuat kargo ke truk Anda sendiri.</p>
            }
          </div>
          
          <button type="submit" form="checkout-form" disabled={isProcessing} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-all">
            {isProcessing ? "Memproses..." : shippingMethod === "delivery" ? "Ajukan Pesanan & Ongkir" : "Lanjutkan ke Pembayaran"}
          </button>
        </div>
      </div>
    </div>
  );
}