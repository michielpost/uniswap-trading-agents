FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

FROM node:20-alpine AS runtime
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/

# Create data dir for SQLite with correct ownership before switching user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 \
    && mkdir -p /app/data && chown -R nodejs:nodejs /app/data

USER nodejs

EXPOSE 4000
ENV NODE_ENV=production
ENV DB_PATH=/app/data/agents.db

CMD ["node", "src/index.js"]
