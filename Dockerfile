FROM node:14-alpine

WORKDIR /src

ENV NODE_ENV=production

# Packages
COPY package.json .
COPY package-lock.json .
RUN yarn ci

# Files
COPY . .

EXPOSE 3000

VOLUME ["/src/users/dbs"]

CMD node src/index.js
