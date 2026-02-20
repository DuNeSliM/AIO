FROM node:22-alpine AS build

WORKDIR /app

# Install deps with a reproducible lockfile-based install.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy only files needed for the Vite production build.
COPY index.html ./
COPY postcss.config.cjs tailwind.config.cjs tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY src ./src

RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine

# Serve compiled frontend assets.
COPY --from=build /app/dist /usr/share/nginx/html

# SPA routing support and a simple health endpoint for probes.
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location = /healthz {
        access_log off;
        default_type text/plain;
        return 200 "ok\n";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 8080
