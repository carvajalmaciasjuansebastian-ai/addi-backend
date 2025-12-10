// server.js — versión final y corregida
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const qs = require('qs');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: '*', // en producción puedes restringirlo a tu dominio
}));

// -----------------------------
// VARIABLES DE ENTORNO
// -----------------------------
const PORT = process.env.PORT || 10000;

const ADDI_TOKEN_URL = process.env.ADDI_TOKEN_URL || 'https://api.addi.com/auth/v1/oauth/token';
const ADDI_ORDER_URL = process.env.ADDI_ORDER_URL || 'https://api.addi.com/payments/v1/orders/public';

const CLIENT_ID = process.env.ADDI_CLIENT_ID;
const CLIENT_SECRET = process.env.ADDI_CLIENT_SECRET;
const ALLY_SLUG = process.env.ADDI_ALLY_SLUG;

if (!CLIENT_ID || !CLIENT_SECRET || !ALLY_SLUG) {
  console.warn("⚠️ Missing ADDI_CLIENT_ID, ADDI_CLIENT_SECRET or ADDI_ALLY_SLUG");
}

// -----------------------------
// ENDPOINT DE SALUD
// -----------------------------
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// -----------------------------
// CREAR ORDEN ADDI
// -----------------------------
app.post('/create-order', async (req, res) => {
  try {
    const { amount, description, returnUrl } = req.body;

    if (!amount || !description) {
      return res.status(400).json({ error: "amount and description required" });
    }

    // 1. Obtener token usando x-www-form-urlencoded
    const tokenBody = qs.stringify({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const tokenResp = await axios.post(ADDI_TOKEN_URL, tokenBody, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    const accessToken = tokenResp.data?.access_token;

    if (!accessToken) {
      console.error("⚠️ Addi did not return a token:", tokenResp.data);
      return res.status(500).json({ error: "no_token_from_addi" });
    }

    // 2. Crear orden
    const orderPayload = {
      amount,
      currency: "COP",
      description,
      allySlug: ALLY_SLUG,
      returnUrl: returnUrl || "https://publicidadjuancarvajal.site/gracias"
    };

    const orderResp = await axios.post(ADDI_ORDER_URL, orderPayload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      }
    });

    const redirectUrl = orderResp.data?.redirectUrl;

    if (!redirectUrl) {
      console.error("⚠️ No redirectUrl in Addi response:", orderResp.data);
      return res.status(500).json({ error: "no_redirect_url", raw: orderResp.data });
    }

    return res.json({ redirectUrl });

  } catch (err) {
    console.error("❌ Error creating Addi order:", err.response?.data || err);
    return res.status(err.response?.status || 500).json({
      error: "addi_error",
      detail: err.response?.data || err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🔥 Addi backend running on port ${PORT}`);
});






