// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
// The one place to rename the product on the app side -- shown on the login screen.
// Keep in sync with API_BASE_URL in api.ts (separate file, separate concern: that's the
// network address, this is just the display name) and with APP_NAME in api/.env if the
// server-rendered pages (verify/unlock/reset) should show the same name.
export const APP_NAME = "My App";
