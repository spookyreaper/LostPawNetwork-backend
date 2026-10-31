# Lost Paw Network API

Sails 1 API for user accounts, profiles, and lost or found pet reports. The React frontend lives in the sibling `LostPawNetwork-frontend` repository.

## Local development

Use Node.js 22.13 or newer in the Node 22 release line, or Node 24. Run these commands from `lostpaw-network/`:

```sh
npm ci
npm run dev
```

`npm run dev` explicitly selects development mode and the local disk database. It starts the API at `http://127.0.0.1:1337` by default. It does not connect to the MongoDB URL in an existing environment file. Local records persist in `.data/database` and uploaded images in `.data/uploads`; both directories are ignored by Git.

Set `VITE_API_BASE_URL=/api` in the frontend's `.env.local` and run its Vite development server. Its development proxy forwards API and image requests to `http://localhost:1337`.

The backend loads `.env` without replacing values already set by the shell or hosting platform. `npm start` respects `NODE_ENV` and the selected datastore. Development creates a temporary JWT signing secret when `JWT_SECRET` is absent; set a stable secret to keep local logins valid across server restarts.

Use `.env.example` as a configuration reference. Keep any existing `.env` file and its credentials.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` for local work or `production` for deployment. |
| `DATASTORE_ADAPTER` | `disk` or `mongo`; defaults to disk in development and MongoDB in production. Disk is rejected in production. |
| `MONGODB_URI` | MongoDB connection URL, required when using the MongoDB adapter. |
| `LOCAL_DATA_DIR` | Local disk database directory; defaults to `.data/database`. |
| `JWT_SECRET` | Random signing secret of at least 32 UTF-8 bytes. Required in production; obvious placeholders are rejected. |
| `FRONTEND_ORIGINS` | Comma-separated complete frontend origins, without paths or wildcards. Defaults include Vite development and preview origins locally. Required explicitly in production, using HTTPS. |
| `TRUST_PROXY_IPS` | Exact trusted proxy IPs or CIDRs when TLS terminates at a reverse proxy. Leave unset for direct connections; blanket `TRUST_PROXY=true` is rejected. |
| `PHOTON_SEARCH_URL` | HTTPS Photon API endpoint for address/place search; defaults to the public Photon demo API. No user-supplied endpoint URLs are accepted. |
| `UPLOAD_DIR` | Image storage directory; defaults to `.data/uploads`. Use persistent storage when deploying. |
| `HOST` | Listen address; defaults to `127.0.0.1` in development and `0.0.0.0` in production. |
| `PORT` | HTTP port; defaults to `1337`. |

To use MongoDB during development, run:

```sh
NODE_ENV=development DATASTORE_ADAPTER=mongo npm start
```

Set `MONGODB_URI` in the local environment first. Keep `.env`, signing keys, local database files, and private uploads out of version control.

## Validation

```sh
npm run lint
npm test
npm audit --omit=dev
```

Tests use Node's built-in test runner. They run independently of the production database. Install dependencies with `npm ci` to reproduce the committed lockfile.

## Production

Set `NODE_ENV=production`, `DATASTORE_ADAPTER=mongo`, a valid `MONGODB_URI`, a strong `JWT_SECRET`, and the exact `FRONTEND_ORIGINS` for the deployed frontend. Start with `npm start`, or use the included Heroku `Procfile`. The server validates required configuration at startup. Deployments no longer run demo seeding automatically.

Use `npm run seed` to explicitly create local development sample data. The command selects development mode and the disk database, adds two sample reports, and can be repeated without duplicating the sample data. The seed script itself rejects production and MongoDB configurations.

Stop the development server before seeding, then start it again with `npm run dev`. The disk store must have only one running writer.

The local demo account is `demo@example.test` with password `LostPaw-local-2026!`. These credentials are for local development only; no demo account is created automatically during startup or deployment.

The API uses bearer JWT authentication backed by persisted `AuthSession` records. The unused Sails cookie-session hook, WebSockets, Redis integration, and Grunt frontend pipeline remain disabled.

## Authentication security

New passwords require at least 15 Unicode characters and at most 72 UTF-8 bytes, without trimming or silently truncating them. A small local blocklist rejects obvious common/repeated passwords; it is not a complete breached-password database. Passwords use bcrypt at cost 12. Existing shorter passwords still work at login, and lower-cost hashes are upgraded after successful verification.

Tokens have a one-hour lifetime and must have the expected algorithm, issuer, audience, subject, issue/expiry times, and random session ID. Each protected request checks the persisted session, the current account, and a fingerprint of its current password hash. Tokens from earlier versions of the app are rejected; users must sign in again after this update. No raw bearer token is stored in the session table. Logout deletes the current session, while password changes invalidate every existing session, including any stale records that survive cleanup.

The frontend waits for server logout to succeed before clearing its local session. It allows retry after a network or storage failure; a token that is already invalid can be cleared immediately.

Authentication attempts use shared, persisted fixed-window budgets:

| Action | Per client address | Per normalized email or authenticated user |
| --- | --- | --- |
| Login | 30 per 15 minutes | 10 per 15 minutes |
| Registration | 10 per hour | 5 per hour |
| Profile edits, password changes, account deletion | 30 per 15 minutes | 10 per 15 minutes |

These count successful and unsuccessful requests. A limit returns `429` with `Retry-After`. IPv6 addresses share a `/64` budget. Only Express's validated client address is used; arbitrary forwarded headers cannot reset it. Identifiers are HMAC digests, and expired attempt/session records are cleaned up. Limiter/session storage failures deny access instead of bypassing protection. MongoDB enforces slot uniqueness across API workers; the disk datastore is development-only and must have a single writer.

Login uses generic credential errors and performs a bcrypt comparison for unknown accounts. Registration still distinguishes successful account creation from duplicate details; eliminating registration enumeration completely would require an email verification flow. Profiles expose account email/contact details only to their owner; contact details deliberately included in public pet reports remain public.

Sensitive endpoints require a valid bearer token and JSON:

- `PUT /user/:id`: changing the email also requires `currentPassword`.
- `PUT /user/password`: `{ "currentPassword": "...", "newPassword": "..." }`; success requires signing in again on each device.
- `DELETE /user/:id`: requires `{ "currentPassword": "..." }`, and existing reports/pets must be removed first.
- `POST /user/logout`: revokes the presented session and returns `204`.

Cookie authentication is disabled. CORS permits only configured origins, and frontend requests omit cookies. JSON bodies are limited to 32 KB; malformed/oversized payloads return generic errors. Multipart pet-photo uploads keep their existing validation and size limits.

Production requires HTTPS; direct plain HTTP is rejected except for `/health`. Configure TLS at the server or a trusted ingress, set its exact `TRUST_PROXY_IPS`, and have the ingress replace forwarded headers. Do not expose a backend port that bypasses that ingress. Generate a production key locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"` and store it in your hosting secret manager. Never use the documented local demo credentials in production.

