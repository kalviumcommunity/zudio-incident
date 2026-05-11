const sqlite3 = require('sqlite3').verbose()
const path = require('path')
require('dotenv').config()

const dbPath = process.env.DATABASE_URL || 'zudio.db'

const seedData = async (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Categories
      db.run('INSERT INTO categories (name, description) VALUES (?, ?)', ['Shirts', 'Casual and formal shirts'])
      db.run('INSERT INTO categories (name, description) VALUES (?, ?)', ['Trousers', 'Jeans, chinos, and trousers'])
      db.run('INSERT INTO categories (name, description) VALUES (?, ?)', ['Dresses', 'Kurtis, anarkalis, dresses'])
      db.run('INSERT INTO categories (name, description) VALUES (?, ?)', ['Footwear', 'Sneakers, shoes, heels, sandals'])
      db.run('INSERT INTO categories (name, description) VALUES (?, ?)', ['Accessories', 'Bags, belts, wallets, caps'])

      // Products (Shirts)
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Men\'s Oxford Shirt', 'Cotton oxford shirt', 999.00, 50, 1, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400'])
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Women\'s Chiffon Blouse', 'Flowy chiffon blouse', 699.00, 40, 1, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400'])
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Men\'s Polo Shirt', 'Cotton polo', 499.00, 30, 1, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400'])

      // Products (Trousers)
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Men\'s Jeans', 'Blue denim jeans', 1199.00, 25, 2, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400'])
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Women\'s Chinos', 'Cotton chinos', 999.00, 20, 2, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400'])

      // Products (Dresses)
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Women\'s Wrap Dress', 'Floral wrap dress', 1299.00, 35, 3, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400'])

      // Products (Footwear)
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Canvas Sneakers', 'Cotton canvas sneakers', 999.00, 45, 4, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'])
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Women\'s Heels', 'Stiletto heels', 1999.00, 15, 4, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'])

      // Products (Accessories)
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Leather Belt', 'Genuine leather belt', 799.00, 60, 5, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400'])
      db.run('INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES (?, ?, ?, ?, ?, ?)',
        ['Canvas Tote Bag', 'Cotton canvas tote', 599.00, 50, 5, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400'])

      // Sample Users
      db.run('INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
        ['Alice Test', 'alice@test.com', '$2b$12$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890', '9876543210', 'customer'])
      db.run('INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
        ['Bob Admin', 'bob@test.com', '$2b$12$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890', '9876543211', 'admin'])

      // Sample Coupons
      db.run('INSERT INTO coupons (code, discount_amount, used, expires_at) VALUES (?, ?, ?, datetime(\'now\', \'+30 days\'))',
        ['SAVE50', 50.00, 0])
      db.run('INSERT INTO coupons (code, discount_amount, used, expires_at) VALUES (?, ?, ?, datetime(\'now\', \'+30 days\'))',
        ['SAVE100', 100.00, 0])
      db.run('INSERT INTO coupons (code, discount_amount, used, expires_at) VALUES (?, ?, ?, datetime(\'now\', \'+30 days\'))',
        ['WELCOME20', 20.00, 0], (err) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
    })
  })
}

;(async () => {
  const db = new sqlite3.Database(dbPath)
  db.run('PRAGMA foreign_keys = ON')

  try {
    await seedData(db)
    console.log('Seed data applied successfully.')
    db.close()
    process.exit(0)
  } catch (err) {
    console.error('Seeding failed:', err.message)
    db.close()
    process.exit(1)
  }
})()
