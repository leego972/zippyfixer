import { useState, useRef, useEffect, useCallback } from "react";

export default function LeegoFooter() {
  const [expanded, setExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const startMatrixRain = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(1);
    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*";
    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        const brightness = Math.random();
        if (brightness > 0.95) ctx.fillStyle = "#fff";
        else if (brightness > 0.8) ctx.fillStyle = "#0f0";
        else ctx.fillStyle = `rgba(0, ${Math.floor(150 + brightness * 105)}, 0, ${0.6 + brightness * 0.4})`;
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, []);

  const stopMatrixRain = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0; }
  }, []);

  const handleClick = () => {
    if (expanded) return;
    setExpanded(true);
    startMatrixRain();
    timeoutRef.current = setTimeout(() => { setExpanded(false); stopMatrixRain(); }, 5000);
  };

  useEffect(() => {
    if (!expanded) return;
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [expanded]);

  useEffect(() => {
    return () => { stopMatrixRain(); if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [stopMatrixRain]);

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 z-[9998] pointer-events-none" style={{ background: "rgba(0,0,0,0.92)" }}>
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>
      )}
      <div className="w-full flex flex-col justify-center items-center py-10 mt-auto relative z-[9999] border-t border-white/10">
        <p className="text-xs text-white/30 mb-4 tracking-widest uppercase">Created by</p>
        <img
          src="/leego-logo-transparent.png"
          alt="Created by Leego — Virelle Studios"
          onClick={handleClick}
          className={`object-contain select-none transition-transform duration-700 ease-in-out ${
            expanded
              ? "h-20 scale-[2.5] cursor-default"
              : "h-20 scale-100 cursor-pointer hover:scale-110"
          }`}
          draggable={false}
          style={{
            filter: expanded
              ? "drop-shadow(0 0 20px rgba(0,255,0,0.8)) drop-shadow(0 0 60px rgba(0,255,0,0.4))"
              : "drop-shadow(0 0 8px rgba(255,255,255,0.15))",
          }}
        />
        <p className="text-xs text-white/20 mt-4">© 2026 Virelle Studios · ZippyFixer</p>
      </div>
    </>
  );
}
