# API Contracts

---

## GET /api/products

**Auth required:** No  
**Content-Type:** application/json

---

### Request

### Query Parameters

| Field | Type | Required | Constraints |
|---|---|---|---|
| category | string | Optional | Must match an existing category |
| search | string | Optional | Maximum 100 characters |
| limit | integer | Optional | Default 20, maximum 100 |
| offset | integer | Optional | Default 0 |

### Example Request

```http
GET /api/products?search=shirt&category=Men&limit=20&offset=0
```

---

### Success Response — 200 OK

```json
{
  "products": [
    {
      "id": 1,
      "name": "Blue Linen Shirt",
      "price": 999,
      "stock": 24,
      "category_name": "Men",
      "image_url": "https://cdn.zudio.com/products/shirt.jpg",
      "created_at": "2026-05-10T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_QUERY | Query parameters contain invalid values |
| 400 | INVALID_LIMIT | Limit exceeds maximum allowed value |
| 404 | PRODUCTS_NOT_FOUND | No matching products found |
| 422 | VALIDATION_ERROR | Query parameter types are invalid |
| 500 | INTERNAL_ERROR | Unexpected server error |

---

### Error Response Shape

```json
{
  "error": "INVALID_QUERY",
  "message": "Search query contains invalid characters",
  "details": {}
}
```

---

### Notes

- Product search supports category filtering and text search.
- Search is case-insensitive using PostgreSQL ILIKE queries.
- Pagination is supported using limit and offset parameters.
- Product responses may be cached using Redis in the scaled architecture.

---

## GET /api/products/:id

**Auth required:** No  
**Content-Type:** application/json

---

### Request

### Path Parameters

| Field | Type | Required | Constraints |
|---|---|---|---|
| id | integer | Yes | Must be a valid existing product ID |

### Example Request

```http
GET /api/products/1
```

---

### Success Response — 200 OK

```json
{
  "id": 1,
  "name": "Blue Linen Shirt",
  "price": 999,
  "stock": 24,
  "category_name": "Men",
  "image_url": "https://cdn.zudio.com/products/shirt.jpg",
  "created_at": "2026-05-10T10:00:00.000Z"
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_PRODUCT_ID | Product ID is invalid or not numeric |
| 404 | PRODUCT_NOT_FOUND | Product with given ID does not exist |
| 422 | VALIDATION_ERROR | Request path parameter fails validation |
| 500 | INTERNAL_ERROR | Unexpected server error |
| 503 | DATABASE_UNAVAILABLE | Database connection temporarily unavailable |

---

### Error Response Shape

```json
{
  "error": "PRODUCT_NOT_FOUND",
  "message": "The requested product does not exist",
  "details": {}
}
```

---

### Notes

- Returns complete product information for a single product.
- Endpoint is optimized using indexed product ID lookup.
- Product image URLs are expected to be served through CDN in scaled architecture.
- Invalid product IDs are rejected before database execution.

---

## POST /api/auth/register

**Auth required:** No  
**Content-Type:** application/json

---

### Request

### Request Body Schema

| Field | Type | Required | Constraints |
|---|---|---|---|
| name | string | Yes | Minimum 2 characters |
| email | string | Yes | Must be a valid email address |
| password | string | Yes | Minimum 8 characters |
| phone | string | Optional | Must contain 10 digits |

### Example Request

```json
{
  "name": "Ishana",
  "email": "ishana@gmail.com",
  "password": "mypassword123",
  "phone": "9876543210"
}
```

---

### Success Response — 201 Created

```json
{
  "message": "Registration successful",
  "token": "jwt-token-value",
  "user": {
    "id": 1,
    "name": "Ishana",
    "email": "ishana@gmail.com",
    "phone": "9876543210",
    "created_at": "2026-05-10T10:00:00.000Z"
  }
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_INPUT | Required fields are missing |
| 400 | WEAK_PASSWORD | Password does not meet minimum security requirements |
| 409 | EMAIL_ALREADY_EXISTS | Email is already registered |
| 422 | VALIDATION_ERROR | Request body contains invalid data types or formats |
| 500 | INTERNAL_ERROR | Unexpected server error |

---

### Error Response Shape

```json
{
  "error": "EMAIL_ALREADY_EXISTS",
  "message": "An account with this email already exists",
  "details": {}
}
```

---

### Notes

- Passwords are securely hashed using bcrypt before storage.
- JWT token is generated immediately after successful registration.
- Email addresses must be unique across all users.
- Sensitive user data such as hashed passwords is never returned in API responses.

---

## POST /api/auth/login

**Auth required:** No  
**Content-Type:** application/json

---

### Request

### Request Body Schema

| Field | Type | Required | Constraints |
|---|---|---|---|
| email | string | Yes | Must be a valid registered email address |
| password | string | Yes | Minimum 8 characters |

### Example Request

```json
{
  "email": "ishana@gmail.com",
  "password": "mypassword123"
}
```

---

### Success Response — 200 OK

```json
{
  "message": "Login successful",
  "token": "jwt-token-value",
  "user": {
    "id": 1,
    "name": "Ishana",
    "email": "ishana@gmail.com",
    "phone": "9876543210"
  }
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_INPUT | Email or password field is missing |
| 401 | INVALID_CREDENTIALS | Email or password is incorrect |
| 401 | TOKEN_GENERATION_FAILED | JWT token could not be generated |
| 422 | VALIDATION_ERROR | Request body format is invalid |
| 500 | INTERNAL_ERROR | Unexpected server error |

---

### Error Response Shape

```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Incorrect email or password",
  "details": {}
}
```

---

### Notes

- User passwords are verified using bcrypt.compare().
- JWT authentication token is returned after successful login.
- Invalid login attempts return generic credential errors for security reasons.
- Sensitive information such as password hashes is never exposed in responses.

---

## GET /api/orders/history

**Auth required:** Yes (Bearer JWT)  
**Content-Type:** application/json

---

### Request

### Headers

| Header | Required | Description |
|---|---|---|
| Authorization | Yes | Bearer JWT authentication token |

### Query Parameters

| Field | Type | Required | Constraints |
|---|---|---|---|
| offset | integer | Optional | Default 0 |

### Example Request

```http
GET /api/orders/history?offset=0
Authorization: Bearer jwt-token-value
```

---

### Success Response — 200 OK

```json
{
  "orders": [
    {
      "order_id": 12,
      "total_amount": 2499,
      "status": "confirmed",
      "created_at": "2026-05-10T10:00:00.000Z",
      "quantity": 2,
      "unit_price": 1249,
      "product_id": 3,
      "product_name": "Oversized Graphic Tee",
      "image_url": "https://cdn.zudio.com/products/tee.jpg"
    }
  ]
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 401 | UNAUTHORIZED | Missing, invalid, or expired JWT token |
| 404 | ORDERS_NOT_FOUND | User has no order history |
| 422 | VALIDATION_ERROR | Invalid offset query parameter |
| 500 | INTERNAL_ERROR | Unexpected server error |
| 503 | DATABASE_UNAVAILABLE | Database connection unavailable |

---

### Error Response Shape

```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired authentication token",
  "details": {}
}
```

---

### Notes

- Endpoint uses optimized JOIN queries to avoid N+1 query performance issues.
- Results are sorted by newest orders first using created_at DESC.
- Requires valid JWT authentication token.
- Composite index on orders(user_id, created_at DESC) improves query performance during high traffic.

---

## POST /api/cart/checkout

**Auth required:** Yes (Bearer JWT)  
**Content-Type:** application/json

---

### Request

### Headers

| Header | Required | Description |
|---|---|---|
| Authorization | Yes | Bearer JWT authentication token |

### Request Body Schema

| Field | Type | Required | Constraints |
|---|---|---|---|
| items | array | Yes | Must contain at least one product |
| items[].productId | integer | Yes | Must reference a valid product |
| items[].quantity | integer | Yes | Must be greater than 0 |
| couponCode | string | Optional | Must reference valid active coupon |
| shippingAddress | string | Yes | Minimum 5 characters |

### Example Request

```json
{
  "items": [
    {
      "productId": 2,
      "quantity": 1
    },
    {
      "productId": 5,
      "quantity": 2
    }
  ],
  "couponCode": "SUMMER50",
  "shippingAddress": "Hyderabad, Telangana"
}
```

---

### Success Response — 201 Created

```json
{
  "message": "Order placed successfully",
  "order": {
    "id": 15,
    "user_id": 1,
    "total_amount": 2499,
    "discount": 500,
    "status": "pending",
    "shipping_address": "Hyderabad, Telangana",
    "created_at": "2026-05-10T10:00:00.000Z"
  }
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | CART_EMPTY | No products provided in cart |
| 400 | INVALID_COUPON | Coupon is invalid, expired, or already used |
| 400 | INSUFFICIENT_STOCK | Product stock is insufficient |
| 401 | UNAUTHORIZED | Missing or expired JWT token |
| 404 | PRODUCT_NOT_FOUND | Product ID does not exist |
| 422 | VALIDATION_ERROR | Request body contains invalid data |
| 500 | INTERNAL_ERROR | Unexpected server error |

---

### Error Response Shape

```json
{
  "error": "INSUFFICIENT_STOCK",
  "message": "Requested product quantity is not available",
  "details": {}
}
```

---

### Notes

- Checkout process runs inside a PostgreSQL transaction using BEGIN, COMMIT, and ROLLBACK.
- Coupon validation uses atomic UPDATE queries to prevent double redemption race conditions.
- Product stock is decremented safely during checkout.
- Failed stock updates automatically trigger rollback to maintain data consistency.

---

## PATCH /api/orders/:id

**Auth required:** Yes (Bearer JWT)  
**Content-Type:** application/json

---

### Request

### Headers

| Header | Required | Description |
|---|---|---|
| Authorization | Yes | Bearer JWT authentication token |

### Path Parameters

| Field | Type | Required | Constraints |
|---|---|---|---|
| id | integer | Yes | Must reference an existing order |

### Request Body Schema

| Field | Type | Required | Constraints |
|---|---|---|---|
| status | string | Yes | Must be one of: pending, confirmed, shipped, delivered, cancelled |

### Example Request

```json
{
  "status": "shipped"
}
```

---

### Success Response — 200 OK

```json
{
  "message": "Order status updated",
  "order": {
    "id": 15,
    "status": "shipped",
    "updated_at": "2026-05-10T10:00:00.000Z"
  }
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_STATUS | Status value is invalid |
| 401 | UNAUTHORIZED | Missing or expired JWT token |
| 403 | FORBIDDEN | User does not have admin permissions |
| 404 | ORDER_NOT_FOUND | Order with given ID does not exist |
| 422 | VALIDATION_ERROR | Request body format is invalid |
| 500 | INTERNAL_ERROR | Unexpected server error |

---

### Error Response Shape

```json
{
  "error": "INVALID_STATUS",
  "message": "Provided order status is not supported",
  "details": {}
}
```

---

### Notes

- Endpoint is intended for admin-level order management.
- Only valid predefined order statuses are accepted.
- Invalid status transitions are rejected before database update execution.
- Order updates automatically refresh the updated_at timestamp.

---

## GET /health

**Auth required:** No  
**Content-Type:** application/json

---

### Request

No request body or query parameters required.

### Example Request

```http
GET /health
```

---

### Success Response — 200 OK

```json
{
  "status": "OK",
  "service": "zudio-backend",
  "uptime": "12h 32m",
  "database": "connected",
  "timestamp": "2026-05-10T10:00:00.000Z"
}
```

---

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 500 | DATABASE_DOWN | PostgreSQL connection failed |
| 503 | SERVICE_UNAVAILABLE | Backend service overloaded or unavailable |
| 500 | INTERNAL_ERROR | Unexpected server error |
| 504 | GATEWAY_TIMEOUT | Health check exceeded response timeout |
| 422 | VALIDATION_ERROR | Invalid monitoring request format |

---

### Error Response Shape

```json
{
  "error": "DATABASE_DOWN",
  "message": "Unable to connect to PostgreSQL database",
  "details": {}
}
```

---

### Notes

- Used by monitoring systems and load balancers to verify backend availability.
- Confirms database connectivity and backend uptime status.
- Can be extended in production to include Redis and replica database health checks.
- Expected to return very low response times under normal conditions.