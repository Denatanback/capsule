import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export default function AuthCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const fetchUser = useAuthStore((s) => s.fetchUser);
  useEffect(() => {
    const token = params.get("token");
    const refresh = params.get("refresh");
    if (token) {
      localStorage.setItem("capsule_token", token);
      if (refresh) localStorage.setItem("capsule_refresh", refresh);
      fetchUser().then(() => nav("/"));
    } else {
      nav("/login");
    }
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Signing you in...</p>
    </div>
  );
}
