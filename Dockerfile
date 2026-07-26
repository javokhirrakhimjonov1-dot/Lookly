FROM node:22-bookworm-slim

WORKDIR /app

# Install pnpm directly instead of using Corepack. Railway's Corepack wrapper
# is the source of the deployment error this image avoids.
RUN npm install --global pnpm@11.3.0

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm -C artifacts/api-server run build \
  && pnpm -C artifacts/lookly exec expo export --platform web

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.mjs"]
