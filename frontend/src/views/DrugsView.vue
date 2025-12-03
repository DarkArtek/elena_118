<script setup>
import { ref } from 'vue';
import { searchDrug } from '@/services/gemini/client';
import EcgLoader from '@/components/EcgLoader.vue';

const query = ref('');
const result = ref(null);
const loading = ref(false);

const handleSearch = async () => {
  if (!query.value) return;
  loading.value = true;
  result.value = null;

  // Chiamata all'AI
  const response = await searchDrug(query.value);
  result.value = response;

  loading.value = false;
};

// Funzione di formattazione specifica per i farmaci
const formatDrugResult = (text) => {
  if (!text) return '';
  let formatted = text;

  // 1. Pulizia base Markdown -> HTML
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 2. Styling dei Titoli Standard (Li rendiamo blu e strutturati)
  const titles = [
    "Principio Attivo & Classe:",
    "A cosa serve \\(Sintesi\\):"
  ];

  titles.forEach(title => {
    // Crea un'espressione regolare dinamica
    const regex = new RegExp(`(${title})`, 'g');
    // Sostituisce con uno stile a blocco blu
    formatted = formatted.replace(regex, '<div class="font-bold text-blue-900 mt-4 mb-1 text-sm uppercase tracking-wide border-b border-blue-100 pb-1">$1</div>');
  });

  // 3. Styling Speciale per l'ALERT (Box Rosso)
  // Cerchiamo la stringa dell'alert e tutto ciò che segue fino alla fine o doppio a capo
  if (formatted.includes("⚠️ ALERT")) {
    // Avvolgiamo l'alert in un div rosso
    formatted = formatted.replace(
        /(⚠️ ALERT PER IL SOCCORRITORE:)/g,
        '<div class="mt-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-900 shadow-sm"><strong class="block mb-2 text-red-700 flex items-center gap-2 text-sm uppercase tracking-bold"><i class="fa-solid fa-triangle-exclamation"></i> $1</strong>'
    );
    // Chiudiamo il div alla fine del testo
    formatted += '</div>';
  }

  // 4. Gestione "A Capo" se non c'è già HTML strutturale
  if (!formatted.includes('<p>') && !formatted.includes('<br>')) {
    formatted = formatted.replace(/\n/g, '<br>');
  }

  return formatted;
};
</script>

<template>
  <div class="p-4 pb-24">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span class="bg-blue-100 text-blue-700 p-2 rounded-lg w-10 h-10 flex items-center justify-center">
                    <font-awesome-icon icon="book-medical" />
                </span>
        Prontuario AI
      </h2>
      <p class="text-xs text-slate-500 mt-1">
        Inserisci il nome del farmaco (es. "Coumadin", "Cardioaspirina") per conoscere classe e rischi per il soccorso.
      </p>
    </div>

    <!-- Search Bar -->
    <form @submit.prevent="handleSearch" class="relative mb-6">
      <input v-model="query"
             type="text"
             placeholder="Cerca farmaco..."
             class="w-full p-4 pl-12 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-lg bg-white"
             inputmode="search"
      >
      <div class="absolute left-4 top-4 text-slate-400 text-lg">
        <!-- Icona lente (usiamo fontawesome standard se registrata o classe diretta) -->
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>

      <button type="submit" :disabled="!query || loading"
              class="absolute right-2 top-2 bottom-2 bg-blue-600 text-white px-4 rounded-lg font-bold disabled:opacity-50 disabled:bg-slate-300 transition-colors shadow-sm">
        Cerca
      </button>
    </form>

    <!-- Loader -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="w-32"><EcgLoader color="#23408e" /></div>
    </div>

    <!-- Risultato -->
    <div v-if="result" class="animate-fade-in bg-white p-5 rounded-xl shadow-lg border border-slate-100 ring-1 ring-slate-50">
      <!-- Applichiamo la formattazione qui -->
      <div class="prose prose-sm prose-slate max-w-none text-slate-600 leading-relaxed" v-html="formatDrugResult(result)"></div>
    </div>

    <!-- Disclaimer -->
    <div class="mt-8 p-4 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-400 text-center">
      <p class="font-bold mb-1"><i class="fa-solid fa-robot"></i> Generato da Intelligenza Artificiale</p>
      I dati forniti sono indicativi. In caso di dubbio clinico o discrepanza, fai sempre riferimento alla centrale operativa o al bugiardino ufficiale.
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

/* Stili deep per l'HTML iniettato */
:deep(b), :deep(strong) {
  font-weight: 700;
}
</style>