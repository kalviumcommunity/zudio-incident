# Step 5 - Complete REST API Contracts

## Error Response Standard (applies to all endpoints)

```json
{ "error": "MACHINE_READABLE_CODE", "message": "Human text", "details": {} }
```

---

## GET /api/products

**Auth required:** No
**Content-Type:** N/A

### Request
Query params:
- `search`: string, optional, 1-100 chars
- `category`: string, optional, category name
- `limit`: number, optional, default `20`, min `1`, max `100`
- `offset`: number, optional, default `0`, min `0`

### Success Response - 200 OK
```json
{
	"products": [
		{
			"id": 7,
			"name": "Striped Kurta",
			"description": "Cotton summer kurta",
			"price": "649.50",
			"stock": 42,
			"category_id": 2,
			"category_name": "Women",
			"image_url": "https://cdn.zudio.example/products/7.jpg",
			"created_at": "2026-05-10T08:12:11.000Z"
		}
	],
	"count": 1
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_QUERY_PARAMS | limit/offset/search/category values invalid |
| 404 | CATEGORY_NOT_FOUND | category filter provided but no category exists |
| 422 | VALIDATION_ERROR | query parameter schema validation failed |
| 500 | INTERNAL_ERROR | unexpected database/server failure |

### Error Response Shape
```json
{ "error": "INVALID_QUERY_PARAMS", "message": "limit must be between 1 and 100", "details": { "field": "limit" } }
```

---

## GET /api/products/:id

**Auth required:** No
**Content-Type:** N/A

### Request
Path params:
- `id`: number, required, positive integer

### Success Response - 200 OK
```json
{
	"id": 7,
	"name": "Striped Kurta",
	"description": "Cotton summer kurta",
	"price": "649.50",
	"stock": 42,
	"category_id": 2,
	"category_name": "Women",
	"image_url": "https://cdn.zudio.example/products/7.jpg",
	"created_at": "2026-05-10T08:12:11.000Z"
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_PRODUCT_ID | path id is not a positive integer |
| 404 | NOT_FOUND | product does not exist |
| 422 | VALIDATION_ERROR | path parameter validation failed |
| 500 | INTERNAL_ERROR | unexpected database/server failure |

### Error Response Shape
```json
{ "error": "NOT_FOUND", "message": "Product not found", "details": { "productId": 9999 } }
```

---

## POST /api/auth/register

**Auth required:** No
**Content-Type:** application/json

### Request
Body:
```json
{
	"name": "Aarav Sharma",
	"email": "aarav.sharma@example.com",
	"password": "Password123!",
	"phone": "9876543210"
}
```

Fields:
- `name`: string, required, 2-100 chars
- `email`: string, required, valid email
- `password`: string, required, min 8 chars
- `phone`: string, optional, max 20 chars

### Success Response - 201 Created
```json
{
	"message": "Registration successful",
	"token": "<jwt>",
	"user": {
		"id": 101,
		"name": "Aarav Sharma",
		"email": "aarav.sharma@example.com",
		"phone": "9876543210",
		"created_at": "2026-05-11T09:30:00.000Z"
	}
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | REQUIRED_FIELDS_MISSING | name/email/password missing |
| 409 | EMAIL_ALREADY_REGISTERED | email already exists |
| 422 | VALIDATION_ERROR | request body schema validation failed |
| 500 | INTERNAL_ERROR | unexpected database/server failure |

### Error Response Shape
```json
{ "error": "EMAIL_ALREADY_REGISTERED", "message": "Email already registered", "details": { "email": "aarav.sharma@example.com" } }
```

---

## POST /api/auth/login

**Auth required:** No
**Content-Type:** application/json

### Request
Body:
```json
{
	"email": "aarav.sharma@example.com",
	"password": "Password123!"
}
```

Fields:
- `email`: string, required, valid email
- `password`: string, required

### Success Response - 200 OK
```json
{
	"message": "Login successful",
	"token": "<jwt>",
	"user": {
		"id": 101,
		"name": "Aarav Sharma",
		"email": "aarav.sharma@example.com",
		"phone": "9876543210"
	}
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | REQUIRED_FIELDS_MISSING | email or password missing |
| 401 | UNAUTHORIZED | invalid credentials or expired auth context |
| 422 | VALIDATION_ERROR | request body schema validation failed |
| 500 | INTERNAL_ERROR | unexpected database/server failure |

### Error Response Shape
```json
{ "error": "UNAUTHORIZED", "message": "Invalid credentials", "details": {} }
```

---

## GET /api/orders/history

**Auth required:** Yes (Bearer JWT)
**Content-Type:** N/A

### Request
Headers:
- `Authorization: Bearer <jwt>` (required)

Query params:
- `offset`: number, optional, default `0`, min `0`

### Success Response - 200 OK
```json
{
	"orders": [
		{
			"id": 42,
			"user_id": 101,
			"total_amount": "1199.00",
			"discount": "100.00",
			"shipping_address": "Indiranagar, Bengaluru",
			"status": "pending",
			"created_at": "2026-05-11T10:10:11.000Z",
			"updated_at": "2026-05-11T10:10:11.000Z",
			"items": [
				{
					"id": 501,
					"order_id": 42,
					"product_id": 7,
					"product_name": "Striped Kurta",
					"product_price": "649.50",
					"quantity": 2,
					"unit_price": "649.50",
					"created_at": "2026-05-11T10:10:11.000Z",
					"product": {
						"id": 7,
						"name": "Striped Kurta",
						"price": "649.50",
						"image_url": "https://cdn.zudio.example/products/7.jpg"
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
| 400 | INVALID_OFFSET | offset is negative or not numeric |
| 401 | UNAUTHORIZED | missing/invalid/expired JWT |
| 404 | NOT_FOUND | no orders found for authenticated user |
| 422 | VALIDATION_ERROR | request validation failed |
| 500 | INTERNAL_ERROR | unexpected database/server failure |

### Error Response Shape
```json
{ "error": "UNAUTHORIZED", "message": "Token expired. Please log in again.", "details": {} }
```

---

## POST /api/cart/checkout

**Auth required:** Yes (Bearer JWT)
**Content-Type:** application/json

### Request
Body:
```json
{
	"items": [
		{ "productId": 7, "quantity": 2 },
		{ "productId": 15, "quantity": 1 }
	],
	"couponCode": "ZUDIO100",
	"shippingAddress": "Indiranagar, Bengaluru"
}
```

Fields:
- `items`: array, required, min length 1
- `items[].productId`: number, required, positive integer
- `items[].quantity`: number, required, integer in range 1-100
- `couponCode`: string, optional, 1-50 chars
- `shippingAddress`: string, required, 5-300 chars

### Success Response - 201 Created
```json
{
	"message": "Order placed successfully",
	"order": {
		"id": 42,
		"user_id": 101,
		"total_amount": "1199.00",
		"discount": "100.00",
		"shipping_address": "Indiranagar, Bengaluru",
		"status": "pending",
		"created_at": "2026-05-11T10:10:11.000Z",
		"updated_at": "2026-05-11T10:10:11.000Z"
	},
	"discount": 100
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | EMPTY_CART | items missing or empty |
| 400 | INVALID_COUPON | coupon invalid, expired, or already used |
| 401 | UNAUTHORIZED | missing/invalid/expired JWT |
| 404 | NOT_FOUND | requested product does not exist |
| 409 | INSUFFICIENT_STOCK | requested quantity exceeds available stock |
| 422 | VALIDATION_ERROR | request body schema validation failed |
| 500 | INTERNAL_ERROR | unexpected server error (transaction rolled back) |

### Error Response Shape
```json
{ "error": "INSUFFICIENT_STOCK", "message": "Only 3 units available for product 7", "details": { "productId": 7, "available": 3 } }
```

---

## PATCH /api/orders/:id/status

**Auth required:** Yes (Bearer JWT, Admin)
**Content-Type:** application/json

### Request
Path params:
- `id`: number, required, positive integer

Body:
```json
{ "status": "shipped" }
```

Fields:
- `status`: string, required, one of `pending|confirmed|shipped|delivered|cancelled`

### Success Response - 200 OK
```json
{
	"message": "Order status updated",
	"order": {
		"id": 42,
		"user_id": 101,
		"total_amount": "1199.00",
		"discount": "100.00",
		"shipping_address": "Indiranagar, Bengaluru",
		"status": "shipped",
		"created_at": "2026-05-11T10:10:11.000Z",
		"updated_at": "2026-05-11T12:00:00.000Z"
	}
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_STATUS | status not in allowed values |
| 401 | UNAUTHORIZED | missing/invalid/expired JWT |
| 404 | NOT_FOUND | order id does not exist |
| 409 | STATUS_CONFLICT | illegal status transition requested |
| 422 | VALIDATION_ERROR | request validation failed |
| 500 | INTERNAL_ERROR | unexpected database/server failure |

### Error Response Shape
```json
{ "error": "INVALID_STATUS", "message": "status must be one of pending, confirmed, shipped, delivered, cancelled", "details": { "status": "unknown" } }
```

---

## GET /api/health

**Auth required:** No
**Content-Type:** N/A

### Request
No request body.

### Success Response - 200 OK
```json
{
	"status": "ok",
	"timestamp": "2026-05-11T12:00:00.000Z"
}
```

### Error Responses

| HTTP Status | Error Code | When This Occurs |
|-------------|------------|------------------|
| 400 | INVALID_HEALTH_REQUEST | unsupported query shape passed to health endpoint |
| 404 | NOT_FOUND | route mismatch under proxy path rewriting |
| 422 | VALIDATION_ERROR | request validation fails in edge middleware |
| 500 | INTERNAL_ERROR | unexpected server failure while preparing health response |

### Error Response Shape
```json
{ "error": "INTERNAL_ERROR", "message": "Something went wrong", "details": {} }
```
