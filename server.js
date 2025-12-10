// server.js (corregido: token request como application/x-www-form-urlencoded)
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
  origin: '*' // en producción restringe a 'https://publicidadjuancarvajal.site'
}));

const PORT = process.env.PORT || 10000;
const ADDI_TOKEN_URL = process.env.ADDI_TOKEN_URL || 'https://api.addi.com/auth/v1/oauth/token';
const ADDI_ORDER_URL = process.env.ADDI_ORDER_URL || 'https://api.addi.com/payments/v1/orders';
const CLIENT_ID = process.env.ADDI_CLIENT_ID;
const CLIENT_SECRET = process.env.ADDI_CLIENT_SECRET;
const ALLY_SLUG = process.env.ADDI_ALLY_SLUG;

if (!CLIENT_ID || !CLIENT_SECRET || !ALLY_SLUG) {
  console.warn('⚠️  Missing ADDI_CLIENT_ID, ADDI_CLIENT_SECRET or ADDI_ALLY_SLUG env vars.');
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/create-order', async (req, res) => {
  try {
    const { amount, description, returnUrl } = req.body;

    if (!amount || !description) {
      return res.status(400).json({ error: 'amount and description required' });
    }

    // 1) Obtener access token
    const tokenPayload = qs.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    const tokenResp = await axios.post(ADDI_TOKEN_URL, tokenPayload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });

    const accessToken = tokenResp?.data?.access_token;

    if (!accessToken) {
      console.error('No access token in response', tokenResp.data);
      return res.status(502).json({ error: 'no_token', debug: tokenResp.data });
    }

    // 2) Crear orden en Addi
    const orderPayload = {
      amount: amount,
      currency: "COP",
      description,
      allySlug: ALLY_SLUG
    };

    if (returnUrl) orderPayload.returnUrl = returnUrl;

    const orderResp = await axios.post(ADDI_ORDER_URL, orderPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      timeout: 10000
    });

    const orderData = orderResp.data;
    const redirectUrl = orderData?.redirectUrl || orderData?.data?.redirectUrl;

    if (!redirectUrl) {
      console.error('Unexpected order response', orderData);
      return res.status(502).json({ error: 'no_redirect_url', debug: orderData });
    }

    return res.json({ redirectUrl });

  } catch (err) {
    const status = err?.response?.status || 500;
    const detail = err?.response?.data || err.message;
    console.error('Error creating Addi order:', detail);
    return res.status(status).json({ error: 'addi_error', detail });
  }
});

app.listen(PORT, () => {
  console.log(`Addi backend running on port ${PORT}`);
});





