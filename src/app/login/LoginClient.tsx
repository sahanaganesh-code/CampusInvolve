"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendLink() {
    setLoading(true);
    setMsg(null);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      setMsg("Check your email for the sign-in link.");
    } catch (e: any) {
      setMsg(e.message ?? "Failed to send link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ margin: 0 }}>Sign in</h1>
      <p style={{ marginTop: 8 }}>We’ll email you a magic link.</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@wisc.edu"
          style={{ padding: 12, width: 320 }}
        />
        <button onClick={sendLink} disabled={loading || !email}>
          {loading ? "Sending..." : "Send link"}
        </button>
      </div>

      {msg ? <p style={{ marginTop: 12 }}>{msg}</p> : null}
    </main>
  );
}