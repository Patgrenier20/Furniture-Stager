import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, billingEventsTable } from "@workspace/db";
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

/**
 * Stripe requires the raw, unparsed request body bytes to verify the
 * `Stripe-Signature` header (`stripe.webhooks.constructEvent` computes an
 * HMAC over the exact bytes Stripe sent). The API server's global
 * `express.json()` middleware in `app.ts` parses every request body into a
 * JS object before routes ever see it, which would make signature
 * verification fail on every real Stripe delivery. To avoid that, this
 * handler is NOT registered on `router` (which sits behind the global JSON
 * parser). Instead, `app.ts` mounts it directly on the Express app, ahead of
 * `express.json()`, paired with `express.raw({ type: "application/json" })`
 * so `req.body` is still a `Buffer` by the time it reaches here.
 */
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  if (!STRIPE_WEBHOOK_SECRET || !STRIPE_SECRET_KEY) {
    res.status(200).json({ received: true });
    return;
  }

  try {
    const stripe = await getStripe();
    const sig = req.headers["stripe-signature"] as string;
    const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);

    // Stripe explicitly does not guarantee exactly-once delivery -- the same
    // event can be redelivered (e.g. our server is slow to respond and
    // Stripe retries). Recording each event.id here, guarded by a unique
    // constraint, lets a redelivered event be recognized and skipped instead
    // of re-applying its side effects. onConflictDoNothing makes the
    // check-and-record atomic, so two near-simultaneous deliveries of the
    // same event can't both slip past this check.
    const [inserted] = await db
      .insert(billingEventsTable)
      .values({ stripeEventId: event.id, type: event.type })
      .onConflictDoNothing()
      .returning({ id: billingEventsTable.id });

    if (!inserted) {
      logger.info({ eventId: event.id, eventType: event.type }, "Skipping already-processed Stripe webhook event");
      res.json({ received: true });
      return;
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as { customer: string; id: string; status: string };
        const customerId = subscription.customer;
        if (subscription.status === "active" || subscription.status === "trialing") {
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
      case "checkout.session.completed": {
        // Defensive fallback: Stripe does not strictly guarantee that
        // `customer.subscription.created` arrives before or after
        // `checkout.session.completed`. If the subscription event is ever
        // delayed, dropped, or processed out of order, this ensures the
        // user is still upgraded as soon as checkout finishes.
        const session = event.data.object as {
          mode: string;
          customer: string | null;
          subscription: string | null;
        };
        if (session.mode === "subscription" && session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          if (subscription.status === "active" || subscription.status === "trialing") {
            await db
              .update(usersTable)
              .set({ plan: "pro", stripeSubscriptionId: subscription.id })
              .where(eq(usersTable.stripeCustomerId, session.customer));
          }
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Webhook processing failed");
    res.status(400).json({ error: "Webhook error" });
  }
}

export default router;
