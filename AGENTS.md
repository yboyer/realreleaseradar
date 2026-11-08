# Real Release Radar

Node.js/Express backend that updates Spotify playlists, with a Vue frontend in
`apps/frontend/`. Read [README.md](README.md) for setup and local development.

## Repository layout

- `apps/backend/index.js`: Spotify crawler and production Friday schedule.
- `apps/backend/auth.js`, `apps/backend/api.js`, `apps/backend/tools.js`: Express routes, Spotify authentication and API helpers.
- `apps/backend/config.js`: environment variables and defaults.
- `apps/backend/users/`: NeDB access; `apps/backend/users/dbs/` contains persistent user data and tokens.
- `apps/frontend/src/`: Vue application.
- `apps/backend/static/`: generated frontend served by Express; do not edit directly.
- `Dockerfile`, `.github/workflows/`: container build and automation.

## Project commands

The backend and frontend are pnpm workspaces declared in `pnpm-workspace.yaml`.
Use the pnpm version in `package.json` and the Node.js version in `.node-version`.
Run `pnpm install --frozen-lockfile` at the root. Both packages share `pnpm-lock.yaml`.

From the repository root:

- `pnpm start`: start the development backend using `apps/backend/.env`.
- `pnpm dev:build`: watch and build the frontend into `apps/backend/static/`.
- `pnpm build`: build the frontend into `apps/frontend/dist/`.
- `pnpm lint`: apply Biome formatting and safe fixes, check rules, then check Vue types with `vue-tsc --noEmit`.

Use `pnpm --filter frontend lint` for frontend-only validation.
Biome extends `@yboyer/config/biome.json` with the Vue domain enabled.
There are currently no test files. Validate changes with `pnpm lint` and `pnpm build`.
Do not start the backend to validate tooling: it can access Spotify and user data.

Keep `apps/backend/.env` and `apps/backend/users/dbs/` out of commits; they contain secrets and user data.
