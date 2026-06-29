import { useEffect, useState } from "react";
import LeegoFooter from "@/components/LeegoFooter";

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const BASE = API_ORIGIN || import.meta.env.BASE_URL.replace(/\/$/, "");

type VerifyResponse = {
  paid?: boolean;
  downloadToken?: string;
  email?: string;
  upgradeUrl?: string;
};

export default function SuccessPage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [downloadToken, setDownloadToken] = useState("");
  const [email, setEmail] = useState("");
  const [upgradeUrl, setUpgradeUrl] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      return;
    }

    fetch(`${BASE}/api/checkout/verify/${sessionId}`)
      .then((r) => r.json())
      .then((data: VerifyResponse) => {
        if (data.paid && data.downloadToken) {
          setDownloadToken(data.downloadToken);
          setEmail(data.email || "");
          setUpgradeUrl(data.upgradeUrl || "");
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
              <a href="/" className="text-[#00ff88] underline underline-offset-4 text-sm">← Back to Reviewer+</a>
            </>
          )}

          {status === "ready" && (
            <>
              <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-40 h-40 rounded-full bg-[#00ff88]/15 blur-3xl" />
                </div>
                <div className="relative text-6xl">✓</div>
              </div>

              <h1 className="text-3xl font-extrabold mb-3">
                Reviewer+ is ready<span className="text-[#00ff88]">.</span>
              </h1>
              {email && <p className="text-white/40 text-sm mb-8">Receipt sent to {email}</p>}

              <div className="bg-white/[0.03] border border-[#00ff88]/20 rounded-2xl p-8 mb-6 text-left space-y-4">
                <h2 className="font-semibold text-white mb-4 text-center">Next steps</h2>
                {[
                  { n: "1", t: "Download Reviewer+", d: "Use your secure purchase link below." },
                  { n: "2", t: "Run the review", d: "Test the site or app and generate the repair-ready report." },
                  { n: "3", t: "Upgrade only if needed", d: "Move into VIBA when you need the full AI command center." },
                ].map((s) => (
                  <div key={s.n} className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                    <div>
                      <p className="font-medium text-white text-sm">{s.t}</p>
                      <p className="text-xs text-white/40">{s.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a href={downloadUrl} className="btn-shimmer text-black font-bold text-lg px-10 py-4 rounded-xl inline-block transition-opacity hover:opacity-90 mb-4">
                ⬇ Download Reviewer+
              </a>

              {upgradeUrl && (
                <a href={upgradeUrl} className="block text-[#00ff88] underline underline-offset-4 text-sm mt-2">
                  Upgrade to VIBA
                </a>
              )}

              <p className="text-xs text-white/20 mt-4">
                This link is unique to your purchase. Do not share it.
              </p>
            </>
          )}
        </div>
      </div>
      <LeegoFooter />
    </div>
  );
}
