FROM node:20-alpine

WORKDIR /app

COPY shared ./shared
COPY services/location-service/package.json ./services/location-service/
WORKDIR /app/services/location-service
RUN npm install --omit=dev --install-links

COPY services/location-service/src ./src

ENV NODE_ENV=production
EXPOSE 4003
CMD ["node", "src/server.js"]
