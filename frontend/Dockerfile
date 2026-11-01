# SkolAR Labs Analytics - the web dashboard. No npm packages at all: just Node serving the files in public/.
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
USER node
EXPOSE 8080
# API_URL (the backend's address) is set when you deploy, not baked in.
CMD ["node", "server.js"]
