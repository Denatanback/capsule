FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY apps/web/package.json ./apps/web/
RUN cd apps/web && npm install

COPY apps/web ./apps/web
RUN cd apps/web && npm run build

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
