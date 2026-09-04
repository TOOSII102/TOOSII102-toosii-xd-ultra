FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git ffmpeg

COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY . .

ENV NODE_ENV=production

CMD ["node", "index.js"]