At production startup, the app ensures unique username/email indexes and session/limiter lookup indexes. The email index is case-insensitive. Startup fails if uniqueness cannot be established; inspect and normalize/deduplicate existing account emails before deployment without silently deleting users. Expiry fields are numeric timestamps and use application cleanup, not MongoDB TTL indexes.

This hardening does not guarantee that an account cannot be compromised. MFA/passkeys, email verification and a verified recovery flow, production monitoring, secret rotation, HTTPS configuration, and database access controls still need deployment-specific work. Bearer tokens remain accessible to frontend JavaScript/localStorage, so preventing frontend XSS is necessary; HttpOnly cookie authentication would require a separate cookie/CSRF integration. No live production MongoDB was available for this change: disk HTTP flows and mocked native Mongo operations are tested, but Mongo deployment/index creation must also be verified in staging.

References: [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), and [JWT validation guidance](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html).

## Address and place search

`POST /locations/search` accepts a JSON body `{ "query": "Central Park, New York" }` from a signed-in user and returns up to five `{ id, label, lat, lng }` results. The report form places the chosen point automatically; users can also use browser location or tap/drag a map pin. No coordinate entry is required. Reports store an optional human-readable label inside the existing location JSON alongside their numeric coordinates, so existing reports remain compatible.

Search happens only after the user clicks **Find place** or presses Enter. Queries are sent to Photon; the form displays this notice and OpenStreetMap attribution. Requests go through the API with a five-second provider timeout, bounded responses, no redirects, a bounded 15-minute cache, and in-flight deduplication. Search is limited to 15 requests per user and 30 per client address in 15 minutes. Uncached provider requests share a 30-per-minute datastore budget across workers; each process also spaces provider request starts one second apart.

The default [Photon demo service](https://github.com/komoot/photon#demo-server) permits moderate use and provides no availability guarantee. Configure `PHOTON_SEARCH_URL` for another compatible HTTPS Photon instance when more capacity is needed. No API key is required by the default service. If the provider is unavailable or a limit is reached, the user can still select a point on the map or use browser location.

## Dependency maintenance

Runtime packages use current compatible Sails 1, Waterline adapters, bcrypt 6, and JSON Web Token releases. ESLint 10 uses flat configuration with Sails model globals explicitly declared.

The package overrides keep Sails-pinned Express, Compression, Body Parser, and `qs` on patched releases within their existing major versions. Review these overrides when upstream Sails or Skipper updates its pins.

The remaining npm audit findings concern transitive Minimatch versions in Sails/Glob and development lint tooling. The [upstream advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249) lists only Minimatch 11.0.1 and later as patched; the current dependency chains require earlier major versions. Do not force incompatible major-version overrides without validating the framework and file-matching APIs.

References: [Sails datastore configuration](https://sailsjs.com/documentation/reference/configuration/sails-config-datastores), [Sails configuration](https://sailsjs.com/documentation/concepts/configuration), and [Node test runner](https://nodejs.org/docs/latest-v22.x/api/test.html).
