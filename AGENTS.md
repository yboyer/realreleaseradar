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

The backend and frontend are npm workspaces in `apps/backend/` and `apps/frontend/`. Run `npm ci`
once at the root. Both packages share the root `package-lock.json`.
Use npm scripts and the local Vite+ executable; no global `vp` is required. Dependency versions are defined in
the package manifests and root lockfile; the Docker runtime is defined in `Dockerfile`.

From the repository root:

- `npm start`: start the development backend using `apps/backend/.env`.
- `npm run dev:build`: watch and build the frontend into `apps/backend/static/` for the backend.
- `npm run build`: build the frontend into `apps/frontend/dist/`.
- `npm run lint`: check formatting, lint, and Vue types across the project.

Use `npm run lint` for validation; it includes the explicit `vue-tsc` task. There are currently no test files. From `apps/frontend/`, `npm run lint` checks only the frontend.

Keep `apps/backend/.env` and `apps/backend/users/dbs/` out of commits; they contain secrets and user data.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
