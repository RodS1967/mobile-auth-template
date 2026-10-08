import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  // The one place to rename the product -- shows up in email subjects, the hosted
  // auth-link pages (verify/unlock/reset), and the server's own startup log.
  appName: process.env.APP_NAME ?? "My App",
  port: Number(process.env.PORT ?? 3000),
  db: {
    host: required("DB_HOST", "localhost"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    database: required("DB_NAME", "app_db"),
  },
  // SMTP_* left unset means "no real mailbox configured yet" -- email.ts falls back to
  // logging the link instead of sending, so the verification flow is fully testable
  // before a real mailbox exists.
  email: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM ?? "no-reply@example.com",
  },
  // The address a human clicks an emailed link to reach -- this PC's LAN address for local
  // dev, the real API domain once deployed. Deliberately separate from DB_HOST/PORT.
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
};
