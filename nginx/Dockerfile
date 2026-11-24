# Build Stage: compila Tailwind a partir de las clases usadas en index.html
FROM node:22-alpine AS css
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tailwind.config.js ./
COPY styles/ ./styles/
COPY index.html ./
COPY js/ ./js/
RUN mkdir -p assets && npm run build:css

FROM nginx:alpine

COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy web files
COPY index.html /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY favicon.svg /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY js/ /usr/share/nginx/html/js/
COPY --from=css /build/assets/tailwind.css /usr/share/nginx/html/assets/tailwind.css

EXPOSE 80 81

CMD ["nginx", "-g", "daemon off;"]
