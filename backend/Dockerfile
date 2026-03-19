FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy source
COPY src/ ./src/

# Non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 4000
ENV NODE_ENV=production

CMD ["node", "src/index.js"]
