# Use Node.js 18 LTS
FROM node:18-slim

# Set environment variables
ENV NODE_ENV production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (Render/Koyeb handle this, but 5000 or 8080 is common)
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
