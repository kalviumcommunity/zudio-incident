# Endpoint Audit

Observed against the live local API after seeding the Supabase database and enabling profiling middleware.

| Endpoint | Response Time | Query Count | Observation |
|---|---:|---:|---|
| GET /api/products | 483ms | 1 | Returns 20 products and count 20; product 1 stock was 243. |
| GET /api/products?search=shirt | 76ms | 1 | Returned an empty list even though seed data contains shirt products; search appears case-sensitive. |
| GET /api/products?search=shirt' OR '1'='1 | 68ms | 1 | Returned an empty list; the search term is interpolated into SQL directly, so this path is fragile even though no rows came back in this test. |
| POST /api/auth/register | 565ms | 2 | Registration succeeded for a new user and returned a JWT. |
| POST /api/auth/login | 87ms | 1 | Login succeeded for the same user and returned a JWT. |
| GET /api/orders/history | 79ms | 1 | Returned an empty orders array for the new user. |
| POST /api/cart/checkout | 414ms | 5 | Order succeeded with coupon `ZUDIO100`; created order 499 with a 100 discount. |
| POST /api/cart/checkout (same coupon again) | 195ms | 2 | Reusing the same coupon returned `Invalid or expired coupon`. |
| GET /api/products (after checkout) | 176ms | 1 | Product 1 stock stayed at 243, so checkout does not currently decrement stock. |

## Notes

- The profiler logs show `/api/products` as `GET /`, `/api/orders/history` as `GET /history`, and checkout as `POST /checkout` because the middleware runs inside mounted routers.
- The checkout path confirms coupon one-time use, but stock reduction is still commented out in the controller.