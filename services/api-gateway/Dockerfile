# Build context = repository root (see docker-compose.yml `context: .`).
FROM node:20-alpine

WORKDIR /app

# Copy the shared library first so its file: dep resolves at install time.
COPY shared ./shared

# Copy this service and install only its deps.
COPY services/api-gateway/package.json ./services/api-gateway/
WORKDIR /app/services/api-gateway
RUN npm install --omit=dev --install-links

COPY services/api-gateway/src ./src

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/server.js"]
