FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY services/user-service/package.json ./services/user-service/
WORKDIR /app/services/user-service
RUN npm install --omit=dev --install-links

COPY services/user-service/src ./src

ENV NODE_ENV=production
EXPOSE 4001
CMD ["node", "src/server.js"]
