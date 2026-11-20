# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install dependencies (including workspaces)
RUN npm install --workspaces --ignore-scripts

# Copy source code
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY shared/src ./shared/src
COPY shared/tsconfig.json ./shared/

# Build shared first, then server
RUN npm run build --workspace=shared && npm run build --workspace=server

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY shared/package*.json ./shared/

# Install production dependencies only
RUN npm install --workspaces --omit=dev --ignore-scripts

# Copy built files
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/dist ./shared/dist

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server/dist/index.js"]