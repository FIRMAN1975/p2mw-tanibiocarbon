const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

admin.initializeApp();
const db = getFirestore();

// ⚠️ Secret Key Xendit Anda (Hati-hati, kunci ini bersifat sangat rahasia)
const XENDIT_SECRET_KEY = "xnd_development_JEG1bGTYGuyG80Qdy3cnw7HNVFeEDsDC3lEbXnfcdtUB1s4M02Ai61YtQoylvyw";

// --- 1. ENDPOINT: BUAT INVOICE PEMBAYARAN ---
exports.createXenditInvoice = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { orderId, buyerEmail } = req.body;
  if (!orderId) return res.status(400).json({ error: "Order ID wajib dikirim" });

  try {
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
        success_redirect_url: "https://tanibiocarbon-323eb.web.app/mitra",
        failure_redirect_url: "https://tanibiocarbon-323eb.web.app/mitra",
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
      const orderRef = db.collection("orders").doc(orderId);
      const orderSnap = await orderRef.get();

      if (!orderSnap.exists) {
        console.warn(`[WARNING] Order ID ${orderId} tidak ada di database.`);
        return res.status(200).json({
          status: "SUCCESS_TEST",
          message: `ID "${orderId}" tidak ada di DB, tapi Webhook berhasil terhubung sempurna!`,
        });
      }

      await orderRef.update({
        status: "PAID_ESCROW",
        paidAt: FieldValue.serverTimestamp(),
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

// --- 3. ENDPOINT: PENCAIRAN DANA KE PETANI (DISBURSEMENT) ---
exports.releaseEscrow = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: "Order ID wajib dikirim" });

  try {
    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Pesanan tidak ditemukan" });
    }

    const orderData = orderSnap.data();

    if (orderData.status !== "PAID_ESCROW" && orderData.status !== "CARGO_ARRIVED" && orderData.status !== "CARGO_DELIVERED") {
      return res.status(400).json({ error: "Pesanan belum siap dicairkan" });
    }

    const sellerRef = db.collection("users").doc(orderData.farmerId);
    const sellerSnap = await sellerRef.get();
    const sellerData = sellerSnap.data();

    if (!sellerData || !sellerData.bankDetails) {
      return res.status(400).json({ error: "Petani belum mengatur rekening pencairan!" });
    }

    const { bankCode, accountName, accountNumber } = sellerData.bankDetails;

    // Hitung Potongan Komisi (Platform ambil 4%)
    const grossAmount = orderData.totalPrice;
    const platformFee = Math.floor(grossAmount * 0.04);
    const netAmount = grossAmount - platformFee;

    console.log(`Mencairkan Rp${netAmount} ke ${bankCode} ${accountNumber} (${accountName})`);

    const response = await axios.post(
      "https://api.xendit.co/disbursements",
      {
        external_id: `disb_${orderId}`,
        amount: netAmount,
        bank_code: bankCode,
        account_holder_name: accountName,
        account_number: accountNumber,
        description: `Pencairan Escrow TaniBioCarbon - Pesanan ${orderId}`,
      },
      {
        auth: {
          username: XENDIT_SECRET_KEY,
          password: "",
        },
      }
    );

    await orderRef.update({
      status: "ESCROW_RELEASED",
      disbursementId: response.data.id,
      platformFee: platformFee,
      netAmountToSeller: netAmount,
      releasedAt: FieldValue.serverTimestamp(),
    });

    res.status(200).json({ message: "Berhasil mencairkan dana!", disbursement: response.data });
  } catch (error) {
    console.error("Xendit Disbursement Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Gagal mencairkan dana", detail: error.response?.data || error.message });
  }
});


// --- 4. ENDPOINT BARU: VALIDASI NAMA REKENING BANK ---
exports.checkBankAccount = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { bankCode, accountNumber } = req.body;
  if (!bankCode || !accountNumber) {
    return res.status(400).json({ error: "Kode bank dan nomor rekening wajib diisi" });
  }

  try {
    const response = await axios.post(
      "https://api.xendit.co/bank_account_data_requests",
      {
        bank_code: bankCode,
        bank_account_number: accountNumber
      },
      {
        auth: {
          username: XENDIT_SECRET_KEY,
          password: ""
        }
      }
    );

    // Xendit biasanya mengembalikan status COMPLETED atau PENDING.
    // Jika PENDING tapi bank_account_name sudah terisi, kita langsung tangkap.
    const accountName = response.data.bank_account_name;
    
    if (accountName) {
      return res.status(200).json({ accountName: accountName });
    } else {
      return res.status(400).json({ error: "Rekening tidak ditemukan atau tidak valid" });
    }
  } catch (error) {
    console.error("Xendit Check Bank Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Gagal mengecek rekening. Pastikan nomor benar." });
  }
});