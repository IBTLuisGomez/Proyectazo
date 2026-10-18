FROM nginx:alpine

COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy web files
COPY index.html /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY favicon.svg /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
