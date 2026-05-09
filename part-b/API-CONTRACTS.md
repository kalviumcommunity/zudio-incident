# Part B REST API Contracts

## GET /api/health

**Auth required:** No

### Request
No request body.

### Success Response — 200 OK
```json
{
  "status": "ok",
  "timestamp": "2026-05-09T10:47:00.000Z"
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 500 | INTERNAL_ERROR | Unexpected server error |
| 503 | SERVICE_UNAVAILABLE | Node process cannot reach required runtime dependency |
| 504 | GATEWAY_TIMEOUT | Health handler is blocked by an upstream dependency |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## GET /api/products

**Auth required:** No

### Request
Query parameters:
- `category` string optional - exact category name filter.
- `search` string optional - case-insensitive substring match against product name.
- `limit` integer optional, default `20`, minimum `1`, maximum `100`.
- `offset` integer optional, default `0`, minimum `0`.

### Success Response — 200 OK
```json
{
  "products": [
    {
      "id": 12,
      "name": "Summer Linen Shirt",
      "description": "Lightweight linen shirt",
      "price": "1499.00",
      "stock": 42,
      "category_id": 3,
      "category_name": "Men",
      "image_url": "https://cdn.example.com/products/12.jpg",
      "created_at": "2026-05-01T08:10:00.000Z"
    }
  ],
  "count": 1
}
```

`category_name` is present on the default and category-filtered listing paths, while the search path returns the raw product row shape from the controller.

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_QUERY | `limit` or `offset` is not a valid integer |
| 422 | VALIDATION_ERROR | `search` exceeds length or contains unsupported characters |
| 500 | INTERNAL_ERROR | Unexpected server error |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## GET /api/products/:id

**Auth required:** No

### Request
Path parameter:
- `id` integer required - product identifier.

### Success Response — 200 OK
```json
{
  "id": 12,
  "name": "Summer Linen Shirt",
  "description": "Lightweight linen shirt",
  "price": "1499.00",
  "stock": 42,
  "category_id": 3,
  "category_name": "Men",
  "image_url": "https://cdn.example.com/products/12.jpg",
  "created_at": "2026-05-01T08:10:00.000Z"
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_PRODUCT_ID | `id` is not a positive integer |
| 404 | NOT_FOUND | Product does not exist |
| 422 | VALIDATION_ERROR | Path parameter fails validation |
| 500 | INTERNAL_ERROR | Unexpected server error |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## POST /api/auth/register

**Auth required:** No
**Content-Type:** application/json

### Request
```json
{
  "name": "Asha Kumar",
  "email": "asha@example.com",
  "password": "StrongP@ssw0rd!",
  "phone": "9876543210"
}
```

Field rules:
- `name` string required, 1-255 characters.
- `email` string required, valid email format, unique.
- `password` string required, minimum 8 characters.
- `phone` string optional, 10-20 characters.

### Success Response — 201 Created
```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 25,
    "name": "Asha Kumar",
    "email": "asha@example.com",
    "phone": "9876543210",
    "created_at": "2026-05-09T10:47:00.000Z"
  }
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | MISSING_REQUIRED_FIELD | `name`, `email`, or `password` missing |
| 409 | EMAIL_ALREADY_REGISTERED | Email already exists |
| 422 | VALIDATION_ERROR | Email/password format fails validation |
| 500 | INTERNAL_ERROR | Unexpected server error |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## POST /api/auth/login

**Auth required:** No
**Content-Type:** application/json

### Request
```json
{
  "email": "asha@example.com",
  "password": "StrongP@ssw0rd!"
}
```

Field rules:
- `email` string required, valid email format.
- `password` string required.

### Success Response — 200 OK
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 25,
    "name": "Asha Kumar",
    "email": "asha@example.com",
    "phone": "9876543210"
  }
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | MISSING_REQUIRED_FIELD | `email` or `password` missing |
| 401 | UNAUTHORIZED | Invalid credentials or expired token |
| 422 | VALIDATION_ERROR | Email/password format fails validation |
| 500 | INTERNAL_ERROR | Unexpected server error |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## GET /api/orders/history

**Auth required:** Yes (Bearer JWT)

### Request
Header:
- `Authorization: Bearer <token>` required.

No request body.

### Success Response — 200 OK
```json
{
  "orders": [
    {
      "id": 101,
      "total_amount": "2499.00",
      "discount": "200.00",
      "shipping_address": "12 MG Road, Bengaluru",
      "status": "delivered",
      "created_at": "2026-05-05T12:10:00.000Z",
      "updated_at": "2026-05-05T12:20:00.000Z",
      "items": [
        {
          "id": 501,
          "quantity": 2,
          "unit_price": "1499.00",
          "product": {
            "id": 12,
            "name": "Summer Linen Shirt",
            "image_url": "https://cdn.example.com/products/12.jpg"
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
| 401 | UNAUTHORIZED | No token / expired token |
| 403 | FORBIDDEN | Token is valid but user is not allowed to view the resource |
| 500 | INTERNAL_ERROR | Unexpected server error |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## POST /api/cart/checkout

**Auth required:** Yes (Bearer JWT)
**Content-Type:** application/json

### Request
```json
{
  "items": [
    { "productId": 12, "quantity": 2 },
    { "productId": 18, "quantity": 1 }
  ],
  "couponCode": "SAVE50",
  "shippingAddress": "12 MG Road, Bengaluru"
}
```

Field rules:
- `items` array required, minimum length `1`.
- Each item requires `productId` integer > 0 and `quantity` integer > 0.
- `couponCode` string optional.
- `shippingAddress` string required.

### Success Response — 201 Created
```json
{
  "message": "Order placed successfully",
  "order": {
    "id": 602,
    "user_id": 25,
    "total_amount": "2349.00",
    "discount": "150.00",
    "shipping_address": "12 MG Road, Bengaluru",
    "status": "pending",
    "created_at": "2026-05-09T10:47:00.000Z",
    "updated_at": "2026-05-09T10:47:00.000Z"
  },
  "discount": 150
}
```

If no coupon is supplied, the response omits `discount`.

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | EMPTY_CART | `items` missing or empty |
| 400 | INSUFFICIENT_STOCK | One or more items exceed available stock |
| 400 | INVALID_OR_EXPIRED_COUPON | Coupon does not exist, expired, or already used |
| 401 | UNAUTHORIZED | No token / expired token |
| 404 | NOT_FOUND | A referenced product does not exist |
| 422 | VALIDATION_ERROR | Request body fails validation |
| 500 | INTERNAL_ERROR | Unexpected server error |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## PATCH /api/orders/:id/status

**Auth required:** Yes (Bearer JWT, admin only)
**Content-Type:** application/json

### Request
Path parameter:
- `id` integer required - order identifier.

Body:
```json
{
  "status": "shipped"
}
```

Field rules:
- `status` string required, one of `pending`, `confirmed`, `shipped`, `delivered`, `cancelled`.

### Success Response — 200 OK
```json
{
  "message": "Order status updated",
  "order": {
    "id": 101,
    "user_id": 25,
    "total_amount": "2499.00",
    "discount": "200.00",
    "shipping_address": "12 MG Road, Bengaluru",
    "status": "shipped",
    "created_at": "2026-05-05T12:10:00.000Z",
    "updated_at": "2026-05-09T10:47:00.000Z"
  }
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_STATUS | `status` is not one of the allowed values |
| 401 | UNAUTHORIZED | No token / expired token |
| 403 | FORBIDDEN | Authenticated user is not an admin |
| 404 | NOT_FOUND | Order does not exist |
| 422 | VALIDATION_ERROR | Body or path parameter fails validation |
| 500 | INTERNAL_ERROR | Unexpected server error |

### Error Response Shape
```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```
