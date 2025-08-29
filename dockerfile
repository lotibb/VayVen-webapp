# Use official Node.js image
FROM node:20

# Set working directory
WORKDIR /app

# Speed & reproducibility
ENV NODE_ENV=production

# 1) Install backend deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

# 2) Copy backend source
COPY backend/ ./

# 3) Copy frontend static files to the folder served by Express
#    (this is the key fix: copy frontend/public -> /app/public)
COPY frontend/public/ ./public

# 4) Expose API port
EXPOSE 3000

# 5) Start server
CMD ["node", "server.js"]
