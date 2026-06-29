import { Router } from "express";
import { randomBytes } from "crypto";
import path from "path";
import fs from "fs";
import { db, purchases } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

const REVIEWER_PLUS_PRODUCT_CODE = "reviewer_plus";
const DEFAULT_REVIEWER_PLUS_PRICE_USD_CENTS = 49700;
const DEFAULT_REVIEWER_PLUS_CREDITS = 1;

type StripeSessionLike = {
  id: string;
  url: string | null;
  payment_status?: string | null;
  customer?: string | { id?: string | null } | null;
  customer_email?: string | null;
  payment_intent?: string | { id?: string | null } | null;
  metadata?: Record<string, string | null> | null;
};

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  // Keep this dependency local to the checkout route so the simple app only loads Stripe when needed.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require("stripe");
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" });
}

function getBaseUrl(req: { protocol: string; get(name: string): string | undefined }) {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/$/, "");
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  return `${req.protocol}://${req.get("host")}`;
}

function getNumberEnv(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getStringId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const maybeId = (value as { id?: unknown }).id;
    return typeof maybeId === "string" ? maybeId : undefined;
  }
  return undefined;
}

function getReviewerPlusLineItem() {
  const vibaPriceId =
    process.env.STRIPE_REVIEWER_PLUS_PRICE_ID ||
    process.env.VIBA_REVIEWER_PLUS_PRICE_ID ||
    process.env.STRIPE_PRICE_ID;

  if (vibaPriceId) {
    return [{ price: vibaPriceId, quantity: 1 }];
  }

  const unitAmount = getNumberEnv(
    "REVIEWER_PLUS_PRICE_USD_CENTS",
    DEFAULT_REVIEWER_PLUS_PRICE_USD_CENTS,
  );

  return [
    {
      price_data: {
        currency: "usd",
        unit_amount: unitAmount,
        product_data: {
          name: "Reviewer+ — VIBA Website/App Review",
          description:
            "Simple AI review product powered by VIBA: audit, test, and generate a repair-ready report.",
          images: [],
        },
      },
      quantity: 1,
    },
  ];
}

function getVibaUpgradeUrl(email: string) {
  const raw = process.env.VIBA_UPGRADE_URL?.trim();
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    url.searchParams.set("source", REVIEWER_PLUS_PRODUCT_CODE);
    url.searchParams.set("email", email);
    return url.toString();
  } catch {
    return raw;
  }
}

async function syncVibaCredits(params: {
  email: string;
  stripeSessionId: string;
  stripeCustomerId?: string;
  stripePaymentIntentId?: string;
}) {
  const syncUrl = process.env.VIBA_CREDITS_SYNC_URL || process.env.VIBA_CREDIT_SYNC_URL;
  if (!syncUrl) return { skipped: true };

  const payload = {
    productCode: REVIEWER_PLUS_PRODUCT_CODE,
    source: "reviewer_plus",
    email: params.email,
    credits: getNumberEnv("REVIEWER_PLUS_CREDITS", DEFAULT_REVIEWER_PLUS_CREDITS),
    stripeSessionId: params.stripeSessionId,
    stripeCustomerId: params.stripeCustomerId,
    stripePaymentIntentId: params.stripePaymentIntentId,
    upgradeUrl: getVibaUpgradeUrl(params.email),
  };

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.VIBA_API_KEY) headers.Authorization = `Bearer ${process.env.VIBA_API_KEY}`;

  try {
    const response = await fetch(syncUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logger.error({ status: response.status, body }, "VIBA credits sync failed");
      return { synced: false };
    }

    return { synced: true };
  } catch (err) {
    logger.error({ err }, "VIBA credits sync request failed");
    return { synced: false };
  }
}

router.post("/create-session", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    const stripe = getStripe();
    const base = getBaseUrl(req);

    const session = (await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      customer_creation: "always",
      client_reference_id: email,
      line_items: getReviewerPlusLineItem(),
      success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/`,
      metadata: {
        app: "viba",
        product: REVIEWER_PLUS_PRODUCT_CODE,
        source: "reviewer_plus",
        upgradeEligible: "true",
        email,
      },
    })) as StripeSessionLike;

    await db.insert(purchases).values({
      email,
      stripeSessionId: session.id,
      downloadToken: "",
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: unknown) {
    logger.error({ err }, "checkout session creation failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Checkout failed" });
  }
});

router.get("/verify/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const stripe = getStripe();
    const session = (await stripe.checkout.sessions.retrieve(sessionId)) as StripeSessionLike;

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Payment not complete", paid: false });
    }

    const [existing] = await db
      .select()
      .from(purchases)
      .where(eq(purchases.stripeSessionId, sessionId))
      .limit(1);

    const email = existing?.email || session.customer_email || session.metadata?.email || "";
    const stripeCustomerId = getStringId(session.customer);
    const stripePaymentIntentId = getStringId(session.payment_intent);

    if (existing && existing.downloadToken) {
      await syncVibaCredits({
        email,
        stripeSessionId: sessionId,
        stripeCustomerId,
        stripePaymentIntentId,
      });

      return res.json({
        paid: true,
        downloadToken: existing.downloadToken,
        email: existing.email,
        upgradeUrl: getVibaUpgradeUrl(existing.email),
      });
    }

    const token = randomBytes(32).toString("hex");

    if (existing) {
      await db
        .update(purchases)
        .set({ downloadToken: token, stripePaymentIntentId })
        .where(eq(purchases.stripeSessionId, sessionId));
    } else {
      await db.insert(purchases).values({
        email,
        stripeSessionId: sessionId,
        stripePaymentIntentId,
        downloadToken: token,
      });
    }

    await syncVibaCredits({
      email,
      stripeSessionId: sessionId,
      stripeCustomerId,
      stripePaymentIntentId,
    });

    return res.json({ paid: true, downloadToken: token, email, upgradeUrl: getVibaUpgradeUrl(email) });
  } catch (err: unknown) {
    logger.error({ err }, "verify purchase failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Verification failed" });
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
    res.setHeader("Content-Disposition", 'attachment; filename="ReviewerPlus.zip"');
    return fs.createReadStream(zipPath).pipe(res);
  } catch (err: unknown) {
    logger.error({ err }, "download failed");
    return res.status(500).json({ error: "Download failed" });
  }
});

export default router;
