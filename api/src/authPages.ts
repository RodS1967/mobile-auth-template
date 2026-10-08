// Part of mobile-auth-template (MIT) — github.com/RodS1967/mobile-auth-template - Team RodZilla LLC
import { PASSWORD_MIN_LENGTH, COMMON_WEAK_PASSWORDS } from "./auth";
import { config } from "./config";

// Renders the plain HTML pages a human lands on after clicking an emailed link (verify
// email, and later password reset) -- these are read in a phone's mail app or a browser,
// not fetched by the app, so they get a real styled page instead of bare JSON.
export function renderAuthPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} - ${config.appName}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 32px 28px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 12px;
      color: #2e7d32;
    }
    p {
      font-size: 1rem;
      line-height: 1.5;
      color: #333;
      margin: 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

// The password-reset form itself -- reached by the link in the reset email. A plain HTML
// form (no JS required to submit) posting back to the same route, so it still works in any
// mail client's in-app browser, not just a modern one; the live checklist below is a pure
// UX nudge layered on top -- the real enforcement is server-side, via validatePasswordStrength
// using these same two constants, so the two can't silently drift apart.
// `token` is carried in a hidden field, not the URL, once the page is a POST -- it's still
// the same raw token from the query string either way.
export function renderPasswordResetForm(
  token: string,
  username: string,
  email: string,
  errorMessage?: string
): string {
  const emailLocalPart = email.split("@")[0] ?? "";
  const disallowedWordsJson = JSON.stringify([username.toLowerCase(), emailLocalPart.toLowerCase()]);
  const weakListJson = JSON.stringify(COMMON_WEAK_PASSWORDS);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reset password - ${config.appName}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 32px 28px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      box-sizing: border-box;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 20px;
      color: #2e7d32;
      text-align: center;
    }
    label {
      display: block;
      font-size: 0.9rem;
      font-weight: 600;
      color: #333;
      margin: 16px 0 6px;
    }
    input {
      width: 100%;
      font-size: 1rem;
      padding: 10px 12px;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-sizing: border-box;
    }
    button {
      width: 100%;
      margin-top: 24px;
      padding: 14px;
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
      background: #2e7d32;
      border: none;
      border-radius: 8px;
    }
    .error {
      color: #c0392b;
      font-size: 0.9rem;
      margin: 0 0 4px;
      text-align: center;
    }
    .password-meter {
      margin-top: 10px;
    }
    .password-meter-bar {
      background: #eee;
      border-radius: 4px;
      height: 6px;
      overflow: hidden;
    }
    .password-meter-fill {
      height: 100%;
      width: 0;
      background: #ccc;
      transition: width 0.15s, background 0.15s;
    }
    .password-meter-fill.weak { background: #c0392b; }
    .password-meter-fill.fair { background: #e67e22; }
    .password-meter-fill.good { background: #f1c40f; }
    .password-meter-fill.strong { background: #2e7d32; }
    .password-requirements {
      list-style: none;
      padding: 0;
      margin: 8px 0 0;
      font-size: 0.8rem;
      color: #888;
    }
    .password-requirements li {
      margin-bottom: 2px;
    }
    .password-requirements li.met {
      color: #2e7d32;
    }
    .password-requirements li.met::before { content: "✓ "; }
    .password-requirements li:not(.met)::before { content: "• "; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Set a new password</h1>
    ${errorMessage ? `<p class="error">${errorMessage}</p>` : ""}
    <form method="POST" action="/api/auth/reset-password">
      <input type="hidden" name="token" value="${token}" />
      <label for="newPassword">New password</label>
      <input type="password" id="newPassword" name="newPassword" minlength="${PASSWORD_MIN_LENGTH}" required />

      <div class="password-meter">
        <div class="password-meter-bar"><div class="password-meter-fill" id="password-meter-fill"></div></div>
        <ul class="password-requirements" id="password-requirements">
          <li data-check="length">At least ${PASSWORD_MIN_LENGTH} characters</li>
          <li data-check="variety">At least 3 of: lowercase, uppercase, number, symbol</li>
          <li data-check="common">Not a commonly used password</li>
          <li data-check="username">Doesn't contain your username or email</li>
        </ul>
      </div>

      <label for="confirmPassword">Confirm new password</label>
      <input type="password" id="confirmPassword" name="confirmPassword" minlength="${PASSWORD_MIN_LENGTH}" required />
      <button type="submit">Set password</button>
    </form>
  </div>
  <script>
    (function () {
      var weakList = ${weakListJson}.map(function (w) { return w.toLowerCase(); });
      var disallowed = ${disallowedWordsJson};
      var input = document.getElementById("newPassword");
      var fill = document.getElementById("password-meter-fill");
      var items = document.querySelectorAll("#password-requirements li");
      var minLength = ${PASSWORD_MIN_LENGTH};

      function classCount(pw) {
        var c = 0;
        if (/[a-z]/.test(pw)) c++;
        if (/[A-Z]/.test(pw)) c++;
        if (/[0-9]/.test(pw)) c++;
        if (/[^a-zA-Z0-9]/.test(pw)) c++;
        return c;
      }
      function containsAny(lowerPw, words) {
        for (var i = 0; i < words.length; i++) {
          if (words[i] && lowerPw.indexOf(words[i]) !== -1) return true;
        }
        return false;
      }
      function evaluate(pw) {
        var lower = pw.toLowerCase();
        var checks = {
          length: pw.length >= minLength,
          variety: classCount(pw) >= 3,
          common: weakList.indexOf(lower) === -1,
          username: pw.length === 0 || !containsAny(lower, disallowed)
        };
        var met = 0;
        items.forEach(function (li) {
          var ok = checks[li.getAttribute("data-check")];
          li.classList.toggle("met", !!ok);
          if (ok) met++;
        });
        var pct = pw.length === 0 ? 0 : (met / items.length) * 100;
        fill.style.width = pct + "%";
        fill.className = "password-meter-fill";
        if (pw.length === 0) {
          // neutral, no color class
        } else if (met <= 1) {
          fill.classList.add("weak");
        } else if (met === 2) {
          fill.classList.add("fair");
        } else if (met === 3) {
          fill.classList.add("good");
        } else {
          fill.classList.add("strong");
        }
      }
      if (input) {
        input.addEventListener("input", function () { evaluate(input.value); });
        evaluate(input.value);
      }
    })();
  </script>
</body>
</html>`;
}
