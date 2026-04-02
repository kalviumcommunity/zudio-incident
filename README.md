# Zudio Backend API

E-commerce backend for Zudio fashion platform.

## Getting Started

```bash
git clone <repo-url>
cd zudio-backend
npm install
npm run dev
```

## Stack

- Node.js / Express 4
- PostgreSQL (node-postgres)
- JWT authentication

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with nodemon |
| `npm start` | Start production server |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed the database with sample data |

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | /api/health | — |
| GET | /api/products | — |
| GET | /api/products/:id | — |
| POST | /api/auth/register | — |
| POST | /api/auth/login | — |
| GET | /api/orders/history | Bearer token |
| POST | /api/cart/checkout | Bearer token |
| PATCH | /api/orders/:id/status | Admin token |

## Known Issues

- Search sometimes returns unexpected results depending on the query string passed.

## TODO

- Add input validation across all endpoints
- Password hashing (ask Rahul)
- Add unit tests and integration test suite
- Rate limiting on auth endpoints
