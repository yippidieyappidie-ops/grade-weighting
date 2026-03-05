# 1. Usamos una imagen de Node ligera
FROM node:18-alpine

# 2. Creamos el directorio de la app
WORKDIR /usr/src/app

# 3. Instalamos dependencias (esto se cachea para que sea rápido)
COPY package*.json ./
RUN npm install

# 4. Copiamos el resto de tu código
COPY . .

# 5. Exponemos el puerto que usa tu app (ajusta si es otro, ej: 8080)
EXPOSE 3000

# 6. Arrancamos la aplicación
CMD [ "npm", "start" ]
