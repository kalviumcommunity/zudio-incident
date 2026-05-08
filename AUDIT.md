# Endpoint Profiling Audit

| Endpoint | Response Time | Query Count | Observation |
|---|---|---|---|
| GET /api/products | 83ms | 1 | Product listing endpoint performs efficiently with a single query |
| GET /api/products?search=shirt | 52ms | 1 | Search filtering works correctly with low response time |
| GET /api/orders/history | 11ms | 1 | Authenticated endpoint responds quickly for empty order history |
| POST /api/cart/checkout | 4ms | 0 | Request rejected early because cart is empty, so no DB queries executed |

---

# Profiling Observations

- Query counting middleware successfully tracks database usage.
- Product-related endpoints currently execute efficiently with one database query.
- Authentication-protected routes show low response times.
- Checkout validation stops invalid requests before unnecessary database operations occur.