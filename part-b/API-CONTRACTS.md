# Zudio API Contracts

## GET /api/health

**Auth required:** No
**Content-Type:** Not applicable

### Request

No request body.

### Success Response — 200

```json
{
  "status": "ok",
  "timestamp": "2026-05-09T12:34:56.000Z"
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs        |
| ----------- | ---------------- | ----------------------- |
| 400         | -                | N/A for this endpoint   |
| 401         | UNAUTHORIZED     | N/A for this endpoint   |
| 404         | NOT_FOUND        | N/A for this endpoint   |
| 409         | CONFLICT         | N/A for this endpoint   |
| 422         | VALIDATION_ERROR | N/A for this endpoint   |
| 500         | INTERNAL_ERROR   | Unexpected server error |

### Error Response Shape

```json
{ "error": "INTERNAL_ERROR", "message": "Human text", "details": {} }
```

## GET /api/products

**Auth required:** No
**Content-Type:** Not applicable

### Request

Query parameters:

- `search` (string, optional): Free-text product name filter, minimum 1 character.
- `category` (string, optional): Category name filter.
- `limit` (integer, optional): Default `20`, must be `>= 1`.
- `offset` (integer, optional): Default `0`, must be `>= 0`.

### Success Response — 200

```json
{
  "products": [
    {
      "id": 1,
      "name": "Classic Shirt",
      "description": "Cotton shirt",
      "price": "499.00",
      "stock": 243,
      "category_id": 2,
      "image_url": "https://cdn.example.com/products/shirt-1.jpg",
      "created_at": "2026-05-01T08:00:00.000Z",
      "category_name": "Men"
    }
  ],
  "count": 1
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs                                           |
| ----------- | ---------------- | ---------------------------------------------------------- |
| 400         | BAD_REQUEST      | Query params are invalid or cannot be parsed as numbers    |
| 401         | UNAUTHORIZED     | N/A for this endpoint                                      |
| 404         | NOT_FOUND        | N/A for this endpoint                                      |
| 409         | CONFLICT         | N/A for this endpoint                                      |
| 422         | VALIDATION_ERROR | `search`, `category`, `limit`, or `offset` fail validation |
| 500         | INTERNAL_ERROR   | Unexpected server error                                    |

### Error Response Shape

```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## GET /api/products/:id

**Auth required:** No
**Content-Type:** Not applicable

### Request

Path parameters:

- `id` (integer, required): Product identifier.

### Success Response — 200

```json
{
  "id": 1,
  "name": "Classic Shirt",
  "description": "Cotton shirt",
  "price": "499.00",
  "stock": 243,
  "category_id": 2,
  "image_url": "https://cdn.example.com/products/shirt-1.jpg",
  "created_at": "2026-05-01T08:00:00.000Z",
  "category_name": "Men"
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs                |
| ----------- | ---------------- | ------------------------------- |
| 400         | BAD_REQUEST      | `id` is not a valid integer     |
| 401         | UNAUTHORIZED     | N/A for this endpoint           |
| 404         | NOT_FOUND        | Product does not exist          |
| 409         | CONFLICT         | N/A for this endpoint           |
| 422         | VALIDATION_ERROR | Path parameter fails validation |
| 500         | INTERNAL_ERROR   | Unexpected server error         |

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
  "name": "string, required, 1-255 chars",
  "email": "string, required, valid email format",
  "password": "string, required, min 8 chars recommended",
  "phone": "string, optional, max 20 chars"
}
```

### Success Response — 201

```json
{
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 12,
    "name": "Asha Sharma",
    "email": "asha@example.com",
    "phone": "9876543210",
    "created_at": "2026-05-09T12:34:56.000Z"
  }
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs                       |
| ----------- | ---------------- | -------------------------------------- |
| 400         | BAD_REQUEST      | Missing `name`, `email`, or `password` |
| 401         | UNAUTHORIZED     | N/A for this endpoint                  |
| 404         | NOT_FOUND        | N/A for this endpoint                  |
| 409         | CONFLICT         | Email already registered               |
| 422         | VALIDATION_ERROR | Request body fails schema validation   |
| 500         | INTERNAL_ERROR   | Unexpected server error                |

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
  "email": "string, required, valid email format",
  "password": "string, required"
}
```

### Success Response — 200

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 12,
    "name": "Asha Sharma",
    "email": "asha@example.com",
    "phone": "9876543210"
  }
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs                     |
| ----------- | ---------------- | ------------------------------------ |
| 400         | BAD_REQUEST      | Missing `email` or `password`        |
| 401         | UNAUTHORIZED     | Invalid credentials                  |
| 404         | NOT_FOUND        | N/A for this endpoint                |
| 409         | CONFLICT         | N/A for this endpoint                |
| 422         | VALIDATION_ERROR | Request body fails schema validation |
| 500         | INTERNAL_ERROR   | Unexpected server error              |

### Error Response Shape

```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## GET /api/orders/history

