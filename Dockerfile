FROM node:20-alpine

WORKDIR /app

# git is required at runtime, not just build time: the owner-only .update
# command shells out to git to fast-forward the checkout.
RUN apk add --no-cache git ffmpeg tini

COPY package*.json ./
# Every dependency is used at runtime and the test scripts ship with the image,
# so a full install keeps `npm test` working inside the container.
RUN npm ci --no-audit --no-fund

COPY . .

ENV NODE_ENV=production
# Tells .restart that exiting is safe because the container will be restarted.
ENV RESTART_SUPERVISED=true

# The session and its Signal keys must outlive a redeploy, otherwise the bot is
# logged out every time the image is rebuilt.
VOLUME ["/app/session", "/app/data"]

# PID 1 in a container does not reap children or forward signals by default,
# which leaves zombies and makes .restart hang instead of exiting cleanly.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]
