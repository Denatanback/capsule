import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const nav = useNavigate();

  const go = async (e: any) => {
    e.preventDefault();
    setLoading(true); setError("");
    try { await login(email, password); nav("/"); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      {/* Left visual */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden"
        style={{ background: "var(--accent)" }}>
        <div className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 30%, white 1.5px, transparent 1.5px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)", backgroundSize: "60px 60px, 40px 40px" }} />
        <div className="text-center z-10 px-12">
          <Logo size={80} className="mx-auto mb-6" />
          <h1 className="text-5xl font-extrabold text-white mb-3 tracking-tight">Capsule</h1>
          <p className="text-lg text-white/70 font-medium">Your encrypted space to connect.</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-extrabold gradient-text">Capsule</h1>
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Welcome back</h2>
          <p className="mb-8 text-sm" style={{ color: "var(--text-muted)" }}>Sign in to your capsule</p>

          {error && (
            <div className="fade-in mb-4 px-4 py-3 text-sm font-medium rounded-xl"
              style={{ background: "rgba(244,63,94,0.1)", color: "var(--danger)", border: "1px solid rgba(244,63,94,0.2)" }}>
              {error}
            </div>
          )}

          <form onSubmit={go} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-capsule w-full px-4 py-3 text-sm font-medium" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="input-capsule w-full px-4 py-3 text-sm font-medium" placeholder="Your password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover-lift disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              {loading ? "Entering capsule..." : "Enter Capsule"}
            </button>
          </form>

          <div className="mt-4">
            <a href="/api/auth/google"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover-lift"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--bg-secondary)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </a>
          </div>

          <p className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            New here? <Link to="/register" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>Create a capsule</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
