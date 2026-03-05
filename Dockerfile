# ETAPA 1: Construcción (Build)
FROM node:18-alpine AS build

WORKDIR /app

# Copiamos solo lo necesario para instalar dependencias
COPY package*.json ./
RUN npm install

# Copiamos el resto del código y compilamos
COPY . .
RUN npm run build

# ETAPA 2: Servidor de Producción
# Usamos Nginx para servir los archivos estáticos de forma ultra rápida
FROM nginx:stable-alpine

# Copiamos los archivos compilados desde la etapa anterior
COPY --from=build /app/dist /usr/share/nginx/html

# Copiamos una configuración de Nginx para que las rutas de React funcionen (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
