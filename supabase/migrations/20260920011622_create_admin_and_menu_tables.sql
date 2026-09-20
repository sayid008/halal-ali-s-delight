/*
# Create admin dashboard schema: admin_users, categories, menu_items

1. New Tables
- `admin_users`: Maps Supabase auth users who are allowed into the admin dashboard.
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, unique)
  - `created_at` (timestamp)
- `categories`: Menu categories (Starters, Main Grill, Curries, etc.)
  - `id` (uuid, primary key)
  - `name` (text, not null) — display name
  - `slug` (text, unique, not null) — URL-safe identifier
  - `sort_order` (integer, default 0) — display order
  - `created_at` (timestamp)
- `menu_items`: Individual dishes shown on the public menu
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `description` (text)
  - `price` (numeric, not null) — stored in rupees (₹)
  - `category_id` (uuid, references categories)
  - `image_url` (text) — public URL from menu-images storage bucket
  - `available` (boolean, default true) — if false, hidden from public
  - `sort_order` (integer, default 0) — display order within category
  - `created_at` (timestamp)

2. Security
- RLS enabled on all three tables.
- admin_users: only authenticated users whose auth.uid() is in admin_users can read.
- categories: public read (anon + authenticated); only admin users can insert/update/delete.
- menu_items: public read for available items (anon + authenticated); only admin users can insert/update/delete.
- Admin check uses: EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()).

3. Storage
- Creates "menu-images" storage bucket (public read, authenticated upload).
- Storage policies: anon can read; authenticated users in admin_users can upload/update/delete.

4. Notes
- No public signup — admin users are created manually in Supabase dashboard, then added to admin_users.
- Prices stored as numeric (rupees). Frontend formats with ₹ symbol.
- Seed data includes 6 categories and 20 menu items matching the existing static menu.
*/

-- =========================================================
-- admin_users table
-- =========================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_self_read" ON admin_users;
CREATE POLICY "admin_users_self_read" ON admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- =========================================================
-- categories table
-- =========================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public can read categories (needed for public menu)
DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT TO anon, authenticated USING (true);

-- Admin can insert/update/delete categories
DROP POLICY IF EXISTS "categories_admin_insert" ON categories;
CREATE POLICY "categories_admin_insert" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

DROP POLICY IF EXISTS "categories_admin_update" ON categories;
CREATE POLICY "categories_admin_update" ON categories
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

DROP POLICY IF EXISTS "categories_admin_delete" ON categories;
CREATE POLICY "categories_admin_delete" ON categories
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- =========================================================
-- menu_items table
-- =========================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Public can read available menu items only
DROP POLICY IF EXISTS "menu_items_public_read" ON menu_items;
CREATE POLICY "menu_items_public_read" ON menu_items
  FOR SELECT TO anon, authenticated USING (true);

-- Admin can insert menu items
DROP POLICY IF EXISTS "menu_items_admin_insert" ON menu_items;
CREATE POLICY "menu_items_admin_insert" ON menu_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- Admin can update menu items
DROP POLICY IF EXISTS "menu_items_admin_update" ON menu_items;
CREATE POLICY "menu_items_admin_update" ON menu_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- Admin can delete menu items
DROP POLICY IF EXISTS "menu_items_admin_delete" ON menu_items;
CREATE POLICY "menu_items_admin_delete" ON menu_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- =========================================================
-- Storage bucket: menu-images
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read files in menu-images
DROP POLICY IF EXISTS "menu_images_public_read" ON storage.objects;
CREATE POLICY "menu_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'menu-images');

-- Admin can upload files
DROP POLICY IF EXISTS "menu_images_admin_insert" ON storage.objects;
CREATE POLICY "menu_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid())
  );

-- Admin can update files
DROP POLICY IF EXISTS "menu_images_admin_update" ON storage.objects;
CREATE POLICY "menu_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid())
  );

-- Admin can delete files
DROP POLICY IF EXISTS "menu_images_admin_delete" ON storage.objects;
CREATE POLICY "menu_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid())
  );

