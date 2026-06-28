# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /app

# Install system dependencies (poppler-utils is required for pdftotext extraction)
RUN apt-get update && apt-get install -y \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

# Copy built code from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

# Run the app
CMD ["node", "dist/server.js"]
