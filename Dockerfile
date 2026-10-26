FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6 AS deps
RUN apk add --no-cache jq
WORKDIR /app
COPY package.json package-lock.json /tmp/
COPY apps/frontend/package.json /app/apps/frontend/package.json
COPY apps/backend/package.json /app/apps/backend/package.json
RUN jq 'del(.version)' < /tmp/package.json > /app/package.json
RUN jq 'del(.packages."".version) | del(.version)' < /tmp/package-lock.json > /app/package-lock.json

FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build-front
EXPOSE 3000
WORKDIR /app
RUN apk --no-cache add make build-base
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
RUN npm ci --ignore-scripts
COPY apps/frontend ./apps/frontend
RUN npm run build

FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS production-deps
WORKDIR /app
RUN apk --no-cache add python3 make build-base
COPY --from=deps /app/package.json /app/package-lock.json /app/
COPY --from=deps /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --from=deps /app/apps/backend/package.json ./apps/backend/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace apps/backend --include-workspace-root=false

FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
EXPOSE 3000
ENV NODE_ENV=production
WORKDIR /app
RUN apk --no-cache add curl
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build-front /app/apps/frontend/dist /app/apps/backend/static
COPY --chown=node:node apps/backend ./apps/backend
COPY .github/large.jpg ./.github/large.jpg
RUN mkdir -p /app/apps/backend/users/dbs && chown -R node:node /app/apps/backend/users/dbs
VOLUME ["/app/apps/backend/users/dbs"]
USER node
WORKDIR /app/apps/backend
CMD ["node", "index.js"]
