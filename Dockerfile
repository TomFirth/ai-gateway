# syntax=docker/dockerfile:1

FROM node:20-alpine

RUN apk add --no-cache git

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 1234

CMD ["npm", "start"]
