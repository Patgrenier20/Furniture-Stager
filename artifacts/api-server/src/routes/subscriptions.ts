import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

async function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY.");
  }
  const Stripe = (await import("stripe")).default;
  return new Stripe(STRIPE_SECRET_KEY);
}

router.post("/subscriptions/checkout", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  try {
    const stripe = await getStripe();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email });
      customerId = customer.id;
      await db.update(usersTable).set({ stripeCustomerId: customerId }).where(eq(usersTable.id, userId));
    }

    const protocol = req.protocol;
    const host = req.get("host") ?? "localhost";
    const baseUrl = `${protocol}://${host}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/account?success=true`,
      cancel_url: `${baseUrl}/pricing`,
    });

    res.json({ url: session.url ?? "" });
  } catch (err) {
    logger.error({ err }, "Checkout session creation failed");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/subscriptions/portal", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  try {
    const stripe = await getStripe();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

    if (!user || !user.stripeCustomerId) {
      res.status(400).json({ error: "No billing account found" });
      return;
    }

    const protocol = req.protocol;
    const host = req.get("host") ?? "localhost";
    const baseUrl = `${protocol}://${host}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/account`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Portal session creation failed");
    res.status(500).json({ error: "Failed to open billing portal" });
  }
});

router.post("/subscriptions/webhook", async (req, res): Promise<void> => {
  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    const stripe = await getStripe();
    const sig = req.headers["stripe-signature"] as string;
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as { customer: string; id: string; status: string };
        const customerId = subscription.customer;
        if (subscription.status === "active") {
          await db
            .update(usersTable)
            .set({ plan: "pro", stripeSubscriptionId: subscription.id })
            .where(eq(usersTable.stripeCustomerId, customerId as string));
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as { customer: string };
        const customerId = subscription.customer;
        await db
          .update(usersTable)
          .set({ plan: "free", stripeSubscriptionId: null })
          .where(eq(usersTable.stripeCustomerId, customerId as string));
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Webhook processing failed");
    res.status(400).json({ error: "Webhook error" });
  }
});

export default router;
