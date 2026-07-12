const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Xendit } = require("xendit-node"); // Perhatikan kurung kurawal di sini
const cors = require("cors")({ origin: true });

// Nyalakan SDK Admin Firebase
admin.initializeApp();

// MASUKKAN API KEY XENDIT SANDBOX KAMU DI SINI
const XENDIT_SECRET_KEY = "xnd_development_dMkgdK7Rk1AOBVLE0PcgRkBvr2yV1l0KN6lQAW12a2S8sNsDX7A8QMQBpU7I";

// Inisialisasi Xendit versi SDK terbaru
const xenditClient = new Xendit({ secretKey: XENDIT_SECRET_KEY });

exports.createEscrowInvoice = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    // Pastikan metode request adalah POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Metode tidak diizinkan. Gunakan POST." });
    }

    try {
      const { orderId, amount, buyerEmail, description } = req.body;

      // 1. Validasi Input Dasar
      if (!orderId || !amount || !buyerEmail) {
        return res.status(400).json({ error: "Data transaksi tidak lengkap." });
      }

      // 2. Buat Payload sesuai aturan SDK terbaru
      const data = {
        externalId: orderId, // Menggunakan camelCase (externalId) di versi baru
        amount: Number(amount),
        payerEmail: buyerEmail,
        description: description || "Pembayaran Escrow TaniBioCarbon",
        invoiceDuration: 86400,
        successRedirectUrl: "http://localhost:5173/mitra?status=success", // camelCase
        failureRedirectUrl: "http://localhost:5173/mitra?status=failed"    // camelCase
      };

      // 3. Tembak ke API Xendit menggunakan metode v3 terbaru
      const responseFromXendit = await xenditClient.Invoice.createInvoice({ data });

      // 4. Catat Transaksi Awal ke Database Firestore (Status: PENDING)
      await admin.firestore().collection("transactions").doc(orderId).set({
        orderId: orderId,
        amount: Number(amount),
        buyerEmail: buyerEmail,
        xenditInvoiceId: responseFromXendit.id,
        invoiceUrl: responseFromXendit.invoiceUrl, // v3 menggunakan invoiceUrl (bukan URL kapital)
        status: "PENDING_PAYMENT",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 5. Kembalikan URL Invoice ke Frontend React
      return res.status(200).json({
        message: "Invoice Escrow Berhasil Dibuat",
        invoiceUrl: responseFromXendit.invoiceUrl
      });

    } catch (error) {
      console.error("Xendit Error Details:", error);
      return res.status(500).json({
        error: "Gagal membuat invoice di Xendit",
        details: error.message
      });
    }
  });
});