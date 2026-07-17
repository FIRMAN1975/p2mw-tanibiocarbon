import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Sprout, LogOut, Menu, X, ChevronDown, UserCircle } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import AuthModal from "@/components/auth/AuthModal";

export default function Navbar() {
  const { user, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleDashboardRedirect = () => {
    if (userData?.role === "petani") navigate("/petani");
    else if (userData?.role === "mitra") navigate("/mitra");
    else if (userData?.role === "admin") navigate("/admin");
  };

  return (
    <>
      <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
              <div className="bg-slate-900 p-1.5 rounded-lg"><Sprout className="w-5 h-5 text-green-400" /></div>
              <span className="font-bold text-lg tracking-tight text-slate-900">TaniBioCarbon</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Marketplace</Link>
              
              {user ? (
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 transition focus:outline-none">
                      <UserCircle className="w-5 h-5 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-800">{user.displayName || "Akun Saya"}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="end" className="w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50 animate-in fade-in zoom-in-95">
                      <DropdownMenu.Label className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Role: {userData?.role}
                      </DropdownMenu.Label>
                      <DropdownMenu.Item onClick={handleDashboardRedirect} className="flex items-center px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-100 rounded-lg outline-none">
                        Masuk Dashboard
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="h-px bg-slate-100 my-1" />
                      <DropdownMenu.Item onClick={logout} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 cursor-pointer hover:bg-red-50 rounded-lg outline-none">
                        <LogOut className="w-4 h-4" /> Keluar
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              ) : (
                <button onClick={() => setIsAuthModalOpen(true)} className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-bold text-white transition-colors hover:bg-slate-800 focus:outline-none">
                  Masuk / Daftar
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Slide-down */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white p-4 space-y-3 animate-in slide-in-from-top-2">
            <Link to="/" onClick={()=>setIsMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-base font-semibold text-slate-800 hover:bg-slate-50">Marketplace</Link>
            {user ? (
              <>
                <button onClick={() => { handleDashboardRedirect(); setIsMobileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-base font-semibold text-blue-600 hover:bg-blue-50">Buka Dashboard Saya</button>
                <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg text-base font-semibold text-red-600 hover:bg-red-50">Keluar Akun</button>
              </>
            ) : (
              <button onClick={() => { setIsAuthModalOpen(true); setIsMobileMenuOpen(false); }} className="w-full bg-slate-900 text-white rounded-xl py-3 font-bold">Masuk / Daftar</button>
            )}
          </div>
        )}
      </nav>

      <AuthModal isOpen={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} />
    </>
  );
}