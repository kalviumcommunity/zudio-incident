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

### Success Response — 200 OK

```json
{
  "status": "ok",
  "timestamp": "2026-05-13T10:00:00.000Z"
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 500 | INTERNAL_ERROR | Unexpected server error |
| 503 | SERVICE_UNAVAILABLE | Dependencies are down |
| 429 | RATE_LIMITED | Too many requests |

## GET /api/products

**Auth required:** No

### Request

Query params:
- `category` optional string
- `search` optional string
- `limit` optional integer, default 20
- `offset` optional integer, default 0

### Success Response — 200 OK

```json
{
  "products": [
    {
      "id": 1,
      "name": "Striped Kurta",
      "description": "Cotton kurta",
      "price": 649.5,
      "stock": 20,
      "category_id": 2,
      "category_name": "Men",
      "image_url": "https://cdn.example.com/products/1.jpg",
      "created_at": "2026-05-13T10:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_QUERY | limit or offset is invalid |
| 404 | NOT_FOUND | Category filter returns no matches |
| 500 | INTERNAL_ERROR | Unexpected server error |

## GET /api/products/:id

**Auth required:** No

### Request

Path params:
- `id` required integer

### Success Response — 200 OK

```json
{
  "id": 1,
  "name": "Striped Kurta",
  "description": "Cotton kurta",
  "price": 649.5,
  "stock": 20,
  "category_id": 2,
  "category_name": "Men",
  "image_url": "https://cdn.example.com/products/1.jpg",
  "created_at": "2026-05-13T10:00:00.000Z"
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_ID | Product id is not a positive integer |
| 404 | NOT_FOUND | Product does not exist |
| 500 | INTERNAL_ERROR | Unexpected server error |

## POST /api/auth/register

**Auth required:** No
**Content-Type:** application/json

### Request

```json
{
  "name": "Asha Sharma",
  "email": "asha@example.com",
  "password": "Secret123!",
  "phone": "+91-9000000000"
}
```

Rules:
- `name` required string, 1-100 chars
- `email` required valid email
- `password` required string, minimum 8 chars
- `phone` optional string

### Success Response — 201 Created

```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOi...",
  "user": {
    "id": 7,
    "name": "Asha Sharma",
    "email": "asha@example.com",
    "phone": "+91-9000000000",
    "created_at": "2026-05-13T10:00:00.000Z"
  }
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | VALIDATION_ERROR | Name, email, or password is missing/invalid |
| 409 | EMAIL_EXISTS | Email already registered |
| 500 | INTERNAL_ERROR | Unexpected server error |

## POST /api/auth/login

**Auth required:** No
**Content-Type:** application/json

### Request

```json
{
  "email": "asha@example.com",
  "password": "Secret123!"
}
```

### Success Response — 200 OK

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOi...",
  "user": {
    "id": 7,
    "name": "Asha Sharma",
    "email": "asha@example.com",
    "phone": "+91-9000000000"
  }
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | VALIDATION_ERROR | Email or password missing |
| 401 | UNAUTHORIZED | Invalid credentials or expired token |
| 500 | INTERNAL_ERROR | Unexpected server error |

## GET /api/orders/history

**Auth required:** Yes, Bearer JWT

### Request

Query params:
- `limit` optional integer
- `offset` optional integer

### Success Response — 200 OK

```json
{
  "orders": [
    {
      "id": 42,
      "user_id": 7,
      "total_amount": 1299.0,
      "discount": 100.0,
      "shipping_address": "Bengaluru, KA",
      "status": "confirmed",
      "created_at": "2026-05-13T10:00:00.000Z",
      "updated_at": "2026-05-13T10:01:00.000Z",
      "items": [
        {
          "id": 11,
          "order_id": 42,
          "product_id": 1,
          "product_name": "Striped Kurta",
          "product_price": 649.5,
          "quantity": 2,
          "unit_price": 649.5,
          "created_at": "2026-05-13T10:00:00.000Z",
          "product": {
            "id": 1,
            "name": "Striped Kurta",
            "price": 649.5,
            "image_url": "https://cdn.example.com/products/1.jpg"
          }
        }
      ]
    }
  ]
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 401 | UNAUTHORIZED | No token or expired token |
| 404 | NOT_FOUND | No order history exists |
| 500 | INTERNAL_ERROR | Unexpected server error |

## POST /api/cart/checkout

**Auth required:** Yes, Bearer JWT
**Content-Type:** application/json

### Request

```json
{
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ],
  "couponCode": "SUMMER100",
  "shippingAddress": "Bengaluru, KA"
}
```

Rules:
- `items` required array, must not be empty
- `productId` required positive integer
- `quantity` required integer, minimum 1
- `couponCode` optional string
- `shippingAddress` required string

### Success Response — 201 Created

```json
{
  "message": "Order placed successfully",
  "order": {
    "id": 42,
    "user_id": 7,
    "total_amount": 1199.0,
    "discount": 100.0,
    "shipping_address": "Bengaluru, KA",
    "status": "pending",
    "created_at": "2026-05-13T10:00:00.000Z",
    "updated_at": "2026-05-13T10:00:00.000Z"
  },
  "discount": 100
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | EMPTY_CART | items missing or empty |
| 400 | INVALID_SHIPPING_ADDRESS | shippingAddress missing |
| 400 | COUPON_INVALID | Coupon does not exist, expired, or already used |
| 401 | UNAUTHORIZED | No token or expired token |
| 409 | INSUFFICIENT_STOCK | Requested quantity exceeds inventory |
| 500 | INTERNAL_ERROR | Unexpected server error |

## PATCH /api/orders/:id/status

**Auth required:** Yes, Bearer JWT and admin role
**Content-Type:** application/json

### Request

```json
{
  "status": "shipped"
}
```

Allowed statuses:
- `pending`
- `confirmed`
- `shipped`
- `delivered`
- `cancelled`

### Success Response — 200 OK

```json
{
  "message": "Order status updated",
  "order": {
    "id": 42,
    "status": "shipped"
  }
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_STATUS | Status is outside the allowed set |
| 401 | UNAUTHORIZED | No token or expired token |
| 403 | FORBIDDEN | Authenticated user is not an admin |
| 404 | NOT_FOUND | Order does not exist |
| 500 | INTERNAL_ERROR | Unexpected server error |

## Notes on Consistency

Every endpoint should return the same error envelope:

```json
{
  "error": "INSUFFICIENT_STOCK",
  "message": "Only 2 units available",
  "details": {
    "productId": 7,
    "availableStock": 2
  }
}
```

That is the contract clients should rely on instead of ad hoc strings.
