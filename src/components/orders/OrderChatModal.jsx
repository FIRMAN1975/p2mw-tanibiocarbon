import React, { useState, useEffect, useRef } from "react";
import { X, Send, AlertTriangle, CheckCircle } from "lucide-react";
import { db } from "@/config/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";

export default function OrderChatModal({ order, currentUser, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const bottomRef = useRef(null);

  const isBuyer = currentUser.uid === order?.buyerId;
  const chatPartnerName = isBuyer ? order?.farmerName : order?.buyerName;
  const chatPartnerId = isBuyer ? order?.farmerId : order?.buyerId;

  // FITUR BARU: Tandai pesan sudah dibaca saat modal chat dibuka
  useEffect(() => {
    if (order && order.unreadChat?.[currentUser.uid]) {
      updateDoc(doc(db, "orders", order.id), {
        [`unreadChat.${currentUser.uid}`]: false
      }).catch(console.error);
    }
  }, [order, currentUser.uid]);

  // Ambil pesan real-time
  useEffect(() => {
    if (!order) return;
    const q = query(collection(db, "orders", order.id, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return () => unsubscribe();
  }, [order]);

  // Fungsi Kirim Pesan
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const text = newMessage;
    setNewMessage(""); 
    try {
      await addDoc(collection(db, "orders", order.id, "messages"), {
        text: text,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        createdAt: serverTimestamp(),
      });
      
      // FITUR BARU: Beritahu database bahwa lawan bicara punya pesan baru
      await updateDoc(doc(db, "orders", order.id), {
        [`unreadChat.${chatPartnerId}`]: true
      });
    } catch (error) {
      toast.error("Gagal mengirim pesan.");
    }
  };

  const handleSelesaikanKendala = async () => {
    if (!window.confirm("Apakah masalah sudah selesai dan Anda bersedia meneruskan dana Escrow ke penjual?")) return;
    const toastId = toast.loading("Menyelesaikan kendala...");
    try {
      await updateDoc(doc(db, "orders", order.id), {
        status: "CARGO_DELIVERED",
        resolvedAt: serverTimestamp()
      });
      toast.success("Kendala ditutup. Transaksi Selesai!", { id: toastId });
      onClose();
    } catch (error) {
      toast.error("Gagal memproses", { id: toastId });
    }
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl h-[85vh] sm:h-[80vh] overflow-hidden shadow-2xl flex flex-col">
        
        {/* HEADER CHAT */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h3 className="text-lg font-black text-slate-900 line-clamp-1">{order.productName}</h3>
            <p className="text-xs text-slate-500 font-medium">Chat dengan: <span className="font-bold text-slate-700">{chatPartnerName}</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition"><X className="w-5 h-5" /></button>
        </div>

        {order.status === "DISPUTE" && (
          <div className="bg-red-50 border-b border-red-100 p-4 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-red-700 font-bold text-sm mb-1">
                <AlertTriangle className="w-4 h-4"/> Transaksi dalam Kendala
              </div>
              <p className="text-xs text-red-600">Alasan: {order.disputeReason}</p>
            </div>
            {isBuyer && (
              <button onClick={handleSelesaikanKendala} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition shrink-0 flex items-center gap-1.5 shadow-sm">
                <CheckCircle className="w-3.5 h-3.5"/> Selesai & Cairkan Dana
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-slate-400 text-sm mt-10">Belum ada pesan. Silakan mulai percakapan.</div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentUser.uid;
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-slate-400 mb-1 ml-1">{msg.senderName}</span>
                  <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm shadow-sm ${isMe ? "bg-slate-900 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"}`}>
                    {msg.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white shrink-0 flex gap-3">
          <input 
            type="text" placeholder="Ketik pesan..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
          />
          <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors shadow-sm">
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>

      </div>
    </div>
  );
}