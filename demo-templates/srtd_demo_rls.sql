-- Row Level Security policy for SRTD demo
-- Creates a demo table with RLS enabled

-- Create a simple demo table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.demo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on the demo table
ALTER TABLE public.demo_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own items
DROP POLICY IF EXISTS "Users can view own items" ON public.demo_items;
CREATE POLICY "Users can view own items"
  ON public.demo_items
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can only insert their own items
DROP POLICY IF EXISTS "Users can insert own items" ON public.demo_items;
CREATE POLICY "Users can insert own items"
  ON public.demo_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
