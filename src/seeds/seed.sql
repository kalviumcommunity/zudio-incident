-- Seed data for Zudio
-- Run: npm run seed

-- Categories
INSERT INTO categories (name, description) VALUES
  ('Men''s Clothing', 'Shirts, trousers, jeans and more for men'),
  ('Women''s Clothing', 'Dresses, tops, kurtis and more for women'),
  ('Kids'' Wear', 'Comfortable clothing for kids'),
  ('Accessories', 'Bags, belts, wallets and accessories'),
  ('Footwear', 'Casual and formal footwear for all')
ON CONFLICT DO NOTHING;

-- Products (20 products)
INSERT INTO products (name, description, price, stock, category_id, image_url) VALUES
  ('Men''s Slim Fit Jeans', 'Classic blue denim slim fit jeans for everyday wear', 799.00, 150, 1, 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400'),
  ('Men''s Casual Polo Shirt', 'Comfortable cotton polo shirt available in multiple colours', 399.00, 200, 1, 'https://images.unsplash.com/photo-1598522325074-042db73aa4e6?w=400'),
  ('Men''s Formal Trousers', 'Slim fit formal trousers for office and events', 699.00, 80, 1, 'https://images.unsplash.com/photo-1585518419759-7fe2e0fbf8a6?w=400'),
  ('Men''s Printed Kurta', 'Festive season printed kurta with ethnic motifs', 549.00, 120, 1, 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?w=400'),
  ('Men''s Sports Shorts', 'Quick-dry sports shorts for gym and running', 299.00, 300, 1, 'https://images.unsplash.com/photo-1539185441755-769473a23570?w=400'),
  ('Women''s Anarkali Kurti', 'Floor length Anarkali kurti with mirror work detailing', 899.00, 90, 2, 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400'),
  ('Women''s Floral Midi Dress', 'Breezy floral print midi dress perfect for summer', 749.00, 110, 2, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400'),
  ('Women''s Straight Jeans', 'High waist straight fit jeans in classic indigo blue', 849.00, 130, 2, 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400'),
  ('Women''s Crop Top', 'Trendy ribbed crop top for casual outings', 349.00, 250, 2, 'https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=400'),
  ('Women''s Palazzo Set', 'Printed palazzo pants with matching top', 699.00, 75, 2, 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=400'),
  ('Kids'' T-Shirt Pack (3)', 'Pack of 3 colourful cotton t-shirts for kids', 499.00, 200, 3, 'https://images.unsplash.com/photo-1519278409-1f56fdda7fe5?w=400'),
  ('Kids'' Dungaree Set', 'Cute denim dungaree set with dotted inner top', 599.00, 60, 3, 'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=400'),
  ('Kids'' Jogger Pants', 'Soft cotton jogger pants for active kids', 449.00, 100, 3, 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400'),
  ('Canvas Tote Bag', 'Large cotton canvas tote bag with zipper pocket', 349.00, 180, 4, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400'),
  ('Leather Wallet', 'Slim genuine leather bi-fold wallet with card slots', 599.00, 95, 4, 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400'),
  ('Fabric Belt', 'Braided fabric belt in neutral tan colour', 249.00, 220, 4, 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400'),
  ('Men''s Casual Sneakers', 'Lightweight canvas sneakers for everyday wear', 999.00, 70, 5, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400'),
  ('Women''s Block Heels', 'Comfortable block heel sandals for parties', 1199.00, 45, 5, 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400'),
  ('Kids'' School Shoes', 'Durable black leather school shoes with velcro', 799.00, 85, 5, 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400'),
  ('Men''s Ethnic Mojaris', 'Traditional embroidered mojari shoes for festive occasions', 649.00, 55, 5, 'https://images.unsplash.com/photo-1514999983723-2f7e538cc41a?w=400')
ON CONFLICT DO NOTHING;

-- Users (10 sample users — passwords are plaintext in this version)
INSERT INTO users (name, email, password, phone, role) VALUES
  ('Aarav Sharma', 'aarav@example.com', 'password123', '9876543210', 'customer'),
  ('Priya Patel', 'priya@example.com', 'priya@2024', '9123456789', 'customer'),
  ('Rohan Mehta', 'rohan@example.com', 'rohan123', '9988776655', 'customer'),
  ('Sneha Gupta', 'sneha@example.com', 'sneha@pass', '9001122334', 'customer'),
  ('Vikram Nair', 'vikram@example.com', 'vikram2024', '9871234567', 'customer'),
  ('Ananya Iyer', 'ananya@example.com', 'ananya@123', '9765432109', 'customer'),
  ('Karan Joshi', 'karan@example.com', 'karan#456', '9654321098', 'customer'),
  ('Pooja Singh', 'pooja@example.com', 'pooja@789', '9543210987', 'customer'),
  ('Admin User', 'admin@zudio.com', 'admin@secure123', '9000000001', 'admin'),
  ('Test Customer', 'test@example.com', 'test1234', '9000000002', 'customer')
ON CONFLICT DO NOTHING;

-- Coupons
INSERT INTO coupons (code, discount_amount, used, expires_at) VALUES
  ('ZUDIO100', 100.00, false, NOW() + INTERVAL '30 days'),
  ('WELCOME50', 50.00, false, NOW() + INTERVAL '60 days'),
  ('SUMMER200', 200.00, false, NOW() + INTERVAL '15 days'),
  ('FEST150', 150.00, false, NOW() + INTERVAL '7 days'),
  ('FLAT500', 500.00, false, NOW() + INTERVAL '3 days')
ON CONFLICT DO NOTHING;
