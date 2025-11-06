FROM node:22-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install --production

# Copiar código
COPY . .

# Expor porta
EXPOSE 3001

# Saúde do container
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Iniciar aplicação
CMD ["node", "server.js"]