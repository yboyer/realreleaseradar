FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS deps
RUN apk add --no-cache jq
WORKDIR /app
COPY package.json package-lock.json /tmp/
COPY front/package.json /app/front/package.json
RUN jq 'del(.version)' < /tmp/package.json > /app/package.json
RUN jq 'del(.packages."".version) | del(.version)' < /tmp/package-lock.json > /app/package-lock.json

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build-front
EXPOSE 3000
WORKDIR /app
RUN apk --no-cache add make build-base
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/front/package.json ./front/package.json
RUN npm ci --ignore-scripts
COPY front ./front
RUN npm run build --workspace front

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS production-deps
WORKDIR /app
RUN apk --no-cache add python3 make build-base
COPY --from=deps /app/package.json /app/package-lock.json /app/
COPY --from=deps /app/front/package.json ./front/package.json
RUN npm ci --omit=dev --ignore-scripts --workspaces=false

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
EXPOSE 3000
ENV NODE_ENV=production
WORKDIR /app
RUN apk --no-cache add curl
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build-front /app/front/dist /app/static
COPY --chown=node:node . .
RUN mkdir -p /src/users/dbs && chown -R node:node /src
VOLUME ["/src/users/dbs"]
USER node
CMD node index.js
