import { supabase, isSupabaseConfigured } from "./supabase";

/**
 * The default Supabase Storage Bucket name used across the entire application.
 */
export const MENU_IMAGES_BUCKET = "menu-images";

/**
 * SQL script to create and configure Supabase Storage for images:
 * - Creates 'menu-images' public bucket
 * - Sets 10MB file size limit
 * - Permits all standard web image MIME types
 * - Configures Storage Row-Level Security (RLS) policies for Read, Upload, Update, and Delete.
 */
export const SUPABASE_STORAGE_SQL = `-- ==============================================================================
-- SUPABASE STORAGE SETUP: "menu-images" BUCKET & RLS POLICIES
-- ==============================================================================

-- 1. Create the public "menu-images" storage bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  10485760, -- 10 MB in bytes
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif'
  ];

-- 2. Enable Row Level Security on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Public Read Access (Allows anyone / web visitors to view uploaded menu and offer images)
DROP POLICY IF EXISTS "Allow Public Read Menu Images" ON storage.objects;
CREATE POLICY "Allow Public Read Menu Images"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-images');

-- 4. Public / Admin Insert Access (Allows uploading new images)
DROP POLICY IF EXISTS "Allow Upload Menu Images" ON storage.objects;
CREATE POLICY "Allow Upload Menu Images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'menu-images');

-- 5. Public / Admin Update Access (Allows replacing existing images)
DROP POLICY IF EXISTS "Allow Update Menu Images" ON storage.objects;
CREATE POLICY "Allow Update Menu Images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'menu-images')
WITH CHECK (bucket_id = 'menu-images');

-- 6. Public / Admin Delete Access (Allows deleting images)
DROP POLICY IF EXISTS "Allow Delete Menu Images" ON storage.objects;
CREATE POLICY "Allow Delete Menu Images"
ON storage.objects FOR DELETE
USING (bucket_id = 'menu-images');
`;

export interface UploadImageResult {
  publicUrl: string;
  filePath: string;
  error?: string;
}

/**
 * Upload an image file directly to Supabase Storage 'menu-images' bucket.
 *
 * @param file The browser File object
 * @param folder Subfolder inside the bucket (e.g., 'items', 'offers', 'categories')
 * @param customName Optional custom filename prefix
 */
export async function uploadMenuImage(
  file: File,
  folder: "items" | "offers" | "categories" = "items",
  customName?: string,
): Promise<UploadImageResult> {
  if (!file) {
    throw new Error("No file provided for upload");
  }

  // Validate size (10MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error("Image file size exceeds 10MB limit");
  }

  // Validate mime type
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/avif",
  ];
  if (!validTypes.includes(file.type.toLowerCase())) {
    throw new Error("Invalid file type. Please upload a PNG, JPG, WEBP, GIF, or SVG image.");
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const cleanPrefix = customName
    ? customName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 30)
    : "img";
  const uniqueId = Math.random().toString(36).substring(2, 9);
  const fileName = `${cleanPrefix}-${Date.now()}-${uniqueId}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  if (!isSupabaseConfigured) {
    // If Supabase is not configured, fall back to base64 Data URL for local preview
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          publicUrl: reader.result as string,
          filePath,
        });
      };
      reader.onerror = () => {
        resolve({
          publicUrl: "",
          filePath: "",
          error: "Failed to read local file",
        });
      };
      reader.readAsDataURL(file);
    });
  }

  const { error: uploadError } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    console.error("Supabase storage upload error:", uploadError);
    throw new Error(uploadError.message || "Failed to upload image to Supabase Storage");
  }

  const { data: publicData } = supabase.storage.from(MENU_IMAGES_BUCKET).getPublicUrl(filePath);

  if (!publicData?.publicUrl) {
    throw new Error("Could not generate public URL for uploaded image");
  }

  return {
    publicUrl: publicData.publicUrl,
    filePath,
  };
}

/**
 * Remove an image from Supabase Storage by its public URL or file path.
 */
export async function deleteMenuImage(urlOrPath: string): Promise<boolean> {
  if (!urlOrPath || !isSupabaseConfigured) return false;

  try {
    let filePath = urlOrPath;
    if (urlOrPath.includes(`${MENU_IMAGES_BUCKET}/`)) {
      filePath = urlOrPath.split(`${MENU_IMAGES_BUCKET}/`)[1];
    }

    if (!filePath) return false;

    const { error } = await supabase.storage.from(MENU_IMAGES_BUCKET).remove([filePath]);

    if (error) {
      console.warn("Could not delete old image from storage:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Failed to delete image:", err);
    return false;
  }
}