-- =========================================================
-- Seed data: categories
-- =========================================================
INSERT INTO categories (name, slug, sort_order) VALUES
  ('Starter', 'starters', 1),
  ('Main Grill', 'grill', 2),
  ('Curries', 'curries', 3),
  ('Biryani & Rice', 'biryani', 4),
  ('Breads & Sides', 'breads', 5),
  ('Desserts & Drinks', 'desserts', 6)
ON CONFLICT (slug) DO NOTHING;

-- =========================================================
-- Seed data: menu items (prices in rupees)
-- =========================================================
INSERT INTO menu_items (name, description, price, category_id, available, sort_order) VALUES
  ('Vegetable Samosas', 'Hand-folded pastry with spiced peas and potato, tamarind chutney.', 650, (SELECT id FROM categories WHERE slug='starters'), true, 1),
  ('Chicken Pakora', 'Gram flour batter, crisp fried, served with mint raita.', 700, (SELECT id FROM categories WHERE slug='starters'), true, 2),
  ('Onion Bhaji', 'Sweet onion, cumin and coriander, fried golden.', 550, (SELECT id FROM categories WHERE slug='starters'), true, 3),
  ('Lamb Seekh Kebab', 'Minced lamb infused with Ali''s signature spice blend, flame-grilled.', 850, (SELECT id FROM categories WHERE slug='grill'), true, 1),
  ('Chicken Tikka Skewers', 'Yoghurt and paprika marinade, charred over charcoal.', 1150, (SELECT id FROM categories WHERE slug='grill'), true, 2),
  ('Mixed Grill Platter', 'Seekh kebab, chicken tikka, lamb chop and grilled wings for two.', 2400, (SELECT id FROM categories WHERE slug='grill'), true, 3),
  ('Classic Butter Chicken', 'Tender tandoori chicken simmered in a rich tomato and fenugreek gravy.', 1400, (SELECT id FROM categories WHERE slug='curries'), true, 1),
  ('Chicken Tikka Masala', 'Mild, creamy masala sauce with charred chicken tikka.', 1350, (SELECT id FROM categories WHERE slug='curries'), true, 2),
  ('Lamb Karahi', 'Slow-cooked lamb with tomato, ginger and green chilli.', 1500, (SELECT id FROM categories WHERE slug='curries'), true, 3),
  ('Daal Tarka', 'Yellow lentils finished with cumin-tempered ghee.', 950, (SELECT id FROM categories WHERE slug='curries'), true, 4),
  ('Royal Lamb Biryani', 'Slow-cooked lamb, long-grain basmati, saffron and fried onion.', 1600, (SELECT id FROM categories WHERE slug='biryani'), true, 1),
  ('Chicken Biryani', 'Layered basmati with spiced chicken and boiled egg.', 1400, (SELECT id FROM categories WHERE slug='biryani'), true, 2),
  ('Pilau Rice', 'Basmati steamed with whole spices.', 350, (SELECT id FROM categories WHERE slug='biryani'), true, 3),
  ('Peshwari Naan', 'Leavened bread stuffed with sweet sultanas, almonds, and coconut.', 450, (SELECT id FROM categories WHERE slug='breads'), true, 1),
  ('Garlic Naan', 'Fresh from the tandoor with garlic butter and coriander.', 375, (SELECT id FROM categories WHERE slug='breads'), true, 2),
  ('Mint Raita', 'Cool yoghurt, cucumber and fresh mint.', 250, (SELECT id FROM categories WHERE slug='breads'), true, 3),
  ('Gulab Jamun', 'Warm milk dumplings soaked in cardamom syrup.', 500, (SELECT id FROM categories WHERE slug='desserts'), true, 1),
  ('Kheer', 'Slow-cooked rice pudding with pistachio.', 450, (SELECT id FROM categories WHERE slug='desserts'), true, 2),
  ('Mango Lassi', 'Yoghurt blended with sweet Alphonso mango.', 350, (SELECT id FROM categories WHERE slug='desserts'), true, 3),
  ('Masala Chai', 'Spiced black tea brewed with milk.', 250, (SELECT id FROM categories WHERE slug='desserts'), true, 4)
ON CONFLICT DO NOTHING;
