# HTTPS, reverse proxies & session cookies — Aqila IMS

Companion to [**secrets-and-config.md**](./secrets-and-config.md) and production tracker **4**. Auth.js is configured in [`src/lib/auth.ts`](../src/lib/auth.ts) + [`src/lib/auth.config.ts`](../src/lib/auth.config.ts).

---

## TLS

- Terminate **HTTPS** at your load balancer, CDN, or reverse proxy (Caddy, nginx, Traefik, cloud LB).
- Issue certificates (e.g. Let’s Encrypt) for the hostname you put in **`NEXTAUTH_URL`** / **`AUTH_URL`** (must match what users see in the browser).

---

## Proxies and `trustHost`

[`auth.config.ts`](../src/lib/auth.config.ts) sets **`trustHost: true`** so Auth.js accepts the forwarded host (needed behind Docker port maps, nginx, etc.). Your proxy must send trustworthy **`Host`** (and, when relevant, **`X-Forwarded-Host`** / **`X-Forwarded-Proto`**) — see [Hosted Auth.js behind a reverse proxy](https://authjs.dev/getting-started/deployment#reverse-proxy).

Recommended:

- Set **`X-Forwarded-Proto: https`** when the client connection is TLS.
- Do not expose the app directly to the internet without the proxy if you rely on these headers.

---

## Session cookies (`useSecureCookies`)

[`auth-cookie-policy.ts`](../src/lib/auth-cookie-policy.ts) sets **`useSecureCookies`** in **production** from **`NEXTAUTH_URL` / `AUTH_URL`**:

| Public URL                              | Effect                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `https://…`                             | **`Secure`** cookies and `__Secure-` / `__Host-` prefixes (Auth.js defaults). |
| `http://localhost` / `http://127.0.0.1` | Non-secure cookies for local smoke tests only.                                |

Development (`NODE_ENV !== production`) leaves the flag unset so Auth.js infers from each request (HTTP localhost works as usual).

---

## Verification checklist

- [ ] Browser shows padlock; URL matches **`NEXTAUTH_URL`**.
- [ ] Login works; session persists across navigation (cookie present, `Secure` + `HttpOnly` + `SameSite=Lax` in DevTools).
- [ ] Same flow behind your real proxy (not only direct-to-container).

---

## Related

- Production env assertions: [`validate-production-env.ts`](../src/lib/validate-production-env.ts)
- Cron and secrets: [`secrets-and-config.md`](./secrets-and-config.md)
