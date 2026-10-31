# LostPaw Network · API

The backend for a community app that helps lost and found pets get home. It powers accounts, profiles, pet reports, photo uploads, and the locations displayed on the map.

[Frontend repository](https://github.com/spookyreaper/LostPawNetwork-frontend) · [App screenshots](https://github.com/spookyreaper/LostPawNetwork-frontend#screenshots) · [Detailed API setup](./lostpaw-network/README.md)

## What it supports

- Lost and found pet reports with photos, saved place names, map locations, and animal categories.
- Authenticated address/place lookup so reporters can choose a location without entering coordinates.
- Account registration, login, profiles, and ownership checks on edits and deletion.
- One-hour, persisted JWT sessions with server-side logout revocation.
- Login and registration throttling, password hashing, and password confirmation for sensitive account changes.
- A local development database and an explicitly configured MongoDB production datastore.

## Stack

| Layer | Technology |
| --- | --- |
| API | Node.js and Sails 1 |
| Models | Waterline ORM |
| Production data | MongoDB through `sails-mongo` |
| Local development data | `sails-disk` |
| Authentication | bcrypt, JWTs, and persisted session records |
| Validation | Node test runner and ESLint |

The application source and npm project are in [`lostpaw-network/`](./lostpaw-network).

## Run locally

Use the included Node 22 configuration:

```sh
nvm install
nvm use
cd lostpaw-network
npm ci
npm run dev
```

The API starts at **http://127.0.0.1:1337**. Check [the health endpoint](http://127.0.0.1:1337/health) after startup. Development uses the local disk database, so MongoDB is not needed for this workflow.

Use [`.env.example`](./lostpaw-network/.env.example) as the configuration reference. Keep `.env`, signing keys, local database files, and uploads out of Git. To connect the frontend locally, set its `.env.local` to:

```dotenv
VITE_API_BASE_URL=/api
```

The frontend's Vite proxy forwards API requests to port 1337. See [local setup and optional demo data](./lostpaw-network/README.md#local-development) before seeding; stop the disk-backed server before running `npm run seed`.

## Check changes

Run these commands from `lostpaw-network/`:

```sh
npm run lint
npm test
npm audit --omit=dev
```

Tests use an isolated datastore. The [authentication security notes](./lostpaw-network/README.md#authentication-security) explain token behavior, rate limits, password rules, and remaining limitations. The [dependency notes](./lostpaw-network/README.md#dependency-maintenance) track the outstanding transitive audit findings.

## Production and Heroku

Production requires MongoDB, HTTPS, a random signing secret, explicit frontend origins, and correctly configured proxy trust. Follow the [production configuration](./lostpaw-network/README.md#production) and [security requirements](./lostpaw-network/README.md#authentication-security) before deploying.

The Heroku [`Procfile`](./lostpaw-network/Procfile) lives inside the application subfolder. A deployment must use `lostpaw-network/` as its application root or provide an equivalent subdirectory build setup. A GitHub push alone does not confirm that a Heroku deployment is configured or healthy.
