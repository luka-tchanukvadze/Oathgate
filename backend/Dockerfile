# One image, three containers
# The api, the worker and notifications are the same build started three
# different ways, so the Pi pulls one image instead of three that would be
# almost entirely identical layers
#
# Alpine is safe here because the only native dependency is argon2, and it
# ships a prebuilt musl binary for armv8

FROM node:22-alpine AS deps

WORKDIR /app

# Only the lockfile, so this layer is reused until a dependency actually changes
COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Two clients, because notifications has its own database and its own schema
# The paths inside a prisma config are relative to that config, not to the cwd
RUN npx prisma generate \
 && npx prisma generate --config apps/notifications/prisma.config.ts \
 && npm run build \
 && npm prune --omit=dev


FROM node:22-alpine AS runtime

WORKDIR /app

# Not root, and a fixed id so a volume written by one build is still readable
# by the next
RUN addgroup -g 1001 oathgate && adduser -u 1001 -G oathgate -S oathgate

# node_modules arrives already pruned, so no build tools, no compiler, no tests
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# The schemas and their migrations ship too, because the migrate container runs
# from this same image
# prisma and dotenv are ordinary dependencies rather than dev ones for exactly
# this reason: the prune would otherwise take the CLI and the config's own
# import away and migrations would fail inside the container
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/apps/notifications/prisma ./apps/notifications/prisma
COPY --from=build /app/apps/notifications/prisma.config.ts ./apps/notifications/prisma.config.ts

USER oathgate

ENV NODE_ENV=production

EXPOSE 5002

# Compose overrides this for the worker and for notifications
CMD ["node", "dist/apps/api/src/main"]