**Auth required:** Yes (Bearer JWT)
**Content-Type:** Not applicable

### Request

Query parameters:

- `limit` (integer, optional): Default `20`, must be `>= 1`.
- `offset` (integer, optional): Default `0`, must be `>= 0`.

### Success Response — 200

```json
{
  "orders": [
    {
      "id": 101,
      "user_id": 12,
      "total_amount": "898.00",
      "discount": "100.00",
      "shipping_address": "123 Main St, City",
      "status": "pending",
      "created_at": "2026-05-09T10:00:00.000Z",
      "updated_at": "2026-05-09T10:00:00.000Z",
      "items": [
        {
          "id": 501,
          "product_id": 1,
          "quantity": 2,
          "unit_price": "499.00",
          "product_name": "Classic Shirt",
          "product_price": "499.00",
          "product": {
            "id": 1,
            "name": "Classic Shirt",
            "image_url": "https://cdn.example.com/products/shirt-1.jpg"
          }
        }
      ]
    }
  ]
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs                                        |
| ----------- | ---------------- | ------------------------------------------------------- |
| 400         | BAD_REQUEST      | Query params are invalid or cannot be parsed as numbers |
| 401         | UNAUTHORIZED     | No token / expired token / user not found               |
| 404         | NOT_FOUND        | N/A for this endpoint                                   |
| 409         | CONFLICT         | N/A for this endpoint                                   |
| 422         | VALIDATION_ERROR | Request fails query validation                          |
| 500         | INTERNAL_ERROR   | Unexpected server error                                 |

### Error Response Shape

```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

## PATCH /api/orders/:id/status

**Auth required:** Yes (Bearer JWT, admin only)
**Content-Type:** application/json

### Request

Path parameters:

- `id` (integer, required): Order identifier.

Body:

```json
{
  "status": "pending | confirmed | shipped | delivered | cancelled"
}
```

### Success Response — 200

```json
{
  "message": "Order status updated",
  "order": {
    "id": 101,
    "user_id": 12,
    "total_amount": "898.00",
    "discount": "100.00",
    "shipping_address": "123 Main St, City",
    "status": "shipped",
    "created_at": "2026-05-09T10:00:00.000Z",
    "updated_at": "2026-05-09T11:00:00.000Z"
  }
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs                                   |
| ----------- | ---------------- | -------------------------------------------------- |
| 400         | BAD_REQUEST      | Missing or invalid `status` value, or invalid `id` |
| 401         | UNAUTHORIZED     | No token / expired token / user not found          |
| 404         | NOT_FOUND        | Order does not exist                               |
| 409         | CONFLICT         | N/A for this endpoint                              |
| 422         | VALIDATION_ERROR | Request body fails validation                      |
| 500         | INTERNAL_ERROR   | Unexpected server error                            |

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
    {
      "productId": 1,
      "quantity": 2
    }
  ],
  "couponCode": "ZUDIO100",
  "shippingAddress": "123 Main St, City"
}
```

Field rules:

- `items` (array, required): Must contain at least one item.
- `items[].productId` (integer, required): Product identifier.
- `items[].quantity` (integer, required): Must be `>= 1`.
- `couponCode` (string, optional): Single-use coupon code.
- `shippingAddress` (string, required): Delivery address.

### Success Response — 201

```json
{
  "message": "Order placed successfully",
  "order": {
    "id": 201,
    "user_id": 12,
    "total_amount": "898.00",
    "discount": "100.00",
    "shipping_address": "123 Main St, City",
    "status": "pending",
    "created_at": "2026-05-09T12:00:00.000Z",
    "updated_at": "2026-05-09T12:00:00.000Z"
  },
  "discount": 100
}
```

### Error Responses

| HTTP Status | Error Code       | When This Occurs                                                            |
| ----------- | ---------------- | --------------------------------------------------------------------------- |
| 400         | BAD_REQUEST      | Empty cart, missing shipping address, invalid coupon, or insufficient stock |
| 401         | UNAUTHORIZED     | No token / expired token / user not found                                   |
| 404         | NOT_FOUND        | One of the requested products does not exist                                |
| 409         | CONFLICT         | N/A for this endpoint                                                       |
| 422         | VALIDATION_ERROR | Request body fails validation                                               |
| 500         | INTERNAL_ERROR   | Unexpected server error                                                     |

### Error Response Shape

```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```
