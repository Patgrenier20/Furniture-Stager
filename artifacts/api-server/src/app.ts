import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import session from "express-session";
import path from "path";
import router from "./routes";
import { handleStripeWebhook } from "./routes/subscriptions";
import { logger } from "./lib/logger";
import { requireAuth } from "./middlewares/requireAuth";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";
const sessionSecret = process.env.SESSION_SECRET ?? "furniflip-dev-secret";
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction) {
  if (sessionSecret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to at least 32 characters in production.",
    );
  }

  // Required for secure cookies when TLS terminates at the hosting proxy.
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    // Development accepts browser origins for local tooling. Production is
    // same-origin unless an explicit comma-separated allowlist is provided.
    origin: isProduction
      ? (allowedOrigins.length > 0 ? allowedOrigins : false)
      : true,
    credentials: true,
  }),
);

app.use(
  session({
    name: "furniflip.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  }),
);

// Stripe's webhook signature check needs the exact raw bytes of the request
// body, so this route is registered ahead of the global express.json()
// parser below (and is not part of the /api router, which sits behind it).
// Express stops at the first route that sends a response, so requests to
// this exact path never reach express.json() or the router at all.
app.post(
  "/api/subscriptions/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleStripeWebhook,
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// User images are private application data, not public static assets. Browser
// image requests include the same-origin session cookie, so the normal auth
// middleware protects them without exposing a separate token in the URL.
app.use(
  "/api/uploads",
  requireAuth,
  express.static(path.join(process.cwd(), "uploads"), {
    dotfiles: "deny",
    index: false,
  }),
);

app.use("/api", router);

// Keep API failures machine-readable. Express's default handler returns an
// HTML stack trace in development, which made the frontend surface only an
// opaque "HTTP 500" toast during the original authentication failure.
app.use(
  (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const candidateStatus = error
      && typeof error === "object"
      && "status" in error
      && typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : 500;
    const status = candidateStatus >= 400 && candidateStatus < 500
      ? candidateStatus
      : 500;
    const isInvalidJson = status === 400
      && error
      && typeof error === "object"
      && "type" in error
      && (error as { type?: unknown }).type === "entity.parse.failed";

    logger.error({ err: error, requestId: req.id }, "API request failed");
    res.status(status).json({
      error: isInvalidJson ? "Invalid JSON body" : status === 500
        ? "Internal server error"
        : "Request failed",
      requestId: req.id,
    });
  },
);

export default app;
