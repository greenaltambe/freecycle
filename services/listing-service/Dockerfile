FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY services/listing-service/package.json ./services/listing-service/
WORKDIR /app/services/listing-service
RUN npm install --omit=dev --install-links

COPY services/listing-service/src ./src

ENV NODE_ENV=production
EXPOSE 4002
CMD ["node", "src/server.js"]
