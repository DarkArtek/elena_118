<script setup>
import { useHistoryStore } from '@/store/historyStore';
import { computed, ref } from 'vue';

const store = useHistoryStore();
const missions = computed(() => store.missions);

// Stato per gestire quale elemento è aperto (null = nessuno)
const openId = ref(null);

const toggleMission = (id) => {
  // Se clicco su quello già aperto, lo chiudo. Altrimenti apro il nuovo.
  openId.value = openId.value === id ? null : id;
};

const deleteHistory = () => {
  if(confirm("Confermi di voler cancellare tutto lo storico locale? Questa azione è irreversibile.")) {
    store.clearHistory();
  }
}
</script>

<template>
  <div class="p-4 pb-24"> <!-- Padding bottom extra per non coprire l'ultimo elemento col footer -->

    <!-- Intestazione Pagina -->
    <div class="flex justify-between items-center mb-6 sticky top-0 bg-slate-50/95 backdrop-blur py-2 z-10">
      <div>
        <h2 class="text-xl font-bold text-slate-800">Storico Missioni</h2>
        <p class="text-xs text-slate-500">Archivio locale interventi</p>
      </div>
      <button v-if="missions.length" @click="deleteHistory" class="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded hover:bg-red-50 transition-colors">
        <i class="fa-solid fa-trash mr-1"></i> Pulisci
      </button>
    </div>

    <!-- Stato Vuoto -->
    <div v-if="missions.length === 0" class="flex flex-col items-center justify-center py-20 text-slate-300">
      <div class="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-2xl">
        <i class="fa-solid fa-folder-open"></i>
      </div>
      <p class="font-medium text-slate-400">Nessun intervento in memoria</p>
    </div>

    <!-- Lista Accordion -->
    <div class="space-y-3">
      <div v-for="mission in missions" :key="mission.id"
           class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200"
           :class="{'ring-2 ring-blue-500/20 shadow-md': openId === mission.id}">

        <!-- HEADER (Sempre visibile - Cliccabile) -->
        <div @click="toggleMission(mission.id)" class="p-4 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center gap-4">
          <div class="flex-1 min-w-0"> <!-- min-w-0 serve per il truncate del testo -->
            <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            {{ mission.date }}
                        </span>
              <!-- Badge opzionale se c'è scritto 'CRITICA' o 'FAST' nel testo, potremmo aggiungerlo in futuro -->
            </div>
            <h3 class="font-bold text-slate-700 truncate text-sm sm:text-base">
              {{ mission.summary }}
            </h3>
          </div>

          <!-- Icona Chevron rotante -->
          <div class="text-slate-300 transition-transform duration-300" :class="{'rotate-180 text-blue-500': openId === mission.id}">
            <i class="fa-solid fa-chevron-down"></i>
          </div>
        </div>

        <!-- BODY (Visibile solo se aperto) -->
        <!-- Usiamo v-show o v-if. v-if distrugge il DOM, v-show lo nasconde. Qui v-if va bene. -->
        <div v-if="openId === mission.id" class="border-t border-slate-100 bg-slate-50/50 p-5 animate-fade-in">
          <!--
              v-html è FONDAMENTALE qui.
              Prende la stringa che contiene "<b>...</b>" e la trasforma in vero grassetto.
              La classe 'prose' (o stili manuali) serve a dare stile ai tag standard.
          -->
          <div class="prose prose-sm prose-slate max-w-none text-slate-600 leading-relaxed text-sm" v-html="mission.text"></div>

          <!-- Azioni Rapide per l'elemento aperto -->
          <div class="mt-4 pt-3 border-t border-slate-200 flex justify-end">
            <button class="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    @click.stop="navigator.clipboard.writeText(mission.text.replace(/<[^>]*>?/gm, '')) && alert('Testo copiato!')">
              <i class="fa-regular fa-copy"></i> Copia Testo
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Piccola animazione di entrata per il contenuto */
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Override stili per l'HTML iniettato se Tailwind Typography non è installato */
:deep(b), :deep(strong) {
  color: #1e3a8a; /* Blu scuro medicale */
  font-weight: 700;
}
:deep(ul) {
  list-style-type: disc;
  padding-left: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}
:deep(li) {
  margin-bottom: 0.25rem;
}
</style>