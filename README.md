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
Com esse código copiado, você deve pegar e jogar em um conversor de Base64 para Imagem. Recomendo esse do seguinte link: https://base64.guru/converter/decode

Com o o QrCode em mãos, entre em **"Conectar dispositivos"** dentro do próprio Whatsapp e escaneie o QrCode, assim a conexão da Evolution vai estar funcionando.

### 6. Criar o bot (Node.js)

Aqui é uma etapa que pode alterar bastante conforme você vai adequando meu projeto ao seu, então fique tranquilo se tiver dando basntante erro.

Então para começar esse passo, instale as dependências:

```bash
mkdir bot && cd bot
npm init -y
npm install express axios dotenv
```

Depois, crie um **server.js** dentro da pasta **bot** criada na seção anterior e copie o seguinte código:

```JavaScript
require("dotenv").config();

console.log("PORT =", process.env.PORT);
console.log("EVOLUTION_URL =", process.env.EVOLUTION_URL);
console.log("EVOLUTION_INSTANCE =", process.env.EVOLUTION_INSTANCE);
console.log("EVOLUTION_API_KEY =", process.env.EVOLUTION_API_KEY);


const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3001;
const EVOLUTION_URL = process.env.EVOLUTION_URL;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

function normalizeNumber(remoteJid) {
  if (!remoteJid || typeof remoteJid !== "string") return null;
  return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

function extractRemoteJid(body) {
  return (
    body?.data?.key?.remoteJid ||
    body?.data?.message?.key?.remoteJid ||
    body?.key?.remoteJid ||
    null
  );
}

function extractFromMe(body) {
  return (
    body?.data?.key?.fromMe ??
    body?.data?.message?.key?.fromMae ??
    body?.key?.fromMe ??
    false
  );
}

function extractMessageText(body) {
  const message =
    body?.data?.message ||
    body?.data?.messages?.[0]?.message ||
    body?.message ||
    {};

  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.buttonsResponseMessage?.selectedButtonId ||
    message?.listResponseMessage?.title ||
    message?.templateButtonReplyMessage?.selectedId ||
    null
  );
}

async function sendText(number, text) {
  const url = `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const payload = {
    number,
    text,
  };

  const headers = {
    "Content-Type": "application/json",
    apikey: EVOLUTION_API_KEY,
  };

  const response = await axios.post(url, payload, { headers });

  console.log("Resposta da Evolution no sendText:");
  console.log(JSON.stringify(response.data, null, 2));

  return response.data;
}

app.get("/", (req, res) => {
  res.status(200).send("Bot Evolution rodando.");
});

app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    console.log("\n================ WEBHOOK RECEBIDO ================");
    console.log(JSON.stringify(body, null, 2));

    const event = body?.event;
    console.log("Evento:", event);

    if (event !== "MESSAGES_UPSERT" && event !== "messages.upsert") {
      console.log("Ignorado: evento diferente de MESSAGES_UPSERT");
      return res.sendStatus(200);
    }

    const remoteJid = extractRemoteJid(body);
    const fromMe = extractFromMe(body);
    const text = extractMessageText(body);

    console.log("remoteJid:", remoteJid);
    console.log("fromMe:", fromMe);
    console.log("text:", text);

    if (!remoteJid) {
      console.log("Ignorado: remoteJid não encontrado");
      return res.sendStatus(200);
    }

    if (fromMe) {
      console.log("Ignorado: mensagem enviada por mim mesmo");
      return res.sendStatus(200);
    }

    if (remoteJid.endsWith("@g.us")) {
      console.log("Ignorado: mensagem de grupo");
      return res.sendStatus(200);
    }

    const number = normalizeNumber(remoteJid);
    const cleanText = text?.trim().toLowerCase();

    console.log("number:", number);
    console.log("cleanText:", cleanText);

    if (!number || !cleanText) {
      console.log("Ignorado: número ou texto ausente");
      return res.sendStatus(200);
    }

    if (cleanText === "oi") {
      console.log("Condição atendida. Enviando resposta...");
      await sendText(number, "Fala! Aqui é o bot 🚀");
      console.log(`Resposta enviada para ${number}`);
    } else {
      console.log("Mensagem recebida, mas não bateu com 'oi'");
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("\n=========== ERRO NO WEBHOOK ===========");
    console.error(error?.response?.data || error.message || error);
    return res.sendStatus(500);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});

```
Esse código será responsável por responder **APENAS MENSAGENS DE PESSOAS E NA ESTRUTURA "OI"**. Usei isso para testar na forma mais básica possível.

## 7. Para Rodar de Fato

Você irá precisar de dois terminais: um para deixar o server.js rodando e outro para conecatr ao WebHook.

O primeiro, você roda o **server.js**

```bash
node server.js
```
No segundo, conecte ao WebHook

```bash
curl -X POST "http://localhost:8080/webhook/set/default" \
  -H "Content-Type: application/json" \
  -H "apikey: SUA_API_KEY" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://SEU_IP:3000/webhook",
      "events": ["MESSAGES_UPSERT","CONNECTION_UPDATE"]
    }
  }'
```

As ordens podem sim alterar o resultado, então teste rodando um primeiro e depois o outro e vice versa.

### 8. Testar Se Deu Certo.

Agora, peça para alguém mandar um simples "oi" para você. Caso você mesmo responda "Fala! Aqui é o bot 🚀", parabéns, está funcionando. Caso der erro, debugue sozinho ou repita os passos!

### Algumas Coisas que me Ajudaram a Debugar

```bash
curl http://SEU_IP:3000
```
Vai verificar se o bot ta vivo

```bash
docker logs -f evolution_api
```
Vai mostrar para você TODOS os logs a partir da conexão da API, assim, você sabe onde pode estar o erro

```bash
curl -X GET http://localhost:8080/instance/connectionState/default \
  -H "apikey: SUA_API_KEY"
```

Verifica se as instâncias desconectaram.


# BOA SORTE E USE COM MODERAÇÃO