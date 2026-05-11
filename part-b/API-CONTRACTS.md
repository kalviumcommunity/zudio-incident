# Part B API Contracts

## Standard Error Shape

```json
{
  "error": "MACHINE_READABLE_CODE",
  "message": "Human readable message",
  "details": {}
}
```

## GET /api/health

**Auth required:** No  
**Content-Type:** N/A

### Request
No body.

### Success Response - 200 OK
```json
{
  "status": "ok",
  "timestamp": "2026-05-11T10:19:07.206Z"
}
```

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 429 | RATE_LIMITED | Health endpoint is throttled by edge/LB rule |
| 503 | SERVICE_UNAVAILABLE | Upstream dependencies are unhealthy |
| 500 | INTERNAL_ERROR | Unexpected server failure |

### Error Response Shape
```json
{ "error": "SERVICE_UNAVAILABLE", "message": "Health check failed", "details": {} }
```

## GET /api/products

**Auth required:** No  
**Content-Type:** N/A

### Request
Query params:
- `search`: string, optional, max 100 chars
- `category`: string, optional
- `limit`: integer, optional, default 20, range 1-100
- `offset`: integer, optional, default 0, min 0

### Success Response - 200 OK
```json
{
  "products": [
    {
      "id": 1,
      "name": "Men's Classic Oxford Shirt",
      "price": "999.00",
      "stock": 242,
      "category_name": "Shirts"
    }
  ],
  "count": 1
}
```
Headers:
- `X-Cache: HIT|MISS|BYPASS`

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 400 | INVALID_QUERY | limit/offset/search validation fails |
| 422 | VALIDATION_ERROR | Query schema invalid |
| 500 | INTERNAL_ERROR | Query execution failed |

### Error Response Shape
```json
{ "error": "INVALID_QUERY", "message": "limit must be between 1 and 100", "details": {"field":"limit"} }
```

## GET /api/products/:id

**Auth required:** No  
**Content-Type:** N/A

### Request
Path params:
- `id`: integer, required, positive

### Success Response - 200 OK
```json
{
  "id": 1,
  "name": "Men's Classic Oxford Shirt",
  "price": "999.00",
  "stock": 242,
  "category_name": "Shirts"
}
```

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 400 | INVALID_PRODUCT_ID | id is not a positive integer |
| 404 | NOT_FOUND | Product does not exist |
| 500 | INTERNAL_ERROR | Unexpected server/database error |

### Error Response Shape
```json
{ "error": "NOT_FOUND", "message": "Product not found", "details": {"productId": 1} }
```

## POST /api/auth/register

**Auth required:** No  
**Content-Type:** application/json

### Request
```json
{
  "name": "Test User",
  "email": "test.user@example.com",
  "password": "Pass1234!",
  "phone": "9999999999"
}
```
Rules:
- `name`: required, 1-100 chars
- `email`: required, valid format
- `password`: required, min 8 chars
- `phone`: optional

### Success Response - 201 Created
```json
{
  "message": "Registration successful",
  "token": "jwt-token",
  "user": {
    "id": 51,
    "name": "Test User",
    "email": "test.user@example.com",
    "phone": "9999999999",
    "created_at": "2026-05-11T05:05:35.729Z"
  }
}
```

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 400 | VALIDATION_ERROR | Missing required fields |
| 409 | EMAIL_ALREADY_REGISTERED | Email already exists |
| 422 | INVALID_PAYLOAD | Body type/shape invalid |
| 500 | INTERNAL_ERROR | Unexpected failure |

### Error Response Shape
```json
{ "error": "EMAIL_ALREADY_REGISTERED", "message": "Email already registered", "details": {"email":"test.user@example.com"} }
```

## POST /api/auth/login

**Auth required:** No  
**Content-Type:** application/json

### Request
```json
{
  "email": "test.user@example.com",
  "password": "Pass1234!"
}
```

### Success Response - 200 OK
```json
{
  "message": "Login successful",
  "token": "jwt-token",
  "user": {
    "id": 51,
    "name": "Test User",
    "email": "test.user@example.com",
    "phone": "9999999999"
  }
}
```

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 400 | VALIDATION_ERROR | Missing email/password |
| 401 | INVALID_CREDENTIALS | Email or password mismatch |
| 422 | INVALID_PAYLOAD | Body schema invalid |
| 500 | INTERNAL_ERROR | Unexpected auth failure |

