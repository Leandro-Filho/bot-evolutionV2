# Projeto Funcional e Bem Replicável de Evolution API

A estrutura ficou bem simples:
```
WhatsApp → Evolution API → Webhook → Bot Node.js → Evolution API → WhatsApp
```

## Passo a Passo de Como Fazer Respostas Automáticas 

### Pré-requisitos

- Docker
- Docker Compose
- Node.js (para desenvolvimento local)
- npm

### 1. Subir infraestrutura (Evolution)

Faça um arquivo com o nome de **docker-compose.yml** com o seguinte código:

```yaml
services:
  postgres:
    image: postgres:16
    container_name: evolution_postgres_v2 #sempre mude esse nome para algo novo
    restart: always
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: evolution123
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    container_name: evolution_redis_v2 #sempre mude esse nome para algo novo
    restart: always
    ports:
      - "6380:6379"

  evolution:
    image: evoapicloud/evolution-api:v2.3.6
    container_name: evolution_api_v2 #sempre mude esse nome para algo novo
    restart: always
    depends_on:
      - postgres
      - redis
    ports:
      - "8081:8080" 
    env_file:
      - .env

volumes:
  postgres_data:
```

### 2. Configurar as Váriaveis

Agora, crie um .env para configurar as chaves e portas do projeto, seguindo o exemplo do .env.example que está na raiz do projeto:

```
APORT=3001
EVOLUTION_URL=http://localhost:8081
EVOLUTION_INSTANCE=default
EVOLUTION_API_KEY=COLOQUE_UMA_SENHA
```

### 3. Subir ambiente

Agora, suba o ambiente docker, gardando as informações colocadas no arquivo .yml

```bash
docker compose up -d
```

### 4. Criar instância do WhatsApp

```bash
curl -X POST http://localhost:8081/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_API_KEY" \
  -d '{
    "instanceName": "default",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": true
  }'
```

### 5. Conectar WhatsApp (QR Code)

```bash 
curl -X GET http://localhost:8081/instance/connect/default \
  -H "apikey: SUA_API_KEY"
```

Com esse código, ele vai gerar um código que seria o QrCode para conectar com o Whatsapp. O que você deve pegar dessa resposta? Apenas o conjunto de letras e caracteres depois da palavra **base64**: 

```bash
..."base64":"data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAVwAAAFc...
```
Com esse código copiado, você deve pegar e jogar em um conversor de Base64 para Imagem. Recomendo esse do seguinte link: 

