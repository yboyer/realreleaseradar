FROM alpine:3.24.4@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf AS deps
RUN apk add --no-cache jq
WORKDIR /app
COPY package.json /tmp/
COPY pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY apps/frontend/package.json /app/apps/frontend/package.json
COPY apps/backend/package.json /app/apps/backend/package.json
RUN jq 'del(.version)' < /tmp/package.json > /app/package.json

FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build-front
EXPOSE 3000
WORKDIR /app
RUN apk --no-cache add make build-base
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=deps /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
RUN npm install --global "$(node -p "require('./package.json').packageManager")"
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY apps/frontend ./apps/frontend
RUN pnpm build

FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS production-deps
WORKDIR /app
RUN apk --no-cache add python3 make build-base
COPY --from=deps /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/
COPY --from=deps /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
RUN npm install --global "$(node -p "require('./package.json').packageManager")"
RUN pnpm --filter backend install --prod --frozen-lockfile --ignore-scripts

FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
EXPOSE 3000
ENV NODE_ENV=production
WORKDIR /app
RUN apk --no-cache add curl
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=production-deps /app/apps/backend/node_modules /app/apps/backend/node_modules
COPY --from=build-front /app/apps/frontend/dist /app/apps/backend/static
COPY --chown=node:node apps/backend ./apps/backend
COPY .github/large.jpg ./.github/large.jpg
RUN mkdir -p /app/apps/backend/users/dbs && chown -R node:node /app/apps/backend/users/dbs
VOLUME ["/app/apps/backend/users/dbs"]
USER node
WORKDIR /app/apps/backend
CMD ["node", "index.js"]
