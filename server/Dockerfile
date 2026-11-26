# Small production image for the API.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
USER node
EXPOSE 4000
# Apply any pending migrations, then start the server.
CMD ["sh", "-c", "node src/db/migrate.js && node src/index.js"]
