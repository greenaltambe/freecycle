FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY services/notification-service/package.json ./services/notification-service/
WORKDIR /app/services/notification-service
RUN npm install --omit=dev --install-links

COPY services/notification-service/src ./src

ENV NODE_ENV=production
EXPOSE 4005
CMD ["node", "src/server.js"]
