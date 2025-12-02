import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useHistoryStore = defineStore('history', () => {
    // Carichiamo lo storico da localStorage se esiste
    const saved = localStorage.getItem('elena_history');
    const missions = ref(saved ? JSON.parse(saved) : []);

    const addMission = (summary, sbarText) => {
        const mission = {
            id: Date.now(),
            date: new Date().toLocaleString(),
            summary: summary, // es. "M, 50aa - Trauma"
            text: sbarText
        };
        // Aggiungi in cima
        missions.value.unshift(mission);
        // Persistenza locale
        localStorage.setItem('elena_history', JSON.stringify(missions.value));
    };

    const clearHistory = () => {
        missions.value = [];
        localStorage.removeItem('elena_history');
    };

    return { missions, addMission, clearHistory };
});