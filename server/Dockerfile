# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install dependencies
RUN npm install --ignore-scripts

# Copy source code
COPY server/src ./src
COPY server/tsconfig.json ./

# Build server
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files
COPY server/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts

# Copy built files
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/index.js"]