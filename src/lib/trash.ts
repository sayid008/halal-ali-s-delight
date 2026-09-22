import { SUPABASE_STORAGE_SQL } from "./storage";

export { SUPABASE_STORAGE_SQL };

export function getDaysRemaining(deletedAt?: string | null): number {
  if (!deletedAt) return 30;
  const deletedTime = new Date(deletedAt).getTime();
  if (isNaN(deletedTime)) return 30;
  const expiresTime = deletedTime + 30 * 24 * 60 * 60 * 1000;
  const diffMs = expiresTime - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export const SUPABASE_TRASH_SQL = `-- ==========================================
-- 1. CATEGORIES TABLE (WITH TRASH & SOFT-DELETE)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  sort_order INT DEFAULT 0,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Ensure all columns exist
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ==========================================
-- 2. MENU_ITEMS TABLE (WITH TRASH & SOFT-DELETE)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Ensure all columns exist
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- ==========================================
-- 3. SPECIAL_OFFERS TABLE (MATCHING APP SCHEMA)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.special_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge TEXT DEFAULT 'Special Combo Offer',
  title TEXT NOT NULL DEFAULT 'Special Offer',
  description TEXT DEFAULT '',
  price NUMERIC(10, 2) DEFAULT 0,
  original_price NUMERIC(10, 2),
  image_url TEXT,
  slides JSONB DEFAULT '[]'::jsonb,
  available BOOLEAN DEFAULT TRUE,
  show_overlay BOOLEAN DEFAULT TRUE,
  autoplay BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist in special_offers if table was created previously
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'Special Combo Offer';
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Special Offer';
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2);
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS slides JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS show_overlay BOOLEAN DEFAULT TRUE;
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS autoplay BOOLEAN DEFAULT TRUE;
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.special_offers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ==========================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_offers ENABLE ROW LEVEL SECURITY;

-- Allow public read
DROP POLICY IF EXISTS "Allow public read categories" ON public.categories;
CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read menu_items" ON public.menu_items;
CREATE POLICY "Allow public read menu_items" ON public.menu_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read special_offers" ON public.special_offers;
CREATE POLICY "Allow public read special_offers" ON public.special_offers FOR SELECT USING (true);

-- Allow all write operations (insert, update, delete)
DROP POLICY IF EXISTS "Allow all categories operations" ON public.categories;
CREATE POLICY "Allow all categories operations" ON public.categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all menu_items operations" ON public.menu_items;
CREATE POLICY "Allow all menu_items operations" ON public.menu_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all special_offers operations" ON public.special_offers;
CREATE POLICY "Allow all special_offers operations" ON public.special_offers FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- 5. PERFORMANCE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted_at 
ON public.menu_items (deleted_at);

CREATE INDEX IF NOT EXISTS idx_categories_deleted_at 
ON public.categories (deleted_at);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id 
ON public.menu_items (category_id);

-- ==========================================
-- 6. 30-DAY TRASH AUTO-PURGE FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.purge_old_trash_30_days()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_items_count INT := 0;
  deleted_cats_count INT := 0;
BEGIN
  -- Unlink menu items attached to trashed categories about to be purged
  UPDATE public.menu_items
  SET category_id = NULL
  WHERE category_id IN (
    SELECT id FROM public.categories 
    WHERE deleted_at IS NOT NULL 
      AND deleted_at < (NOW() - INTERVAL '30 days')
  );

  -- Delete dishes in trash for more than 30 days
  DELETE FROM public.menu_items
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < (NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS deleted_items_count = ROW_COUNT;

  -- Delete categories in trash for more than 30 days
  DELETE FROM public.categories
  WHERE deleted_at IS NOT NULL 
    AND deleted_at < (NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS deleted_cats_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'purged_dishes', deleted_items_count,
    'purged_categories', deleted_cats_count,
    'timestamp', NOW()
  );
END;
$$;

-- ==========================================
-- 7. DAILY CLEANUP CRON (IF PG_CRON IS ENABLED)
-- ==========================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'daily-30day-trash-cleanup',
      '0 3 * * *',
      'SELECT public.purge_old_trash_30_days();'
    );
  END IF;
END $$;

-- ==========================================
-- 8. DISTRIBUTE MENU ITEMS ACROSS ALL CATEGORIES (EXCEPT SHOP)
-- ==========================================
CREATE OR REPLACE FUNCTION public.distribute_items_across_categories_except_shop()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cat_count INT := 0;
  v_item_count INT := 0;
BEGIN
  -- Verify non-shop categories exist
  SELECT COUNT(*) INTO v_cat_count
  FROM public.categories
  WHERE deleted_at IS NULL
    AND (available IS NULL OR available = TRUE)
    AND LOWER(TRIM(name)) NOT IN ('shop', 'the shop', 'store', 'merchandise')
    AND LOWER(TRIM(slug)) NOT IN ('shop', 'the-shop', 'store', 'merchandise');

  IF v_cat_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No non-shop categories found to distribute items'
    );
  END IF;

  -- Assign each active menu item to non-shop categories round-robin
  WITH eligible_cats AS (
    SELECT 
      id, 
      ROW_NUMBER() OVER (ORDER BY sort_order, name, created_at) - 1 AS cat_idx,
      COUNT(*) OVER () AS total_cats
    FROM public.categories
    WHERE deleted_at IS NULL
      AND (available IS NULL OR available = TRUE)
      AND LOWER(TRIM(name)) NOT IN ('shop', 'the shop', 'store', 'merchandise')
      AND LOWER(TRIM(slug)) NOT IN ('shop', 'the-shop', 'store', 'merchandise')
  ),
  numbered_items AS (
    SELECT 
      id, 
      ROW_NUMBER() OVER (ORDER BY sort_order, created_at, id) - 1 AS item_idx
    FROM public.menu_items
    WHERE deleted_at IS NULL
  ),
  assignments AS (
    SELECT 
      n.id AS item_id, 
      c.id AS target_cat_id,
      ((n.item_idx / NULLIF(c.total_cats, 0)) * 10) + 10 AS new_sort_order
    FROM numbered_items n
    JOIN eligible_cats c ON (n.item_idx % c.total_cats) = c.cat_idx
  )
  UPDATE public.menu_items m
  SET 
    category_id = a.target_cat_id,
    sort_order = a.new_sort_order
  FROM assignments a
  WHERE m.id = a.item_id;

  GET DIAGNOSTICS v_item_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'distributed_items', v_item_count,
    'categories_used', v_cat_count
  );
END;
$$;

-- Automatically run distribution if categories exist
DO $$
BEGIN
  PERFORM public.distribute_items_across_categories_except_shop();
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
`;

export const SUPABASE_COMPLETE_BACKEND_SETUP_SQL = `${SUPABASE_TRASH_SQL}

-- ==============================================================================
-- 9. STORAGE BUCKET FOR DISH & SPECIAL OFFER IMAGES
-- ==============================================================================
${SUPABASE_STORAGE_SQL}
`;
