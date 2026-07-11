import React from "react";
import { useAuth } from "@/context/AuthContext";

export default function PetaniPage() {
  const { logout } = useAuth();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-green-700">[PORTAL PETANI]</h1>
      <p className="my-2">Di sini nanti tempat Petani upload stok limbah tani & pin lokasi Google Maps.</p>
      <button onClick={logout} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">Logout</button>
    </div>
  );
}