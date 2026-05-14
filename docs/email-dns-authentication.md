# Email DNS authentication (SPF, DKIM, DMARC) — Aqila IMS

Aqila IMS sends transactional mail through **Nodemailer** ([`nodemailer-transport.ts`](../src/lib/nodemailer-transport.ts)) using **`SMTP_*`** environment variables. Recipients (and filters) expect the **envelope-from / header From domain** to align with **DNS records** that prove you are allowed to send on behalf of that domain.

This is an **operator / DNS** responsibility — the application does not publish SPF or DKIM for you.

**Related:** [`.env.example`](../.env.example) (`SMTP_FROM`, `SMTP_HOST`, …), [`secrets-and-config.md`](./secrets-and-config.md), [`production-readiness.md`](./production-readiness.md) tracker **13**.

---

## What the app sends

| Flow               | Code entry                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| Daily digest       | [`send-digest-email.ts`](../src/lib/email/send-digest-email.ts)             |
| Password reset OTP | [`send-password-reset-otp.ts`](../src/lib/email/send-password-reset-otp.ts) |
| User invitations   | [`send-user-invitation.ts`](../src/lib/email/send-user-invitation.ts)       |

**From address:** `SMTP_FROM` if set; otherwise a fallback like `Aqila IMS <noreply@${SMTP_HOST}>`. For consistent branding and DNS alignment, **set `SMTP_FROM` explicitly** to an address on a domain you control (e.g. `Aqila IMS <noreply@aqila.no>`).

---

## SPF (Sender Policy Framework)

**Purpose:** List which hosts may send mail **for your domain** (the domain in the visible From address / envelope).

**Typical approach:**

1. Decide the **domain** in your From address (e.g. `aqila.no` for `noreply@aqila.no`).
2. Add or update a **TXT** record at that domain (often `@` or the subdomain used for mail).
3. Include your SMTP provider’s mechanism (often `include:…`) **or** the static IPs/hostnames of your relay.

Example shape (illustrative only — copy values from your provider’s docs):

```txt
v=spf1 include:_spf.example-provider.com ~all
```

**Pitfalls:**

- **Multiple SPF TXT records** for the same name — invalid; merge into one.
- **Ten DNS lookups** SPF evaluation limit — flatten or use provider includes wisely.
- Sending From `@aqila.no` through a relay not listed in `aqila.no`’s SPF → **fail** or **softfail** at receivers.

---

## DKIM (DomainKeys Identified Mail)

**Purpose:** Cryptographic signature on messages proving they were not altered in transit and tying them to a domain.

**Typical approach:**

- Most **SMTP relays** (Microsoft 365, Google Workspace, SendGrid, Postmark, Amazon SES, …) sign outbound mail and tell you which **selector** and **public key** to publish as a **TXT** record (e.g. `selector1._domainkey.yourdomain`).

The app does **not** sign messages itself — signing happens at the **MTA / provider** you configure in `SMTP_HOST` / credentials.

---

## DMARC (Domain-based Message Authentication)

**Purpose:** Tell receivers what to do when SPF and/or DKIM do not align, and enable **aggregate / forensic reports**.

**Typical rollout:**

1. Start with monitoring only:

   ```txt
   v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.example
   ```

2. Review reports; fix SPF/DKIM alignment for legitimate traffic (digest, OTP, invites).

3. Tighten policy (`p=quarantine` then `p=reject`) when confident.

**Alignment:** DMARC “pass” generally requires **either** SPF **or** DKIM to align with the **From** domain (provider-dependent nuances apply).

---

## Operational checklist

1. **Set `SMTP_FROM`** to a stable address on your owned domain.
2. **Publish SPF** for that domain to authorize your SMTP provider / relay.
3. **Enable DKIM** at the provider and publish the DNS records they supply.
4. **Publish DMARC** (`p=none` first) with a **`rua`** mailbox you monitor.
5. **Send test mail** from staging (reset password or invite) and verify headers in Gmail / Outlook (“Show original”) — SPF/DKIM/DMARC results.
6. **Monitor bounces** at your provider (digest volume grows with opt-ins; OTP and invites are spikey).

---

## Tools (external)

Use your DNS host’s UI plus vendor dashboards. Third-party validators (search for “SPF checker”, “DKIM validator”, “DMARC checker”) help after you publish records — treat them as hints, not guarantees.
