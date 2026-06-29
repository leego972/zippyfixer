import { useState } from "react";
import LeegoFooter from "@/components/LeegoFooter";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const BASE = API_ORIGIN || import.meta.env.BASE_URL.replace(/\/$/, "");

const CHECKS = [
  "Website/app flow review",
  "Broken links and missing assets",
  "Mobile layout issues",
  "SEO and page-speed basics",
  "Security-header basics",
  "Repair-ready report",
];

const HOW = [
  { step: "01", title: "Enter your email", desc: "Start checkout through the same Stripe account used for VIBA." },
  { step: "02", title: "Run a review", desc: "Reviewer+ checks the site or app and produces a clear report." },
  { step: "03", title: "Fix what matters", desc: "Use the repair checklist or upgrade into VIBA for deeper build support." },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${BASE}/api/checkout/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060a0f] text-white overflow-x-hidden">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#060a0f]/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/reviewguard-logo.jpeg" alt="Reviewer+" className="h-9 w-9 rounded-lg object-cover" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#00ff88]">Reviewer</span>+
            </span>
            <span className="text-[10px] font-mono text-[#00ff88]/60 border border-[#00ff88]/20 rounded px-1.5 py-0.5">
              POWERED BY VIBA
            </span>
          </div>
          <a href="#buy" className="btn-shimmer text-black font-semibold text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-90">
            Start Reviewer+
          </a>
        </div>
      </nav>

      <section className="relative pt-32 pb-24 px-6 bg-grid overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[800px] rounded-full bg-[#00ff88]/5 blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-8">
            <img src="/reviewguard-logo.jpeg" alt="Reviewer+" className="h-28 w-28 rounded-2xl object-cover shadow-[0_0_40px_rgba(99,102,241,0.4)]" />
          </div>

          <div className="inline-flex items-center gap-2 border border-[#00ff88]/25 bg-[#00ff88]/5 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] pulse-dot" />
            <span className="text-xs font-mono text-[#00ff88]/80 tracking-wide">SIMPLE WEBSITE · APP · BUILD REVIEW</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
            <span className="gradient-text">Reviewer+</span>
            <br />
            <span className="text-white/90">Check your build</span>
            <br />
            <span className="text-white/90">before customers do.</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            Reviewer+ is the simple VIBA-powered review product for testing websites,
            apps, and software builds, then producing a repair-ready report.
          </p>

          <div id="buy" className="max-w-md mx-auto">
            <form onSubmit={handleCheckout} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/25 focus:outline-none focus:border-[#00ff88]/50 focus:ring-1 focus:ring-[#00ff88]/30 transition"
              />
              {error && <p className="text-red-400 text-sm text-left">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-shimmer text-black font-bold text-lg py-4 rounded-xl transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Redirecting to checkout…" : "Start with Reviewer+"}
              </button>
              <p className="text-xs text-white/25 text-center">
                Secure Stripe checkout · Credits can sync with VIBA when configured
              </p>
            </form>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple review. <span className="gradient-text">Clear fixes.</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              Keep this product focused: test, identify issues, and produce a useful repair checklist.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CHECKS.map((item) => (
              <div key={item} className="feature-card bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                <div className="text-[#00ff88] text-2xl mb-3">✓</div>
                <h3 className="font-semibold text-white">{item}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How it <span className="gradient-text">works</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HOW.map((h) => (
              <div key={h.step} className="p-6 bg-white/[0.03] border border-white/8 rounded-2xl">
                <span className="text-4xl font-black text-[#00ff88]/20 font-mono">{h.step}</span>
                <h3 className="font-semibold text-white mt-4 mb-2">{h.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start with <span className="gradient-text">Reviewer+</span>
          </h2>
          <p className="text-white/40 mb-10">
            Use Reviewer+ as the entry product. Upgrade into VIBA when you need the full AI command center.
          </p>

          <div className="glow-green border border-[#00ff88]/25 bg-[#00ff88]/5 rounded-3xl p-10 mb-6">
            <ul className="text-left space-y-3 mb-10 text-sm text-white/60">
              {CHECKS.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-[#00ff88] mt-0.5 shrink-0">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <form onSubmit={handleCheckout} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-[#00ff88]/50 transition"
              />
              {error && <p className="text-red-400 text-sm text-left">{error}</p>}
              <button type="submit" disabled={loading} className="btn-shimmer text-black font-bold text-lg py-4 rounded-xl transition-opacity disabled:opacity-60">
                {loading ? "Redirecting…" : "Start Reviewer+"}
              </button>
            </form>
          </div>

          <p className="text-xs text-white/20">Secure checkout via Stripe · VIBA upgrade path supported</p>
        </div>
      </section>

      <LeegoFooter />
    </div>
  );
}
