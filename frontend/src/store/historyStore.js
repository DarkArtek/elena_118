import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '@/services/supabase';
import { useAuthStore } from './authStore';

export const useHistoryStore = defineStore('history', () => {
    const missions = ref([]);
    const loading = ref(false);
    const authStore = useAuthStore();

    // Carica interventi dal Cloud
    const fetchMissions = async () => {
        if (!authStore.user) return;
        loading.value = true;

        const { data, error } = await supabase
            .from('interventi')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Errore caricamento storico:", error);
        } else {
            missions.value = data || [];
        }
        loading.value = false;
    };

    // Aggiungi intervento al Cloud
    const addMission = async (summary, text) => {
        if (!authStore.user) return;

        const newMission = {
            user_id: authStore.user.id, // Vincola al soccorritore
            summary: summary,
            text: text, // HTML content
            created_at: new Date().toISOString()
        };

        // 1. Aggiornamento Ottimistico (lo mostro subito)
        const tempId = Date.now();
        missions.value.unshift({ ...newMission, id: tempId });

        // 2. Salvataggio Reale
        const { data, error } = await supabase
            .from('interventi')
            .insert([newMission])
            .select()
            .single();

        if (error) {
            console.error("Errore salvataggio cloud:", error);
            alert("⚠️ Errore sincronizzazione. Controlla la connessione.");
            // Rimuovi l'elemento ottimistico se fallisce
            missions.value = missions.value.filter(m => m.id !== tempId);
        } else {
            // Sostituisci l'elemento temporaneo con quello vero (che ha l'ID del DB)
            const index = missions.value.findIndex(m => m.id === tempId);
            if (index !== -1) {
                missions.value[index] = data;
            }
        }
    };

    const clearHistory = async () => {
        // Implementazione cancellazione remota (opzionale per sicurezza)
        // Per ora puliamo solo la vista locale per evitare cancellazioni accidentali massiva
        missions.value = [];
    };

    return { missions, loading, fetchMissions, addMission, clearHistory };
});