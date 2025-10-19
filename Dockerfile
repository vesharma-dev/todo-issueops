# Use Node.js 22 with pnpm pre-installed
FROM node:22-slim

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Labels for GitHub to read your action
LABEL "com.github.actions.name"="TODO Bot"
LABEL "com.github.actions.description"="A github action that automatically creates, updates, and closes GitHub issues from TODO comments in your code."
# Here are all of the available icons: https://feathericons.com/
LABEL "com.github.actions.icon"="git-pull-request"
# And all of the available colors: https://developer.github.com/actions/creating-github-actions/creating-a-docker-container/#label
LABEL "com.github.actions.color"="white"

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Copy TypeScript source files
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm build

# Remove devDependencies to reduce image size
RUN pnpm prune --prod

# Run the compiled JavaScript
ENTRYPOINT ["node", "/app/dist/index.js"]
