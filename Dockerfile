# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

ARG NPM_TOKEN
COPY package.json ./
RUN echo "@hoelk-f:registry=https://npm.pkg.github.com/" > .npmrc \
    && echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc \
    && npm install \
    && npm update @hoelk-f/semantic-data-catalog@latest \
    && rm -f .npmrc

COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["npm","start"]
