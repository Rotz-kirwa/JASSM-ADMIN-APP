# JASSM-ADMIN-APP

Admin dashboard for JASSM PAY M-Pesa collections, customers, SMS notifications, and financial reports.

## Production Checklist

Set these server environment variables before deploying:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `PUBLIC_API_BASE_URL`, for example `https://jassm-admin-app.onrender.com`
- `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` for first production boot
- `MPESA_ENVIRONMENT=production`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_TILL_NUMBER`
- `MPESA_C2B_SHORTCODE`, the Safaricom store number/shortcode that owns C2B callbacks for the Till
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`, for STK push callbacks
- `SMS_API_KEY`, `SMS_USERNAME`, and optional `SMS_SENDER_ID`

Set `VITE_API_BASE_URL` for the client build, for example:

```sh
VITE_API_BASE_URL=https://jassm-admin-app.onrender.com/api
```

Manual Till payments require Safaricom C2B URLs to be registered against the production Till number:

- Validation URL: `https://your-api-domain.com/api/payments/c2b/validation`
- Confirmation URL: `https://your-api-domain.com/api/payments/c2b/confirmation`

After logging in as a `SUPER_ADMIN`, the backend can register those URLs through:

```sh
POST /api/payments/c2b/register
Authorization: Bearer <token>
Content-Type: application/json

{ "baseUrl": "https://your-api-domain.com" }
```

For production Daraja apps with `C2B v2` enabled, the backend registers URLs through Safaricom's production C2B v2 endpoint using `MPESA_C2B_SHORTCODE`. For Buy Goods manual payments this is the associated Safaricom store number/shortcode that owns C2B callbacks for the Till, which may differ from both the public Till number and the parent shortcode. For Till `895858`, Safaricom confirmed the C2B registration store number is `6270336`. STK Push still uses `MPESA_TILL_NUMBER`.

The server `start` script runs `prisma migrate deploy` before booting, so production tables are created/updated automatically from committed migrations. If your host uses a custom start command, make sure it runs:

```sh
npm run prisma:deploy --workspace=server
npm run start --workspace=server
```
