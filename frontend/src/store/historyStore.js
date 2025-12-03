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
            user_id: authStore.user.id,
            summary: summary,
            text: text,
            created_at: new Date().toISOString()
        };

        // Aggiornamento Ottimistico
        const tempId = Date.now();
        missions.value.unshift({ ...newMission, id: tempId });

        const { data, error } = await supabase
            .from('interventi')
            .insert([newMission])
            .select()
            .single();

        if (error) {
            console.error("Errore salvataggio cloud:", error);
            alert("⚠️ Errore sincronizzazione. Controlla la connessione.");
            missions.value = missions.value.filter(m => m.id !== tempId);
        } else {
            const index = missions.value.findIndex(m => m.id === tempId);
            if (index !== -1) missions.value[index] = data;
        }
    };

    // --- NUOVO: Cancellazione Singola ---
    const deleteMission = async (id) => {
        // Rimuoviamo localmente subito (Feedback istantaneo)
        const backup = [...missions.value];
        missions.value = missions.value.filter(m => m.id !== id);

        const { error } = await supabase
            .from('interventi')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Errore cancellazione:", error);
            alert("Impossibile cancellare l'intervento.");
            missions.value = backup; // Ripristina se fallisce
        }
    };

    // --- NUOVO: Cancellazione Totale ---
    const deleteAllMissions = async () => {
        const backup = [...missions.value];
        missions.value = []; // Pulisci vista

        // Cancella tutto ciò che appartiene a questo utente
        const { error } = await supabase
            .from('interventi')
            .delete()
            .eq('user_id', authStore.user.id);

        if (error) {
            console.error("Errore pulizia storico:", error);
            alert("Errore durante la cancellazione totale.");
            missions.value = backup;
        }
    };

    return { missions, loading, fetchMissions, addMission, deleteMission, deleteAllMissions };
});