import { useState, type FormEvent } from "react";
import { pb } from "../lib/pocketbase";

/**
 * Sign-in + self-serve sign-up against the one shared `users` collection.
 * Safe to open up because every game's data is owner-scoped by API rules
 * (owner = @request.auth.id) — a freshly signed-up user just starts with
 * zero tracked accounts.
 */
export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length < 8) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await pb.collection("users").authWithPassword(email, password);
      } else {
        await pb.collection("users").create({ email, password, passwordConfirm: password });
        await pb.collection("users").authWithPassword(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 dark:bg-[#0a0a0c]">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
      >
        <h1 className="mb-1 text-xl font-semibold">Kirayu Tracker</h1>
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          {mode === "signin" ? "Sign in to view your tracked accounts" : "Create an account to get started"}
        </p>
        <label className="mb-1 block text-xs font-semibold">Email</label>
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-3 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700"
        />
        <label className="mb-1 block text-xs font-semibold">Password</label>
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="mb-4 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-indigo-400 dark:border-zinc-700"
        />

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-indigo-600 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="mt-4 block w-full text-center text-xs text-zinc-400 hover:text-indigo-500 dark:text-zinc-500 dark:hover:text-indigo-400"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
