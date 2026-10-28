# Use Node 22 LTS (Debian slim)
FROM node:24-bookworm-slim

# Set working directory
WORKDIR /app

# Install build dependencies in case native modules need compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies inside the Linux environment
RUN npm install

# Copy application source code
COPY . .

# Expose NestJS port
EXPOSE 3000

# Start NestJS in dev watch mode
CMD ["npm", "run", "start:dev"]

