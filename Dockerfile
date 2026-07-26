FROM node:22-bookworm-slim

WORKDIR /app

# Install pnpm directly instead of using Corepack. Railway's Corepack wrapper
# is the source of the deployment error this image avoids.
RUN npm install --global pnpm@11.3.0

COPY . .

# Railway supplies service variables to Docker as build arguments. Expo embeds
# EXPO_PUBLIC_* values into the browser bundle, so expose them before export.
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}
ENV EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY}

RUN pnpm install --frozen-lockfile
RUN pnpm -C artifacts/api-server run build \
  && pnpm -C artifacts/lookly exec expo export --platform web

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.mjs"]
