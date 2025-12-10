// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: '*' // puedes restringir a tu dominio: e.g. 'https://publicidadjuancarvajal.site'
}));

const PORT = process.env.PORT || 3000;
const ADDI_TOKEN_URL = process.env.ADDI_TOKEN_URL || 'https://api.addi.com/auth/oauth/token';
const ADDI_ORDER_URL = process.env.ADDI_ORDER_URL || 'https://api.addi.com/payments/v1/orders';
const CLIENT_ID = process.env.ADDI_CLIENT_ID;
const CLIENT_SECRET = process.env.ADDI_CLIENT_SECRET;
const ALLY_SLUG = process.env.ADDI_ALLY_SLUG; // e.g. publicidadjuancarvajal-ecommerce

if (!CLIENT_ID || !CLIENT_SECRET || !ALLY_SLUG) {
  console.warn('⚠️  Missing ADDI_CLIENT_ID, ADDI_CLIENT_SECRET or ADDI_ALLY_SLUG env vars.');
}

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

/**
 * POST /create-order
 * body: { amount: number, description: string, returnUrl?: string }
 * returns: { redirectUrl } or error
 */
app.post('/create-order', async (req, res) => {
  try {
    const { amount, description, returnUrl } = req.body;
    if (!amount || !description) {
      return res.status(400).json({ error: 'amount and description required' });
    }

    // 1) get access token
    const tokenResp = await axios.post(ADDI_TOKEN_URL, {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    const accessToken = tokenResp.data && tokenResp.data.access_token;
    if (!accessToken) {
      console.error('No access token in response', tokenResp.data);
      return res.status(502).json({ error: 'no_token', debug: tokenResp.data });
    }

    // 2) create order
    const orderPayload = {
      amount: amount,
      currency: "COP",
      description,
      allySlug: ALLY_SLUG
    };

    // If frontend provided returnUrl, pass it
    if (returnUrl) orderPayload.returnUrl = returnUrl;

    const orderResp = await axios.post(ADDI_ORDER_URL, orderPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const orderData = orderResp.data;
    // Expecting redirectUrl (Addi typical response)
    if (!orderData || (!orderData.redirectUrl && !orderData.data?.redirectUrl)) {
      console.error('Unexpected order response', orderData);
      return res.status(502).json({ error: 'no_redirect_url', debug: orderData });
    }

    // Normalize
    const redirectUrl = orderData.redirectUrl || orderData.data?.redirectUrl;

    return res.json({ redirectUrl });

  } catch (err) {
    console.error('Error creating Addi order:', err?.response?.data || err.message || err);
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { message: err.message };
    return res.status(status).json({ error: 'addi_error', detail: data });
  }
});

app.listen(PORT, () => {
  console.log(`Addi backend running on port ${PORT}`);
});
