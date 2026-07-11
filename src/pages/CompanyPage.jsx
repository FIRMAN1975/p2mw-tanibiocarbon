import React from "react";
import { useAuth } from "@/context/AuthContext";

export default function CompanyPage() {
  const { logout } = useAuth();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-purple-700">[PORTAL BUYER / COMPANY]</h1>
      <p className="my-2">Di sini nanti tempat manufaktur besar beli biocarbon olahan dari Mitra via Xendit.</p>
      <button onClick={logout} className="mt-4 bg-red-500 text-white px-4 py-2 rounded">Logout</button>
    </div>
  );
}