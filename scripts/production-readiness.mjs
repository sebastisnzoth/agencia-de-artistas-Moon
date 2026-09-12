import crypto from "node:crypto";

const required = [
  "DATABASE_URL",
  "MOON_APP_URL",
  "MOON_SESSION_SECRET",
  "MOON_TOKEN_ENCRYPTION_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
];

const errors = [];
const warnings = [];

for (const key of required) {
  if (!process.env[key]?.trim()) errors.push(`${key} is missing`);
}

const appUrl = process.env.MOON_APP_URL;
const redirectUri = process.env.GOOGLE_REDIRECT_URI;

if (appUrl) {
  try {
    const parsed = new URL(appUrl);
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      errors.push("MOON_APP_URL must use https in production");
    }
  } catch {
    errors.push("MOON_APP_URL is not a valid absolute URL");
  }
}

if (redirectUri) {
  try {
    const parsed = new URL(redirectUri);
    if (!parsed.pathname.endsWith("/api/auth/google/callback")) {
      errors.push("GOOGLE_REDIRECT_URI must point to /api/auth/google/callback");
    }
  } catch {
    errors.push("GOOGLE_REDIRECT_URI is not a valid absolute URL");
  }
}

if (process.env.MOON_SESSION_SECRET && process.env.MOON_SESSION_SECRET.length < 32) {
  errors.push("MOON_SESSION_SECRET must contain at least 32 characters");
}

if (process.env.MOON_TOKEN_ENCRYPTION_KEY) {
  try {
    const decoded = Buffer.from(process.env.MOON_TOKEN_ENCRYPTION_KEY, "base64");
    if (decoded.length !== 32) {
      errors.push("MOON_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
    }
  } catch {
    errors.push("MOON_TOKEN_ENCRYPTION_KEY is not valid base64");
  }
}

if (process.env.DATABASE_URL?.includes("user:password@localhost")) {
  warnings.push("DATABASE_URL still looks like the example placeholder");
}

const result = {
  ok: errors.length === 0,
  checkedAt: new Date().toISOString(),
  fingerprint: crypto
    .createHash("sha256")
    .update(required.map((key) => `${key}:${Boolean(process.env[key])}`).join("|"))
    .digest("hex")
    .slice(0, 12),
  errors,
  warnings,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
