FROM node:14-alpine3.13

WORKDIR /src

ENV NODE_ENV=production

# Packages
COPY package.json .
COPY package-lock.json .
RUN npm ci && \
    npm rb && \
    npm prune

# Files
COPY . .

EXPOSE 3000

VOLUME ["/src/users/dbs"]

CMD ["npm", "start"]
