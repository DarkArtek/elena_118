import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { useRouter } from 'vue-router'

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null)
    const router = useRouter()

    // Controlla se c'è già una sessione attiva all'avvio
    const initialize = async () => {
        const { data } = await supabase.auth.getSession()
        user.value = data.session?.user || null

        // Ascolta i cambiamenti (es. logout da un altro tab)
        supabase.auth.onAuthStateChange((_event, session) => {
            user.value = session?.user || null
            if (!user.value) {
                // Se non c'è utente, rimanda al login (tranne se siamo già lì)
                // Nota: gestito meglio nel router guard
            }
        })
    }

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })
        if (error) throw error
        user.value = data.user
        return data.user
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        user.value = null
    }

    return { user, initialize, signIn, signOut }
})