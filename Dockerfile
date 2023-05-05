FROM endeveit/docker-jq AS packages
WORKDIR /app
COPY package.json package-lock.json /tmp/
RUN jq 'del(.version)' < /tmp/package.json > /app/package.json
RUN jq 'del(.packages."".version) | del(.version)' < /tmp/package-lock.json > /app/package-lock.json

FROM node:18-alpine AS deps
WORKDIR /app
RUN apk --no-cache add python3 make build-base
COPY --from=packages /app/package.json /app/package-lock.json /app/
RUN npm ci

FROM node:18-alpine AS production-deps
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/package.json /app/package-lock.json /app/
RUN npm prune --omit=dev

FROM node:18-alpine
EXPOSE 3000
ENV NODE_ENV production
WORKDIR /app
COPY --from=production-deps /app/node_modules /app/node_modules
VOLUME ["/src/users/dbs"]
COPY . .
CMD node index.js
