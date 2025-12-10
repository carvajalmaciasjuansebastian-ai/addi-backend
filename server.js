// server.js – Integración correcta E-commerce
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;

const CLIENT_ID = process.env.ADDI_CLIENT_ID;
const CLIENT_SECRET = process.env.ADDI_CLIENT_SECRET;
const ALLY_SLUG = process.env.ADDI_ALLY_SLUG;

// 1. Obtener token de Auth0
async function getAccessToken() {
  const response = await axios.post(
    'https://addi.auth0.com/oauth/token',
    {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: "https://api.addi.com/integration"
    },
    { headers: { "Content-Type": "application/json" }}
  );

  return response.data.access_token;
}

// 2. Crear aplicación de crédito
app.post("/create-order", async (req, res) => {
  try {
    const { amount, description, returnUrl } = req.body;

    const token = await getAccessToken();

    const resp = await axios.post(
      'https://api.addi.com/integration/v1/online-applications',
      {
        allySlug: ALLY_SLUG,
        amount,
        currency: "COP",
        description,
        returnUrl
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        maxRedirects: 0, // IMPORTANTÍSIMO para capturar el 301
        validateStatus: status => status === 301
      }
    );

    const redirectUrl = resp.headers.location;
    return res.json({ redirectUrl });

  } catch (err) {
    console.error("Error creating application:", err.response?.data || err.message);
    return res.status(400).json({ error: "addi_error", detail: err.response?.data });
  }
});

app.listen(PORT, () => console.log("Addi backend running on", PORT));







