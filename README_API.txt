SMIT LEGAL ALL-IN-ONE API
==========================
Start:
  npm install
  npm start

API:
  GET  /api/health
  POST /api/orders
  GET  /api/orders/:id
  PATCH /api/orders/:id/payment
  PATCH /api/orders/:id/status

For production, replace the JSON file with a hosted database and configure
WhatsApp/payment provider credentials as environment variables. Never commit
API secrets into this ZIP.
