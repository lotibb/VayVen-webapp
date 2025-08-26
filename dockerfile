# Use official Node.js image
FROM node:20

# Set working directory
WORKDIR /app

# Copy and install backend dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend code
COPY backend/ .

# Copy frontend files to public folder (served by Express)
COPY frontend ./public

# Expose the port your app runs on
EXPOSE 3000

# Start the backend server
CMD ["node", "server.js"]
