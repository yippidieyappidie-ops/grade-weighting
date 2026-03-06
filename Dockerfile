# Etapa 1: Build
FROM node:18-alpine AS build
WORKDIR /app

# Copiamos dependencias e instalamos
COPY package*.json ./
RUN npm install

# Pasamos las variables de entorno de Firebase para que se inyecten en el build de Vite
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY
ENV VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN
ENV VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID
ENV VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET
ENV VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID
ENV VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

# Copiamos el resto del código y generamos la carpeta /dist
COPY . .
RUN npm run build

# Etapa 2: Producción
FROM nginx:stable-alpine
# Copiamos el resultado del build a la carpeta de Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Copiamos nuestra config de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
