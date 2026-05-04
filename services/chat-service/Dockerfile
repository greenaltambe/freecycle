FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY services/chat-service/package.json ./services/chat-service/
WORKDIR /app/services/chat-service
RUN npm install --omit=dev --install-links

COPY services/chat-service/src ./src

ENV NODE_ENV=production
EXPOSE 4004
CMD ["node", "src/server.js"]
