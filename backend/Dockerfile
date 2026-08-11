# 1. Imagem base estável e leve do Node.js
FROM node:20-alpine

# 2. Instalar o Nest CLI globalmente dentro do contentor
RUN npm install -g @nestjs/cli

# 3. Definir o diretório de trabalho dentro do contentor
WORKDIR /usr/src/app

RUN apk add --no-cache curl

# 4. Copiar os ficheiros de dependências primeiro (aproveita a cache de camadas do Docker)
COPY package*.json ./

# 5. Instalar todas as dependências (as normais e as de dev para o live-reload)
RUN npm install

# 6. Copiar o resto do código do teu backend para dentro do contentor
COPY . .

RUN npx prisma generate

# 7. Expor a porta que o teu NestJS vai usar (porta 3000)
EXPOSE 8000

# criacao de recursos para diferete users
#RUN nest g resource users

# 8. Comando para iniciar o Nest em modo watch (hot-reload em tempo real)
CMD ["npm", "run", "start:dev"]