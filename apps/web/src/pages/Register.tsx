import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [form, setForm] = useState({ email: "", username: "", displayName: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const nav = useNavigate();
  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const go = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try { await register(form); nav("/"); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-primary)" }}>
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden"
        style={{ background: "var(--accent)" }}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 75% 75%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="text-center z-10 px-12">
          <h1 className="text-6xl font-extrabold text-white mb-4 tracking-tight">Join Capsule</h1>
          <p className="text-xl text-white/80 font-medium">Create. Connect. Collaborate.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--accent)" }}>Capsule</h1>
          </div>

          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Launch Capsule</h2>
          <p className="mb-8" style={{ color: "var(--text-muted)", fontSize: "14px" }}>Get started with Capsule</p>

          {error && (
            <div className="fade-in mb-4 px-4 py-3 text-sm font-medium rounded-xl"
              style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <form onSubmit={go} className="space-y-4">
            {[
              { key: "email", type: "email", label: "Email", ph: "you@example.com" },
              { key: "username", type: "text", label: "Username", ph: "coolname42" },
              { key: "displayName", type: "text", label: "Display Name", ph: "Your Name" },
              { key: "password", type: "password", label: "Password", ph: "Min 8 chars, letters + numbers" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>{f.label}</label>
                <input type={f.type} required value={form[f.key]} onChange={upd(f.key)}
                  minLength={f.key === "password" ? 8 : undefined}
                  className="w-full px-4 py-3 rounded-xl outline-none text-sm font-medium transition-all focus:ring-2"
                  style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border)", color: "var(--text-primary)", boxShadow: "var(--shadow-sm)" }}
                  placeholder={f.ph} />
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover-lift disabled:opacity-50"
              style={{ background: "var(--accent)" }}>
              {loading ? "Creating..." : "Launch Capsule"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Have an account? <Link to="/login" className="font-semibold hover:underline" style={{ color: "var(--accent)" }}>Enter here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
