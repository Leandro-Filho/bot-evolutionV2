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
