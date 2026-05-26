import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjaeireljkcvjnigfhzb.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWVpcmVsamtjdmpuaWdmaHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MDA4NjIsImV4cCI6MjA5NDI3Njg2Mn0.vB76RwGG_4VgDKC8RAllkH7HZgWQB4JWcUtq7Z6svas'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)