FROM endeveit/docker-jq@sha256:b7d34fd4c839d165af0359c1555918a5f48abcd6d313326c7bd3fa64a08dbd79 AS packages
WORKDIR /app
COPY package.json package-lock.json /tmp/
RUN jq 'del(.version)' < /tmp/package.json > /app/package.json
RUN jq 'del(.packages."".version) | del(.version)' < /tmp/package-lock.json > /app/package-lock.json

FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build-front
EXPOSE 3000
WORKDIR /app
RUN apk --no-cache add make build-base
COPY front/package.json front/package-lock.json ./
RUN npm ci
COPY front/public ./public
COPY front/tsconfig.json ./
COPY front/tsconfig.node.json ./
COPY front/vite.config.ts ./
COPY front/index.html ./
COPY front/src ./src
RUN npm run build

FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS production-deps
WORKDIR /app
RUN apk --no-cache add python3 make build-base
COPY --from=packages /app/package.json /app/package-lock.json /app/
RUN npm ci --omit=dev

FROM node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43
EXPOSE 3000
ENV NODE_ENV=production
WORKDIR /app
RUN apk --no-cache add curl
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build-front /app/dist /app/static
COPY --chown=node:node . .
RUN mkdir -p /src/users/dbs && chown -R node:node /src
VOLUME ["/src/users/dbs"]
USER node
CMD node index.js
