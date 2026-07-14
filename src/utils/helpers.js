// Menghitung Jarak (KM) Akurat Antar 2 Titik Koordinat
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; 
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };
  
  // Mengubah nomor HP menjadi Link WhatsApp dengan pesan otomatis
  export const formatWhatsAppLink = (phone, message) => {
    if (!phone) return "#";
    let cleaned = phone.toString().replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "62" + cleaned.slice(1);
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
  };