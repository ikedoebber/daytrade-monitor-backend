# 🚀 Day Trade Backend API

Backend API para o sistema de monitoramento de operações de day trade.

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL
- Docker (opcional)

## 🚀 Instalação

### Local

\`\`\`bash
npm install
npm start
\`\`\`

### Docker

\`\`\`bash
docker build -t daytrade-backend .
docker run -p 3001:3001 --env-file .env daytrade-backend
\`\`\`

## 🔧 Variáveis de Ambiente

Crie um arquivo `.env`:

\`\`\`env
DB_HOST=apps_postgres
DB_PORT=5432
DB_NAME=apps
DB_USER=postgres
DB_PASSWORD=sua_senha
PORT=3001
\`\`\`

## 📡 Endpoints

### Autenticação

- `POST /api/login` - Login
- `POST /api/register` - Cadastro

### Operações

- `GET /api/operacoes/:userId` - Listar operações
- `POST /api/operacoes` - Criar operação
- `DELETE /api/operacoes/:id` - Deletar operação

### Configurações

- `GET /api/configuracao/:userId` - Buscar config
- `POST /api/configuracao` - Salvar config

### Diários

- `GET /api/diarios/:userId` - Listar diários
- `POST /api/diarios` - Criar diário
- `DELETE /api/diarios/:id` - Deletar diário

### Outros

- `GET /health` - Health check
- `GET /` - Info da API

## 🗄️ Tabelas Criadas

- `dt_users` - Usuários
- `dt_operacoes` - Operações de trading
- `dt_configuracoes` - Configurações por usuário
- `dt_diarios` - Diários de trading

## 📦 Deploy no EasyPanel

1. Crie um novo App Service
2. Source: GitHub (ou Docker)
3. Environment Variables: Cole as vars do .env
4. Port: 3001
5. Deploy!

URL da API será algo como:
`https://daytrade-api.easypanel.host`
