import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-vault-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-semibold text-brass">DocVault</p>
          <p className="mt-1 text-sm text-zinc-500">Secure document manager</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-vault-700 bg-vault-900 p-6">
          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-md border border-vault-600 bg-vault-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-brass"
          />

          <label className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-md border border-vault-600 bg-vault-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-brass"
          />

          {error && <p className="mb-4 text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brass py-2 text-sm font-medium text-vault-950 transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
