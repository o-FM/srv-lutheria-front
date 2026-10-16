# syntax=docker/dockerfile:1.7
# Front (build estático do Vite) servido pelo Caddy, que também faz HTTPS automático
# (Let's Encrypt) e encaminha /api/* para a API. É a única porta pública do servidor.

FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src src
RUN npm run build

FROM caddy:2.10-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
