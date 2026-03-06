# Usamos Nginx para servir el contenido
FROM nginx:stable-alpine

# Borramos el contenido por defecto de Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiamos todo tu código a la carpeta de Nginx
# Esto incluye las carpetas admin, app, colegios y el index del root
COPY . /usr/share/nginx/html/

# Copiamos la configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
