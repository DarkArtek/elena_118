import { createClient } from '@supabase/supabase-js'

// Recupera le variabili d'ambiente (crea un file .env nella root del frontend)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Mancano le variabili d\'ambiente di Supabase!')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)