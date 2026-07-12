# syntax=docker/dockerfile:1

FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 1234

CMD ["npm", "start"]
