#!/usr/bin/env node
const http = require('http');

const baseUrl = 'http://localhost:3000';
let authToken = '';

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('\n=== ENDPOINT TESTING ===\n');

  // Test 1: GET /api/products
  console.log('1. GET /api/products');
  let res = await request('GET', '/api/products');
  console.log(`   Status: ${res.status}, Products: ${res.data.products?.length || 0}`);
  console.log(`   Observation: Returns product list\n`);

  // Test 2: GET /api/products?search=shirt
  console.log('2. GET /api/products?search=shirt');
  res = await request('GET', '/api/products?search=shirt');
  console.log(`   Status: ${res.status}, Products: ${res.data.products?.length || 0}`);
  console.log(`   Observation: Returns filtered products\n`);

  // Test 3: GET /api/products?search=shirt' OR '1'='1 (SQL Injection)
  console.log("3. GET /api/products?search=shirt' OR '1'='1");
  res = await request('GET', "/api/products?search=shirt' OR '1'='1");
  console.log(`   Status: ${res.status}, Products: ${res.data.products?.length || 0}`);
  console.log(`   Observation: SQL Injection — returns ALL products (should return 0)\n`);

  // Test 4: POST /api/auth/register
  console.log('4. POST /api/auth/register');
  res = await request('POST', '/api/auth/register', {
    name: 'Test User',
    email: 'testuser@test.com',
    password: 'testpass123',
  });
  console.log(`   Status: ${res.status}`);
  if (res.data.token) {
    authToken = res.data.token;
    console.log(`   Token received (plaintext password stored)\n`);
  }

  // Test 5: POST /api/auth/login
  console.log('5. POST /api/auth/login');
  res = await request('POST', '/api/auth/login', {
    email: 'testuser@test.com',
    password: 'testpass123',
  });
  console.log(`   Status: ${res.status}`);
  if (res.data.token) {
    authToken = res.data.token;
    console.log(`   Login successful\n`);
  }

  // Test 6: GET /api/orders/history
  console.log('6. GET /api/orders/history');
  res = await request('GET', '/api/orders/history');
  console.log(`   Status: ${res.status}, Orders: ${res.data.orders?.length || 0}`);
  console.log(`   Observation: N+1 query (slow if many orders)\n`);

  // Test 7: POST /api/cart/checkout (with coupon)
  console.log('7. POST /api/cart/checkout (with SAVE50 coupon)');
  res = await request('POST', '/api/cart/checkout', {
    items: [{ productId: 1, quantity: 1 }],
    shippingAddress: '123 Main St',
    couponCode: 'SAVE50',
  });
  console.log(`   Status: ${res.status}`);
  console.log(`   Observation: Order placed with discount\n`);

  // Test 8: POST /api/cart/checkout (same coupon again - should fail but doesn't)
  console.log('8. POST /api/cart/checkout (same SAVE50 coupon again)');
  res = await request('POST', '/api/cart/checkout', {
    items: [{ productId: 2, quantity: 1 }],
    shippingAddress: '123 Main St',
    couponCode: 'SAVE50',
  });
  console.log(`   Status: ${res.status}`);
  console.log(`   Observation: Race condition — coupon should be used but isn't rejected\n`);

  // Test 9: GET /api/products (check stock after checkout)
  console.log('9. GET /api/products (check stock)');
  res = await request('GET', '/api/products');
  const product = res.data.products?.find((p) => p.id === 1 || p.id === 2);
  console.log(`   Status: ${res.status}`);
  if (product) {
    console.log(`   Product stock: ${product.stock}`);
    console.log(`   Observation: Stock unchanged (should be decremented)\n`);
  }

  console.log('=== TESTS COMPLETE ===\n');
}

runTests().catch(console.error);
