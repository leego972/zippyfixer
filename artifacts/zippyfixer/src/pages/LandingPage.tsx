import { useState } from "react";
import LeegoFooter from "@/components/LeegoFooter";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const BASE = API_ORIGIN || import.meta.env.BASE_URL.replace(/\/$/, "");

const FEATURES = [
  {
    icon: "🧠",
    title: "AI-Driven Browser Testing",
    desc: "Groq-powered AI clicks every button, fills every form, and navigates every page — just like a real user would.",
  },
  {
    icon: "🐙",
    title: "GitHub Integration",
    desc: "AI reads your source code, creates fix branches, commits patches, and opens PRs — bugs get squashed automatically.",
  },
  {
    icon: "🚂",
    title: "Railway Integration",
    desc: "Check deployment status, read runtime logs, and trigger redeploys — all in the same testing session.",
  },
  {
    icon: "🔍",
    title: "Deep Bug Detection",
    desc: "Broken links, missing images, console errors, JS crashes, accessibility violations — nothing escapes ReviewGuard.",
  },
  {
    icon: "📸",
    title: "Screenshot Evidence",
    desc: "Every bug comes with a screenshot. Full visual report so you know exactly what went wrong and where.",
  },
  {
    icon: "📋",
    title: "Instant Bug Reports",
    desc: "Professional reports exported in seconds. Share with your team or log directly as GitHub Issues.",
  },
];

const HOW = [
  { step: "01", title: "Paste your URL", desc: "Point ReviewGuard at any website — staging, production, or localhost." },
  { step: "02", title: "AI tests everything", desc: "Groq AI navigates the site, clicks around, and hunts for bugs like a senior QA engineer." },
  { step: "03", title: "Fixes pushed to GitHub", desc: "Found a bug? AI reads the code, writes the fix, and opens a PR — all without you lifting a finger." },
  { step: "04", title: "Full report delivered", desc: "Get a clean bug report with severity ratings, screenshots, and recommended next steps." },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE}/api/checkout/create-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060a0f] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#060a0f]/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/reviewguard-logo.jpeg" alt="ReviewGuard" className="h-9 w-9 rounded-lg object-cover" />
            <span className="text-xl font-bold tracking-tight">
              <span className="text-[#00ff88]">Review</span>Guard
            </span>
            <span className="text-[10px] font-mono text-[#00ff88]/60 border border-[#00ff88]/20 rounded px-1.5 py-0.5">EARLY ACCESS</span>
          </div>
          <a
            href="#buy"
            className="btn-shimmer text-black font-semibold text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
          >
            Get ReviewGuard — $497
          </a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-24 px-6 bg-grid overflow-hidden">
        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[800px] rounded-full bg-[#00ff88]/5 blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src="/reviewguard-logo.jpeg" alt="ReviewGuard" className="h-28 w-28 rounded-2xl object-cover shadow-[0_0_40px_rgba(99,102,241,0.4)]" />
          </div>

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 border border-[#00ff88]/25 bg-[#00ff88]/5 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] pulse-dot" />
            <span className="text-xs font-mono text-[#00ff88]/80 tracking-wide">AI-POWERED · BRING YOUR OWN KEY · ONE-TIME PRICE</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
            <span className="gradient-text">ReviewGuard</span>
            <br />
            <span className="text-white/90">Your All-In-One</span>
            <br />
            <span className="text-white/90">Beta Tester!</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            An AI that clicks every button, finds every bug, reads your GitHub code,
            writes the fixes, and deploys — all before your morning coffee.
          </p>

          {/* CTA form */}
          <div id="buy" className="max-w-md mx-auto">
            <form onSubmit={handleCheckout} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-white/25 focus:outline-none focus:border-[#00ff88]/50 focus:ring-1 focus:ring-[#00ff88]/30 transition"
              />
              {error && <p className="text-red-400 text-sm text-left">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-shimmer text-black font-bold text-lg py-4 rounded-xl transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Redirecting to checkout…" : "Buy Now — $497 One-Time"}
              </button>
              <p className="text-xs text-white/25 text-center">
                Instant download after payment · Runs locally · No subscription
              </p>
            </form>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-white/30 font-mono">
            <span>✓ Playwright browser automation</span>
            <span>✓ GitHub read · write · merge PRs</span>
            <span>✓ Railway MCP integration</span>
            <span>✓ Login & API key extraction</span>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything your QA team does —{" "}
              <span className="gradient-text">automated</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              ReviewGuard combines a real Chromium browser, GitHub code access, and
              Groq AI to test, fix, and deploy — all in one tool.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="feature-card bg-white/[0.03] border border-white/8 rounded-2xl p-6"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-24 px-6 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How it <span className="gradient-text">works</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {HOW.map(h => (
              <div key={h.step} className="flex gap-5 p-6 bg-white/[0.03] border border-white/8 rounded-2xl">
                <span className="text-4xl font-black text-[#00ff88]/20 font-mono shrink-0">{h.step}</span>
                <div>
                  <h3 className="font-semibold text-white mb-1">{h.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-lg mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            One price. <span className="gradient-text">Forever yours.</span>
          </h2>
          <p className="text-white/40 mb-10">No subscriptions. No limits. Runs on your machine.</p>

          <div className="glow-green border border-[#00ff88]/25 bg-[#00ff88]/5 rounded-3xl p-10 mb-6">
            <div className="flex items-end justify-center gap-2 mb-2">
              <span className="text-7xl font-black text-white">$497</span>
              <span className="text-white/30 mb-3 text-lg">one-time</span>
            </div>
            <p className="text-white/50 text-sm mb-2">Pay once. Own it forever. <span className="text-[#00ff88]/70">vs $3,000+/yr for competitors.</span></p>
            <p className="text-white/30 text-xs mb-8">Bring your own AI key (OpenAI · Anthropic · Groq · OpenRouter)</p>

            <ul className="text-left space-y-3 mb-10 text-sm text-white/60">
              {[
                "Full standalone Node.js app — runs on your machine",
                "Real Chromium browser via Playwright",
                "Logs into sites to find your API keys automatically",
                "GitHub: read code, write fixes, open & merge PRs",
                "Railway MCP: auto-discover & trigger deployments",
                "SEO, accessibility, performance & mobile checks",
                "Live project log — every bug, fix & action tracked",
                "Works with any AI provider you already pay for",
                "Unlimited sites · All future updates included",
              ].map(item => (
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
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-[#00ff88]/50 transition"
              />
              {error && <p className="text-red-400 text-sm text-left">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="btn-shimmer text-black font-bold text-lg py-4 rounded-xl transition-opacity disabled:opacity-60"
              >
                {loading ? "Redirecting…" : "Buy ReviewGuard — $497"}
              </button>
            </form>
          </div>

          <p className="text-xs text-white/20">
            Secure checkout via Stripe · Instant ZIP download after payment
          </p>
        </div>
      </section>

      {/* ── Leego Footer ── */}
      <LeegoFooter />
    </div>
  );
}
