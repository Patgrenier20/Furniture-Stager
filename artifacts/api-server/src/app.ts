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
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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
  express.raw({ type: "application/json" }),
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

// Any /api/* request that reaches this point matched no route above. Return
// a machine-readable 404 here explicitly, before the frontend-serving
// middleware below -- otherwise an unmatched API path would silently fall
// through to the SPA catch-all and come back as a 200 with index.html's
// HTML, which looks like success and makes a typo'd or removed endpoint
// very confusing to debug.
app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// The frontend (artifacts/furniture-flip) is a separate Vite/React app with
// no build-time knowledge of where the API lives -- its compiled bundle
// calls bare relative paths like "/api/projects", which only works if the
// browser sees the frontend and the API as the same origin. Rather than
// requiring every hosting platform to be configured with a reverse-proxy
// rewrite rule to make that true, this server serves the frontend's own
// production build directly, so a single deployed process is correct on
// any host with no routing configuration at all.
//
// This only activates once the frontend has actually been built (i.e. in
// a production deploy, or after manually running the frontend's build
// script). Local dev is unaffected: `pnpm dev` runs the frontend on its own
// Vite dev server with its own hot-reloading, which is what you want during
// development, and this server's dist/public won't exist yet in a fresh
// checkout, so this block is skipped entirely rather than trying (and
// failing) to serve files that were never built.
//
// Resolve from the compiled module location rather than the process cwd, which
// can vary when the server is launched by a service manager or direct node
// invocation. Allow deployments with a different artifact layout to override it.
const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDistDir = process.env.FRONTEND_DIST_DIR
  ?? path.resolve(runtimeDir, "..", "..", "furniture-flip", "dist", "public");
const frontendIndexHtml = path.join(frontendDistDir, "index.html");

if (fs.existsSync(frontendIndexHtml)) {
  app.use(express.static(frontendDistDir));

  // SPA fallback: any remaining GET request that isn't a static asset and
  // isn't /api/* (already handled above) is a client-side route like
  // /dashboard or /projects/3 -- serve the SPA shell and let the frontend's
  // own router (wouter) take it from there. This must be registered last.
  //
  // Express 5 changed wildcard route syntax (path-to-regexp v6+): the bare
  // "*" from Express 4 throws "Missing parameter name" here. Named
  // wildcards are required now -- confirmed directly against this
  // project's installed express@5.2.1, not assumed from memory.
  app.get("/*splat", (req: Request, res: Response) => {
    // Never turn a missing asset into a successful HTML response. This keeps
    // broken or partial frontend deployments diagnosable in the browser.
    if (path.extname(req.path)) {
      res.status(404).end();
      return;
    }

    res.sendFile(frontendIndexHtml);
  });

  logger.info({ frontendDistDir }, "Serving frontend build from the API server");
} else {
  logger.info(
    { frontendIndexHtml },
    "Frontend build not found -- skipping static/SPA serving (expected in local dev)",
  );
}

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
