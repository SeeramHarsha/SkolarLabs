# SkolAR Labs Analytics - the API (Express + MongoDB). Built for Google Cloud Run.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Cloud Run sets PORT (8080). Runs as the unprivileged "node" user.
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT:-8080}/status || exit 1
CMD ["node", "src/server.js"]
