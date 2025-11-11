FROM node:20-bookworm AS build

WORKDIR /app

COPY frontend/package*.json ./
# keep dev dependencies for vite build
RUN npm ci

COPY frontend ./

ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build


FROM nginx:1.27-bookworm AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
