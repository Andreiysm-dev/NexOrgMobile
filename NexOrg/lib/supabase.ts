import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://nglwoqsnhanporhrhzjg.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nbHdvcXNuaGFucG9yaHJoempnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3MTQzMzEsImV4cCI6MjA3MDI5MDMzMX0.jMGBSpTuVqgnb8kDFiZfOy7ygiZvaTMK2__st8Heb9A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
