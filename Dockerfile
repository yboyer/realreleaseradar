FROM endeveit/docker-jq AS packages
WORKDIR /app
COPY package.json package-lock.json /tmp/
RUN jq 'del(.version)' < /tmp/package.json > /app/package.json
RUN jq 'del(.packages."".version) | del(.version)' < /tmp/package-lock.json > /app/package-lock.json

FROM node:22.17.0-alpine AS build-front
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

FROM node:22.17.0-alpine AS production-deps
WORKDIR /app
RUN apk --no-cache add python3 make build-base
COPY --from=packages /app/package.json /app/package-lock.json /app/
RUN npm ci --omit=dev

FROM node:22.17.0-alpine
EXPOSE 3000
ENV NODE_ENV=production
WORKDIR /app
RUN apk --no-cache add curl
COPY --from=production-deps /app/node_modules /app/node_modules
COPY --from=build-front /app/dist /app/static
VOLUME ["/src/users/dbs"]
COPY . .
CMD node index.js
