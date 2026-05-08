# API Audit Report

Date: 2026-05-08
Scope: Manual endpoint testing with curl before source review
Base URL: http://localhost:3000

## Findings

1. Endpoint: GET /api/products

- Status: Works
- Observation: Returned 20 products with expected fields (id, name, description, price, stock, category_name, etc.).

2. Endpoint: GET /api/products?search=shirt

- Status: Unexpected behavior
- Observation: Returned {"products":[],"count":0} even though multiple product names contain "Shirt".
- Risk: Search feature appears broken or overly restrictive.

3. Endpoint: GET /api/products?search=shirt' OR '1'='1

- Status: No obvious SQL injection via this payload
- Observation: After URL-encoding the payload, response was {"products":[],"count":0}.
- Note: Initial unencoded request failed at curl level due to malformed URL; encoded request reached the API.

4. Endpoint: POST /api/auth/register

- Payload: { email, password, name }
- Status: Works
- Observation: Registration successful; JWT and created user details were returned.

5. Endpoint: POST /api/auth/login

- Payload: { email, password }
- Status: Works
- Observation: Login successful; JWT and user details were returned.

6. Endpoint: GET /api/orders/history

- Auth: Bearer token from login
- Status: Works
- Observation: Returned {"orders":[]} for a newly created user (expected).

7. Endpoint: POST /api/cart/checkout (first valid attempt)

- Auth: Bearer token
- Payload used: {"items":[{"productId":1,"quantity":2}],"couponCode":"ZUDIO100","shippingAddress":"123 Main St, City"}
- Status: Works
- Observation: Order placed successfully and discount applied.

8. Endpoint: POST /api/cart/checkout (same coupon reused)

- Auth: Bearer token
- Payload used: Same as step 7
- Status: Works (validation enforced)
- Observation: Returned {"error":"Invalid or expired coupon"} on second use of ZUDIO100.

9. Endpoint: GET /api/products (after checkout)

- Status: Potential logic defect
- Observation: Product id 1 stock remained 243 after successful checkout of quantity 2.
- Risk: Inventory is not reduced after order placement, enabling overselling.

## Priority Summary

- High: Inventory is not decremented after checkout.
- Medium: Product search returns empty for common query "shirt" despite matching data.
- Low: No obvious SQL injection from tested payload; broader injection testing still recommended.

## Notes

- Checkout payload must use these exact keys: productId, couponCode, shippingAddress.
- Using product_id, coupon, or shipping_address produces validation errors and can create false negatives during testing.

## Profiling Results

| Endpoint                       | Response Time | Query Count | Observation                                                                                       |
| ------------------------------ | ------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| GET /api/products              | 169ms         | 1           | Single list query; response is noticeably slower than other endpoints due to larger payload size. |
| GET /api/products?search=shirt | 18ms          | 1           | Fast, but still returns empty result unexpectedly.                                                |
| GET /api/orders/history        | 15ms          | 1+N+M       | Query count scales with data: 1 order query + N item-list queries + M product detail queries.     |
| POST /api/cart/checkout        | 44ms          | 3           | For no-coupon, one-item payload path: product lookup + order insert + order_item insert.          |

Profiling source:

- Response times were captured from curl output using `%{time_total}`.
- Query counts were derived from the wrapped `pool.query` execution paths in the current controller logic.
