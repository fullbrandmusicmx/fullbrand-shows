"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function handleLogin() {
    setMsg("Cargando...");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg("❌ " + error.message);
      return;
    }

    setMsg("✅ Login correcto");
    router.replace("/dashboard");
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "80px auto",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <h1 style={{ fontSize: 22, fontWeight: 800 }}>
        Fullbrand • Shows
      </h1>

      <p style={{ opacity: 0.7 }}>Inicia sesión</p>

      <input
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        placeholder="Contraseña"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>Entrar</button>

      {msg && <p>{msg}</p>}
    </div>
  );
}
