FROM node:lts-alpine

WORKDIR /src

ENV NODE_ENV=production

# Packages
COPY package.json yarn.lock ./
RUN yarn ci

# Files
COPY . .

EXPOSE 3000

VOLUME ["/src/users/dbs"]

CMD node index.js
