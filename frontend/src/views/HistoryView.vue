<script setup>
import { useHistoryStore } from '@/store/historyStore';
import { computed, ref, onMounted } from 'vue';
import EcgLoader from '@/components/EcgLoader.vue';

const store = useHistoryStore();
const missions = computed(() => store.missions);
const isLoading = computed(() => store.loading);

const openId = ref(null);

onMounted(() => {
  store.fetchMissions();
});

const toggleMission = (id) => {
  openId.value = openId.value === id ? null : id;
};

const deleteAll = async () => {
  if(confirm("🚨 SEI SICURO?\n\nStai per cancellare PER SEMPRE tutto lo storico interventi dal database.\nQuesta operazione non è reversibile.")) {
    await store.deleteAllMissions();
  }
}

const deleteSingle = async (id, summary) => {
  if(confirm(`Vuoi eliminare definitivamente l'intervento:\n"${summary}"?`)) {
    if (openId.value === id) openId.value = null;
    await store.deleteMission(id);
  }
}

// Funzione di formattazione potenziata per gestire output misti/sporchi
const formatMissionText = (text) => {
  if (!text) return '';

  let formatted = text;

  // 1. Gestione TITOLI (### Titolo)
  // Sostituisce "### Qualcosa:" o "### Qualcosa" con un blocco titolo HTML stiloso
  formatted = formatted.replace(/###\s*(.*?)(:|\n|$)/g, '<div class="font-bold text-blue-800 mt-4 mb-2 uppercase text-xs tracking-wider border-b border-blue-100 pb-1">$1</div>');

  // 2. Gestione GRASSETTO (**testo**)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-900 font-bold">$1</strong>');

  // 3. Gestione LISTE COMPATTE (• punto)
  // Se c'è un punto elenco che NON è preceduto da un "a capo" o da un tag HTML di chiusura, forziamo il <br>
  // Questo risolve il problema del "muro di testo"
  formatted = formatted.replace(/([^\n>])\s*•/g, '$1<br>•');
  // Formattiamo il punto elenco stesso per dargli un po' di spazio
  formatted = formatted.replace(/•/g, '<span class="text-blue-400 mr-1">•</span>');

  // 4. Gestione A CAPO Standard
  // Se non ci sono già <br> o <p> strutturali, convertiamo i \n
  if (!formatted.includes('<br') && !formatted.includes('<div') && !formatted.includes('<p>')) {
    formatted = formatted.replace(/\n/g, '<br>');
  } else {
    // Anche se c'è HTML, i \n residui vanno convertiti per mantenere la formattazione
    formatted = formatted.replace(/\n/g, '<br>');
  }

  return formatted;
};
</script>

<template>
  <div class="p-4 pb-24">

    <!-- Intestazione Pagina -->
    <div class="flex justify-between items-center mb-6 sticky top-0 bg-slate-50/95 backdrop-blur py-2 z-10 border-b border-slate-100/50">
      <div>
        <h2 class="text-xl font-bold text-slate-800">Storico Missioni</h2>
        <p class="text-xs text-slate-500">Cloud Sync • Supabase</p>
      </div>
      <button v-if="missions.length" @click="deleteAll" class="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded border border-red-200 hover:bg-red-50 transition-colors">
        <i class="fa-solid fa-dumpster-fire mr-1"></i> Elimina Tutto
      </button>
    </div>

    <!-- Loader -->
    <div v-if="isLoading" class="flex justify-center py-10">
      <div class="w-40">
        <EcgLoader color="#23408e" />
        <p class="text-center text-xs text-slate-400 mt-2">Sincronizzazione...</p>
      </div>
    </div>

    <!-- Stato Vuoto -->
    <div v-else-if="missions.length === 0" class="flex flex-col items-center justify-center py-20 text-slate-300">
      <div class="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-2xl">
        <i class="fa-solid fa-folder-open"></i>
      </div>
      <p class="font-medium text-slate-400">Nessun intervento in archivio</p>
    </div>

    <!-- Lista Accordion -->
    <div v-else class="space-y-3">
      <div v-for="mission in missions" :key="mission.id"
           class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all duration-200"
           :class="{'ring-2 ring-blue-500/20 shadow-md': openId === mission.id}">

        <!-- HEADER (Sempre visibile) -->
        <div @click="toggleMission(mission.id)" class="p-4 cursor-pointer hover:bg-slate-50 transition-colors flex justify-between items-center gap-3">

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            {{ new Date(mission.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' }) }}
                        </span>
            </div>
            <h3 class="font-bold text-slate-700 truncate text-sm sm:text-base pr-2">
              {{ mission.summary }}
            </h3>
          </div>

          <div class="flex items-center gap-3">
            <button @click.stop="deleteSingle(mission.id, mission.summary)"
                    class="w-8 h-8 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Elimina intervento">
              <i class="fa-regular fa-trash-can"></i>
            </button>

            <div class="text-slate-300 transition-transform duration-300" :class="{'rotate-180 text-blue-500': openId === mission.id}">
              <i class="fa-solid fa-chevron-down"></i>
            </div>
          </div>
        </div>

        <!-- BODY (Visibile solo se aperto) -->
        <div v-if="openId === mission.id" class="border-t border-slate-100 bg-slate-50/50 p-5 animate-fade-in">
          <!-- Qui applichiamo la formattazione forzata -->
          <div class="prose prose-sm prose-slate max-w-none text-slate-600 leading-relaxed text-sm" v-html="formatMissionText(mission.text)"></div>

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
.animate-fade-in {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Stili per l'HTML iniettato */
:deep(b), :deep(strong) {
  color: #1e3a8a;
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