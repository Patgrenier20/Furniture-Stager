import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testRoot = path.join(artifactDir, ".test-data", `auth-integration-${process.pid}`);
const databasePath = path.join(testRoot, "database");

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(baseUrl, child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`API exited before becoming healthy (code ${child.exitCode})`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
    } catch {
      // Expected while the process is starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("API did not become healthy within 15 seconds");
}

async function startServer(port) {
  const child = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: artifactDir,
    env: {
      ...process.env,
      DATABASE_URL: "",
      LOCAL_DATABASE_PATH: databasePath,
      LOG_LEVEL: "fatal",
      NODE_ENV: "test",
      PORT: String(port),
      SESSION_SECRET: "auth-integration-session-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.testOutput = () => output;

  await waitForServer(`http://127.0.0.1:${port}`, child);
  return child;
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("API did not stop")), 5_000)),
  ]);
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const contentType = response.headers.get("content-type") ?? "";
  assert.match(contentType, /application\/json/, `${pathname} should return JSON`);
  const body = await response.json();
  return { response, body };
}

async function main() {
  await mkdir(testRoot, { recursive: true });
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child;

  try {
    child = await startServer(port);

    let result = await request(baseUrl, "/api/auth/me");
    assert.equal(result.response.status, 401);

    result = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(result.response.status, 400);
    assert.equal(result.body.error, "Invalid JSON body");
    assert.ok(result.body.requestId);

    result = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "correct-horse-42" }),
    });
    assert.equal(result.response.status, 400);

    result = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "  Auth.Smoke@Example.COM  ",
        password: "correct-horse-42",
      }),
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.email, "auth.smoke@example.com");
    const setCookie = result.response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /furniflip\.sid=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    const cookie = setCookie.split(";", 1)[0];

    result = await request(baseUrl, "/api/auth/me", { headers: { cookie } });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.email, "auth.smoke@example.com");

    result = await request(baseUrl, "/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "AUTH.SMOKE@example.com",
        password: "correct-horse-42",
      }),
    });
    assert.equal(result.response.status, 409);

    result = await request(baseUrl, "/api/auth/logout", {
      method: "POST",
      headers: { cookie },
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ok, true);

    result = await request(baseUrl, "/api/auth/me", { headers: { cookie } });
    assert.equal(result.response.status, 401);

    result = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "auth.smoke@example.com", password: "wrong-password" }),
    });
    assert.equal(result.response.status, 401);

    result = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "AUTH.SMOKE@EXAMPLE.COM", password: "correct-horse-42" }),
    });
    assert.equal(result.response.status, 200);
    const loginCookie = (result.response.headers.get("set-cookie") ?? "").split(";", 1)[0];
    assert.match(loginCookie, /furniflip\.sid=/);

    await stopServer(child);
    child = undefined;

    // Prove local accounts survive an API restart and bootstrap remains safe.
    child = await startServer(port);
    result = await request(baseUrl, "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "auth.smoke@example.com", password: "correct-horse-42" }),
    });
    assert.equal(result.response.status, 200);

    console.log("PASS auth integration: JSON errors, register, session, duplicate, logout, login, restart persistence");
  } catch (error) {
    if (child?.testOutput) console.error(child.testOutput());
    throw error;
  } finally {
    await stopServer(child).catch(() => {});
    await rm(testRoot, { recursive: true, force: true });
  }
}

await main();
