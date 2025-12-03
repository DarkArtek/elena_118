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

// Funzione di formattazione AVANZATA & AGGRESSIVA (Versione 3.1 - Fix HTML Tags)
const formatDrugResult = (text) => {
  if (!text) return '';

  let formatted = text;

  // 0. PRE-LAVAGGIO (Pulizia profonda del testo grezzo)

  // Rimuove i tag di codice Markdown (```html, ```) all'inizio e alla fine
  formatted = formatted.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');

  // Rimuove i numeri di lista all'inizio delle righe (es. "1.", "2.")
  formatted = formatted.replace(/^\d+\.?\s*/gm, '');

  // Rimuove righe che contengono solo spazi o caratteri invisibili
  formatted = formatted.replace(/^\s*[\r\n]/gm, '');

  // Collassa multipli a capo in uno solo
  formatted = formatted.replace(/\n+/g, '\n');

  formatted = formatted.trim();

  // 1. Markdown bold (**testo** -> strong)
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 2. Formattazione Sezioni Standard
  // Il regex ora è più tollerante sugli spazi prima e dopo
  const sections = [
    { regex: /^\s*Principio Attivo & Classe[:]?/im, icon: "fa-file-waveform", label: "Principio Attivo & Classe" },
    { regex: /^\s*A cosa serve \(Sintesi\)[:]?/im, icon: "fa-notes-medical", label: "A cosa serve (Sintesi)" }
  ];

  sections.forEach(sec => {
    formatted = formatted.replace(sec.regex, () => {
      return `<div class="font-bold text-[#23408e] mt-6 mb-2 text-sm uppercase tracking-wide border-b border-blue-100 pb-1 flex items-center gap-2">` +
          `<i class="fa-solid ${sec.icon}"></i> ${sec.label}</div>`;
    });
  });

  // 3. Gestione ALERT Speciale
  const alertRegex = /(⚠️\s*ALERT PER IL SOCCORRITORE[:]?)/i;
  const parts = formatted.split(alertRegex);

  if (parts.length > 1) {
    let preAlert = parts[0];
    let alertContent = parts.slice(2).join("");

    alertContent = alertContent.trim();

    // Formattazione interna all'alert (Titoli Maiuscoli)
    // Aggiunto supporto per gestire meglio gli spazi prima dei titoli
    alertContent = alertContent.replace(/(^|<br>|\n)\s*([A-ZÀ-Ú\s\(\)\-\/']{3,}:)/gm, '<strong class="text-red-700 font-bold block mt-3 mb-1 text-xs uppercase tracking-wider">$2</strong>');

    // Ricostruiamo il blocco Alert
    formatted = preAlert +
        '<div class="mt-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl shadow-sm text-slate-700 text-sm leading-relaxed">' +
        '<strong class="text-red-700 flex items-center gap-2 mb-3 uppercase font-bold border-b border-red-200 pb-2">' +
        '<i class="fa-solid fa-triangle-exclamation"></i> Alert Soccorritore' +
        '</strong>' +
        '<div>' +
        alertContent +
        '</div>' +
        '</div>';
  }

  // 4. Gestione A Capo (Newline -> br)
  formatted = formatted.replace(/\n/g, '<br>');

  // 5. PULIZIA FINALE HTML
  // Rimuove doppi <br> e br inutili
  formatted = formatted.replace(/(<br>\s*){2,}/g, '<br>');
  formatted = formatted.replace(/<br>\s*<div/g, '<div');
  formatted = formatted.replace(/<\/div>\s*<br>/g, '</div>');
  formatted = formatted.replace(/^<br>|<br>$/g, '');

  return formatted;
};
</script>

<template>
  <div class="p-4 pb-24">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-slate-800 flex items-center gap-2">
        <!-- Icona Libro Medico -->
        <span class="bg-blue-100 text-[#23408e] p-2 rounded-lg w-10 h-10 flex items-center justify-center">
                    <font-awesome-icon icon="book-medical" />
                </span>
        Prontuario Farmaci
      </h2>
      <p class="text-xs text-slate-500 mt-1">
        Inserisci il nome del farmaco (es. "Coumadin", "Ramipril") per conoscere classe e rischi per il soccorso.
      </p>
    </div>

    <!-- Search Bar -->
    <form @submit.prevent="handleSearch" class="relative mb-6">
      <input v-model="query"
             type="text"
             placeholder="Cerca farmaco..."
             class="w-full p-4 pl-12 rounded-xl border border-slate-300 shadow-sm focus:ring-2 focus:ring-[#23408e] outline-none text-lg bg-white"
             inputmode="search"
      >
      <div class="absolute left-4 top-4 text-slate-400 text-lg">
        <i class="fa-solid fa-magnifying-glass"></i>
      </div>

      <button type="submit" :disabled="!query || loading"
              class="absolute right-2 top-2 bottom-2 bg-[#23408e] text-white px-4 rounded-lg font-bold disabled:opacity-50 disabled:bg-slate-300 transition-colors shadow-sm">
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
      <p class="font-bold mb-1"><font-awesome-icon icon="heart-circle-bolt" /> Generato da Database Ufficiale AIFA</p>
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