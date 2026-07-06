# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package config and lockfile
COPY package*.json ./

# Install dependencies including devDependencies for build
RUN npm ci

# Copy all source files
COPY . .

# Build SvelteKit application
RUN npm run build

# Remove development dependencies
RUN npm prune --production


# --- Run Stage ---
FROM node:20-alpine

WORKDIR /app

# Copy package.json to identify running context
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# Start SvelteKit production server
CMD ["node", "build/index.js"]
