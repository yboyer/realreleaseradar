FROM node:9.5.0-alpine

WORKDIR /src

ENV NODE_ENV=production

# Packages
COPY package.json .
RUN npm i --ignore-scripts --only=prod && \
    npm rb && \
    npm prune

# Files
COPY . .

EXPOSE 3000

VOLUME ["/src/users/dbs"]

CMD ["npm", "start"]
