const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
// --- INI SOLUSINYA: Menggunakan impor modular resmi Firebase Admin terbaru ---
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

admin.initializeApp();
// --- Inisialisasi database menggunakan cara baru ---
const db = getFirestore();

// ⚠️ MASUKKAN SECRET KEY XENDIT ANDA DI BAWAH INI (awalan: xnd_development_...):
const XENDIT_SECRET_KEY = "xnd_development_JEG1bGTYGuyG80Qdy3cnw7HNVFeEDsDC3lEbXnfcdtUB1s4M02Ai61YtQoylvyw";

// --- 1. ENDPOINT: BUAT INVOICE PEMBAYARAN ---
exports.createXenditInvoice = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { orderId, buyerEmail } = req.body;
  if (!orderId) return res.status(400).json({ error: "Order ID wajib dikirim" });

  try {
    // Menggunakan variabel 'db' yang baru
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Pesanan tidak ditemukan di database" });
    }

    const orderData = orderSnap.data();

    if (orderData.status !== "WAITING_PAYMENT_SIMULATION") {
      return res.status(400).json({ error: "Pesanan ini sudah dibayar atau diproses." });
    }

    const response = await axios.post(
      "https://api.xendit.co/v2/invoices",
      {
        external_id: orderId,
        amount: orderData.totalPrice,
        payer_email: buyerEmail || orderData.buyerName,
        description: `Pembayaran Escrow Kargo: ${orderData.productName} (${orderData.totalTon} Ton)`,
        invoice_duration: 86400,
        success_redirect_url: "http://localhost:5173/mitra",
        failure_redirect_url: "http://localhost:5173/mitra",
      },
      {
        auth: {
          username: XENDIT_SECRET_KEY,
          password: "",
        },
      }
    );

    await orderRef.update({
      xenditInvoiceId: response.data.id,
      xenditInvoiceUrl: response.data.invoice_url,
    });

    res.status(200).json({ invoiceUrl: response.data.invoice_url });
  } catch (error) {
    console.error("Xendit API Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Gagal membuat invoice Xendit" });
  }
});

// --- 2. ENDPOINT: WEBHOOK OTOMATIS DARI XENDIT ---
exports.xenditWebhook = onRequest({ cors: false, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const xenditEvent = req.body;

  if (xenditEvent.status === "PAID") {
    const orderId = xenditEvent.external_id;

    try {
      console.log(`[WEBHOOK] Menerima sinyal PAID untuk Order ID: ${orderId}`);

      // Menggunakan variabel 'db' yang baru
      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();

      // 1. CEK DOKUMEN: Jika ini adalah tes dari Dasbor Xendit (ID tidak ada di DB)
      if (!orderSnap.exists) {
        console.warn(`[WARNING] Order ID ${orderId} tidak ada di database.`);
        // LANGSUNG KEMBALIKAN 200 OK AGAR TES XENDIT BERHASIL!
        return res.status(200).json({
          status: "SUCCESS_TEST",
          message: `ID "${orderId}" tidak ada di DB, tapi Webhook berhasil terhubung sempurna!`,
        });
      }

      // 2. Jika dokumen asli ditemukan di Firestore, update statusnya!
      await orderRef.update({
        status: "PAID_ESCROW",
        paidAt: FieldValue.serverTimestamp(), // <-- Menggunakan FieldValue modular
        paymentChannel: xenditEvent.payment_channel || "Xendit VA",
        paymentMethod: xenditEvent.payment_method || "BANK_TRANSFER",
      });

      res.status(200).json({ message: "Webhook sukses & database diperbarui!" });
    } catch (error) {
      console.error("Firestore Webhook Error:", error);
      res.status(500).json({
        error: "Gagal mengupdate database",
        penyebab_asli: error.message || error.toString(),
      });
    }
  } else {
    res.status(200).send("Status bukan PAID, diabaikan.");
  }
});