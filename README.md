<p align="center">
    <img height="350" src="https://raw.githubusercontent.com/yboyer/realreleaseradar/master/.github/large.jpg">
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
  -v $PWD/releaseradar_data/:/src/users/dbs \
  -p 3000:3000 \
  ghcr.io/yboyer/realreleaseradar
```

<p align="center">
  <img width="800" src="https://raw.githubusercontent.com/yboyer/realreleaseradar/master/.github/screen.png">
</p>

## Development

- `apps/backend/`: Express server, Spotify crawler, configuration and local data.
- `apps/frontend/`: Vue application and frontend build.
- Root: workspace scripts, shared tooling, lockfile and Docker build.

Install Node.js and npm, then install dependencies from the repository root.
Both applications in `apps/` are npm workspaces with a shared root lockfile. Vite+ is installed locally;
no global `vp` installation is required:

```shell
npm ci
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
npm start
```

```shell
# Terminal 2: build the frontend and rebuild on changes
npm run dev:build
```

Once the frontend build completes, open `http://localhost:3000`. Express serves the
generated files in `apps/backend/static/`. Automatic Friday updates run only when
`NODE_ENV=production`; `npm start` uses development mode.

To run the frontend Vite development server independently, use `npm run dev` from
`apps/frontend/`. It has no backend proxy configured, so use the setup above for Spotify
authentication and backend routes.

From the repository root, run `npm run lint` to check formatting,
lint, and Vue types across the project. From `apps/frontend/`, the same commands check only
the frontend. This includes the explicit Vue type-checking task.
There are currently no test files.

From the repository root, run `npm run build` to build the frontend
into `apps/frontend/dist/`, or run `npm run build` from `apps/frontend/`. npm scripts automatically
use the local Vite+ executable.

## License

MIT © [Yoann Boyer](http://yoannboyer.com)
