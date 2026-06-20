import { Router } from "express";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";
import { db, purchases } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
}

function getBaseUrl(req: any) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  return `${req.protocol}://${req.get("host")}`;
}

router.post("/create-session", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    const stripe = getStripe();
    const base = getBaseUrl(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 49700,
            product_data: {
              name: "ReviewGuard — AI Beta Testing Tool",
              description:
                "Standalone AI-powered QA tool with GitHub & Railway integration. One-time purchase, runs locally. Bring your own AI key (OpenAI, Anthropic, Groq, OpenRouter).",
              images: [],
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/`,
      metadata: { email },
    });

    await db.insert(purchases).values({
      email,
      stripeSessionId: session.id,
      downloadToken: "",
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    logger.error({ err }, "checkout session creation failed");
    return res.status(500).json({ error: err.message || "Checkout failed" });
  }
});

router.get("/verify/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Payment not complete", paid: false });
    }

    const [existing] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSessionId, sessionId))
      .limit(1);

    if (existing && existing.downloadToken) {
      return res.json({ paid: true, downloadToken: existing.downloadToken, email: existing.email });
    }

    const token = randomBytes(32).toString("hex");

    if (existing) {
      await db
        .update(purchases)
        .set({ downloadToken: token, stripePaymentIntentId: session.payment_intent as string })
        .where(eq(purchases.stripeSessionId, sessionId));
    } else {
      await db.insert(purchases).values({
        email: session.customer_email || session.metadata?.email || "",
        stripeSessionId: sessionId,
        stripePaymentIntentId: session.payment_intent as string,
        downloadToken: token,
      });
    }

    return res.json({ paid: true, downloadToken: token, email: session.customer_email });
  } catch (err: any) {
    logger.error({ err }, "verify purchase failed");
    return res.status(500).json({ error: err.message || "Verification failed" });
  }
});

router.get("/download/:token", async (req, res) => {
  const { token } = req.params;

  if (!token || token.length < 32) {
    return res.status(403).json({ error: "Invalid download token" });
  }

  try {
    const [purchase] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.downloadToken, token))
      .limit(1);

    if (!purchase) {
      return res.status(403).json({ error: "Invalid or expired download token" });
    }

    const zipPath = path.resolve(process.cwd(), "reviewguard.zip");

    if (!fs.existsSync(zipPath)) {
      return res.status(503).json({ error: "Download not yet available — contact support" });
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="ReviewGuard.zip"');
    return fs.createReadStream(zipPath).pipe(res);
  } catch (err: any) {
    logger.error({ err }, "download failed");
    return res.status(500).json({ error: "Download failed" });
  }
});

export default router;
