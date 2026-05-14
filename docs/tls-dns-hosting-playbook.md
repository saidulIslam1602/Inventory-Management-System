# TLS, DNS & hosting playbook — Aqila IMS

Concrete checklist for **HTTPS**, **DNS**, and honest **`X-Forwarded-*`** headers so Auth.js cookies and [`https-upgrade.ts`](../src/lib/https-upgrade.ts) behave correctly.

**Related:** [`https-and-cookies.md`](./https-and-cookies.md), [`email-dns-authentication.md`](./email-dns-authentication.md) (mail DNS only), [`go-live-execution-checklist.md`](./go-live-execution-checklist.md) § B.

---

## Universal rules

1. Create **`ims.example.com`** (your hostname) in DNS pointing at your edge / origin as instructed by the host.
2. Issue a **trusted TLS certificate** (managed LE, ACM, or Azure-managed).
3. Ensure the reverse proxy sets **`X-Forwarded-Proto: https`** and **`Host`** to the public hostname when the client used HTTPS.
4. Set **`NEXTAUTH_URL`** / **`AUTH_URL`** to **`https://ims.example.com`** (no trailing slash quirks — use the origin your users see).

---

## Option A — Vercel / similar PaaS

1. Add **custom domain** in project settings; follow TXT/CNAME verification.
2. Enable **automatic HTTPS** (default).
3. Set env vars in project → **Environment Variables** for Production.

---

## Option B — Azure Container Apps + custom domain

1. Container Apps → **Custom domains** → bind hostname; complete DNS validation (CNAME / TXT).
2. Use **managed certificate** where offered.
3. Ingress → ensure HTTPS termination at the platform edge (typical default).
4. App env: set **`NEXTAUTH_URL`** / **`AUTH_URL`** to the custom domain HTTPS URL.

---

## Option C — nginx on a VM (Let’s Encrypt)

Example server block goals (adapt paths/certs):

```nginx
server {
  listen 443 ssl http2;
  server_name ims.example.com;

  ssl_certificate     /etc/letsencrypt/live/ims.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/ims.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Obtain certs with **Certbot** (`certbot --nginx`) or DNS challenge behind firewalls.

---

## Staging vs production

Use **separate hostnames** (`staging.ims.example.com`) and separate secrets so mistakes cannot cross environments.

---

## Spot-check after cutover

- [ ] Browser padlock valid; chain trusted on corporate devices.
- [ ] Response headers show **`Strict-Transport-Security`** where configured ([`security-headers.ts`](../src/lib/security-headers.ts)).
- [ ] Login cookie **`Secure`**, **`HttpOnly`**, **`SameSite=Lax`**.
