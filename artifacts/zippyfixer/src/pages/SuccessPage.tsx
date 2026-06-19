import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import LeegoFooter from "@/components/LeegoFooter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function SuccessPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [downloadToken, setDownloadToken] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    fetch(`${BASE}/api/checkout/verify/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.paid && data.downloadToken) {
          setDownloadToken(data.downloadToken);
          setEmail(data.email || "");
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  }, [sessionId]);

  const downloadUrl = `${BASE}/api/checkout/download/${downloadToken}`;

  return (
    <div className="min-h-screen bg-[#060a0f] text-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-lg w-full text-center">
          {status === "loading" && (
            <>
              <div className="w-16 h-16 border-2 border-[#00ff88]/30 border-t-[#00ff88] rounded-full animate-spin mx-auto mb-6" />
              <p className="text-white/50">Verifying your payment…</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-5xl mb-6">⚠️</div>
              <h1 className="text-2xl font-bold mb-3">Payment not found</h1>
              <p className="text-white/40 mb-8">
                If you just paid, wait a moment and refresh. If this persists,
                contact support with your Stripe receipt.
              </p>
              <a href="/" className="text-[#00ff88] underline underline-offset-4 text-sm">← Back to ZippyFixer</a>
            </>
          )}

          {status === "ready" && (
            <>
              {/* Success glow */}
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-40 rounded-full bg-[#00ff88]/15 blur-3xl" />
                </div>
                <div className="relative text-6xl">🎉</div>
              </div>

              <h1 className="text-3xl font-extrabold mb-3">
                You're all set<span className="text-[#00ff88]">!</span>
              </h1>
              {email && (
                <p className="text-white/40 text-sm mb-8">Receipt sent to {email}</p>
              )}

              <div className="bg-white/[0.03] border border-[#00ff88]/20 rounded-2xl p-8 mb-6 text-left space-y-4">
                <h2 className="font-semibold text-white mb-4 text-center">How to get started</h2>
                {[
                  { n: "1", t: "Download ZippyFixer", d: "Click the button below to get your ZIP file." },
                  { n: "2", t: "Unzip and install", d: "Run install.sh (Mac/Linux) or install.bat (Windows) — it handles everything." },
                  { n: "3", t: "Start testing", d: "Run start.sh and open http://localhost:3747 in your browser." },
                  { n: "4", t: "Connect GitHub & Railway", d: "Paste your tokens in Settings — ZippyFixer will read your repos and fix bugs." },
                ].map(s => (
                  <div key={s.n} className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                    <div>
                      <p className="font-medium text-white text-sm">{s.t}</p>
                      <p className="text-xs text-white/40">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href={downloadUrl}
                className="btn-shimmer text-black font-bold text-lg px-10 py-4 rounded-xl inline-block transition-opacity hover:opacity-90 mb-4"
              >
                ⬇ Download ZippyFixer.zip
              </a>

              <p className="text-xs text-white/20">
                This link is unique to your purchase. Don't share it.
              </p>
            </>
          )}
        </div>
      </div>
      <LeegoFooter />
    </div>
  );
}
