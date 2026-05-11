# REST API Contracts

---

# GET /api/products

**Auth Required:** No

## Success Response — 200

```json
{
  "products": [
    {
      "id": 1,
      "name": "T-Shirt",
      "price": 499
    }
  ]
}
```

## Error Responses

| Status | Error Code | Condition |
|--------|-------------|------------|
| 500 | INTERNAL_ERROR | Unexpected server error |
| 400 | INVALID_QUERY | Invalid filter parameter |
| 429 | RATE_LIMITED | Too many requests |

## Error Shape

```json
{
  "error": "INTERNAL_ERROR",
  "message": "Something went wrong",
  "details": {}
}
```

---

# POST /api/auth/register

**Auth Required:** No

## Request

```json
{
  "name": "Meghana",
  "email": "test@example.com",
  "password": "secret123"
}
```

## Success Response — 201

```json
{
  "token": "jwt-token"
}
```

## Error Responses

| Status | Error Code | Condition |
|--------|-------------|------------|
| 409 | EMAIL_EXISTS | Email already registered |
| 422 | VALIDATION_ERROR | Invalid request body |
| 500 | INTERNAL_ERROR | Server failure |

---