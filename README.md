<p align="center">
  <img
    height="350"
    src="https://raw.githubusercontent.com/yboyer/realreleaseradar/master/.github/large.jpg"
  />
  <p align="center"><i>Real Release Radar</i> Spotify's playlist</p>
</p>

> Creates and updates, every friday, a Release Radar playlist on Spotify with **all** your new weekly tracks.

- [https://spotify.yoannboyer.com](https://spotify.yoannboyer.com)

## Usage

### Setup

1. Go to [https://developer.spotify.com/my-applications/](https://developer.spotify.com/my-applications/)
2. Create an app
3. Get the client id and the client secret
4. Set your redirect url _([https://your.base.url/callback](https://your.base.url/callback) -> the `/callback` is important)_

```shell
docker run --name releaseradar \
  -e CLIENT_ID=$CLIENT_ID \
  -e CLIENT_SECRET=$CLIENT_SECRET \
  -e REDIRECT_URI=$REDIRECT_URI \
  -v $PWD/releaseradar_data/:/app/apps/backend/users/dbs \
  -p 3000:3000 \
  ghcr.io/yboyer/realreleaseradar
```

<p align="center">
  <img
    width="800"
    src="https://raw.githubusercontent.com/yboyer/realreleaseradar/master/.github/screen.png"
  />
</p>

## Development

- `apps/backend/`: Express server, Spotify crawler, configuration and local data.
- `apps/frontend/`: Vue application and frontend build.
- Root: workspace scripts, shared tooling, lockfile and Docker build.

Install the Node.js version from `.node-version` and pnpm from the `packageManager`
field in `package.json`. Both applications use pnpm workspaces and the shared
`pnpm-lock.yaml`:

```shell
pnpm install --frozen-lockfile
```

Copy the environment template into the backend workspace:

```shell
cp apps/backend/.env.template apps/backend/.env
```

Fill in `CLIENT_ID` and `CLIENT_SECRET` in `apps/backend/.env` using your Spotify app credentials.

Register the same redirect URI in your Spotify app settings. Environment variables
and defaults are defined in `apps/backend/config.js`. Keep `apps/backend/.env` and the persistent user data
in `apps/backend/users/dbs/` out of commits.

For local development with Spotify authentication, run these commands in two
terminals from the repository root:

```shell
# Terminal 1: start the backend using .env
pnpm start
```

```shell
# Terminal 2: build the frontend and rebuild on changes
pnpm dev:build
```

Once the frontend build completes, open `http://localhost:3000`. Express serves the
generated files in `apps/backend/static/`. Automatic Friday updates run only when
`NODE_ENV=production`; `pnpm start` uses development mode.

To run the frontend Vite development server independently, use `pnpm dev` from
`apps/frontend/`. It has no backend proxy configured, so use the setup above for Spotify
authentication and backend routes.

From the repository root, run `pnpm lint` to apply Biome formatting and safe fixes,
check code rules, and check Vue types.
Use `pnpm --filter frontend lint` to check only the frontend.
`pnpm --filter frontend typecheck` runs `vue-tsc --noEmit`.
There are currently no test files.

Run `pnpm build` to build into `apps/frontend/dist/`.
`pnpm dev:build` watches changes and builds into `apps/backend/static/`.
These commands use standalone Vite.

## License

MIT © [Yoann Boyer](http://yoannboyer.com)
