import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Mail, Lock, Sprout, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

export default function AuthModal({ isOpen, onOpenChange, onSuccess }) {
  const { login } = useAuth(); // Asumsikan Anda punya fungsi login di AuthContext
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password); // Sesuaikan dengan fungsi Firebase Auth Anda
      toast.success("Login berhasil!");
      onOpenChange(false);
      if (onSuccess) onSuccess(); // Lanjutkan aksi sebelumnya (misal: Beli Barang)
    } catch (error) {
      toast.error("Gagal login. Periksa email & sandi Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-slate-200 bg-white p-6 shadow-2xl sm:rounded-2xl animate-in zoom-in-95 duration-200">
          
          <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
              <div className="bg-green-100 p-2 rounded-lg"><Sprout className="w-5 h-5 text-green-700" /></div>
              <Dialog.Title className="text-xl font-bold tracking-tight text-slate-900">Masuk ke Akun</Dialog.Title>
            </div>
            <Dialog.Description className="text-sm text-slate-500">
              Silakan masuk untuk bertransaksi atau mengelola pasokan Anda di TaniBioCarbon.
            </Dialog.Description>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email Publik</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="flex h-10 w-full rounded-xl border border-slate-300 bg-transparent px-10 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" placeholder="nama@perusahaan.com" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Kata Sandi</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="flex h-10 w-full rounded-xl border border-slate-300 bg-transparent px-10 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:pointer-events-none mt-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Masuk Sekarang"}
            </button>
          </form>

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2">
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}