### Error Response Shape
```json
{ "error": "INVALID_CREDENTIALS", "message": "Invalid credentials", "details": {} }
```

## GET /api/orders/history

**Auth required:** Yes (Bearer JWT)  
**Content-Type:** N/A

### Request
Headers:
- `Authorization: Bearer <token>`

Query params (recommended contract extension):
- `limit`: integer, optional, default 20
- `offset`: integer, optional, default 0

### Success Response - 200 OK
```json
{
  "orders": [
    {
      "id": 499,
      "user_id": 51,
      "total_amount": "899.00",
      "status": "pending",
      "items": [
        {
          "product_id": 1,
          "quantity": 1,
          "unit_price": "999.00",
          "product": {
            "id": 1,
            "name": "Men's Classic Oxford Shirt",
            "image_url": "https://..."
          }
        }
      ]
    }
  ]
}
```

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 401 | UNAUTHORIZED | Missing/invalid/expired JWT |
| 403 | FORBIDDEN | Token is valid but access policy denies |
| 422 | INVALID_QUERY | Invalid pagination params |
| 500 | INTERNAL_ERROR | Unexpected database error |

### Error Response Shape
```json
{ "error": "UNAUTHORIZED", "message": "Invalid or expired token", "details": {} }
```

## POST /api/cart/checkout

**Auth required:** Yes (Bearer JWT)  
**Content-Type:** application/json

### Request
```json
{
  "items": [
    { "productId": 1, "quantity": 1 }
  ],
  "couponCode": "ZUDIO100",
  "shippingAddress": "12 Brigade Road, Bengaluru 560001"
}
```
Rules:
- `items`: required array, at least one row
- `items[].productId`: required positive integer
- `items[].quantity`: required integer, 1-100
- `couponCode`: optional string
- `shippingAddress`: required non-empty string

### Success Response - 201 Created
```json
{
  "message": "Order placed successfully",
  "order": {
    "id": 499,
    "user_id": 51,
    "total_amount": "899.00",
    "discount": "100.00",
    "shipping_address": "12 Brigade Road, Bengaluru 560001",
    "status": "pending"
  },
  "discount": 100
}
```

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 400 | EMPTY_CART | items missing or empty |
| 400 | COUPON_INVALID_OR_USED | coupon invalid, expired, or already used |
| 401 | UNAUTHORIZED | Missing/invalid JWT |
| 404 | PRODUCT_NOT_FOUND | Any productId does not exist |
| 409 | INSUFFICIENT_STOCK | Requested qty exceeds available stock |
| 422 | VALIDATION_ERROR | Body schema fails |
| 500 | INTERNAL_ERROR | Unexpected failure (transaction rolled back) |

### Error Response Shape
```json
{ "error": "INSUFFICIENT_STOCK", "message": "Insufficient stock for Men's Classic Oxford Shirt", "details": {"productId":1} }
```

## PATCH /api/orders/:id/status

**Auth required:** Yes (Bearer JWT + admin role)  
**Content-Type:** application/json

### Request
```json
{
  "status": "shipped"
}
```
Rules:
- `id`: path param positive integer
- `status`: one of `pending|confirmed|shipped|delivered|cancelled`

### Success Response - 200 OK
```json
{
  "message": "Order status updated",
  "order": {
    "id": 499,
    "status": "shipped"
  }
}
```

### Error Responses
| HTTP Status | Error Code | When This Occurs |
|---|---|---|
| 400 | INVALID_STATUS | status not in allowed values |
| 401 | UNAUTHORIZED | Missing/invalid JWT |
| 403 | ADMIN_ACCESS_REQUIRED | Authenticated user is not admin |
| 404 | NOT_FOUND | Order does not exist |
| 422 | VALIDATION_ERROR | Path/body schema invalid |
| 500 | INTERNAL_ERROR | Unexpected failure |

### Error Response Shape
```json
{ "error": "ADMIN_ACCESS_REQUIRED", "message": "Admin access required", "details": {} }
```
