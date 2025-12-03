<script setup>
import { ref, computed } from 'vue';
import { usePatientStore } from '@/store/patientStore';
import { useHistoryStore } from '@/store/historyStore';
import { analyzePatient } from '@/services/gemini/client';
import EcgLoader from '@/components/EcgLoader.vue'; // <-- Import componente Loader

// Stores
const patientStore = usePatientStore();
const historyStore = useHistoryStore();
const form = patientStore.form; // Reactive reference

// UI State
const isLoading = ref(false);
const result = ref(null);
const showResultModal = ref(false);

// Definizioni Triage Utente
const triageCodes = {
  'Rosso': { color: 'bg-red-600 text-white ring-red-300', icon: '🔴', desc: 'Emergenza con compromissione funzioni vitali. Accesso immediato.' },
  'Giallo': { color: 'bg-yellow-400 text-yellow-900 ring-yellow-200', icon: '🟡', desc: 'Condizione stabile con basso rischio evolutivo. Accesso differibile.' },
  'Verde': { color: 'bg-green-600 text-white ring-green-300', icon: '🟢', desc: 'Condizione stabile, alta sofferenza senza rischio evolutivo. Accesso differibile.' },
  'Bianco': { color: 'bg-slate-100 text-slate-600 border-slate-300 ring-slate-200', icon: '⚪', desc: 'Non critico, non urgente.' }
};

// Computed per mostrare la descrizione del codice selezionato
const selectedTriageDesc = computed(() => {
  return form.triage && triageCodes[form.triage] ? triageCodes[form.triage].desc : 'Seleziona un codice priorità stimato.';
});

// Helper per ottenere icona dal nome colore
const getIconFromColorName = (name) => {
  if (!name) return '?';
  // Normalizza stringa (es. "Rosso" -> "Rosso")
  const key = Object.keys(triageCodes).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? triageCodes[key].icon : '?';
};

// Logic
const submitAnalysis = async () => {
  if (isLoading.value) return;
  isLoading.value = true;

  // Simuliamo un minimo di delay per UX se offline o per far vedere l'animazione ECG
  // (l'analisi reale potrebbe essere istantanea, un piccolo delay aiuta l'utente a capire che sta elaborando)
  const analysisText = await analyzePatient(form);

  result.value = analysisText;
  showResultModal.value = true;
  isLoading.value = false;

  // --- LOGICA INTELLIGENTE PER LO STORICO ---

  // 1. Estrai il Triage di Elena (se presente nel testo HTML tramite attributo data-ai-triage)
  const aiTriageMatch = analysisText.match(/data-ai-triage="([^"]+)"/);
  const aiTriageColor = aiTriageMatch ? aiTriageMatch[1] : null;
  const aiIcon = getIconFromColorName(aiTriageColor);

  // 2. Icona Triage Utente
  const userIcon = form.triage && triageCodes[form.triage] ? triageCodes[form.triage].icon : '';

  // 3. Determina icona finale per il sommario
  let finalIconDisplay = userIcon || '⚪';

  // Se Elena ha dato un triage E questo è diverso da quello utente, mostriamo la discrepanza
  if (aiTriageColor && form.triage && aiTriageColor.toLowerCase() !== form.triage.toLowerCase()) {
    finalIconDisplay = `${userIcon}➔${aiIcon}`;
  } else if (aiTriageColor && !form.triage) {
    // Se l'utente non ha messo nulla, usiamo quello di Elena
    finalIconDisplay = aiIcon;
  }

  // Costruiamo la stringa completa
  const pa = `${form.pa_sys || '?'}/${form.pa_dia || '?'}`;
  const vitals = `${form.fc || '?'}-${pa}-${form.fr || '?'}`;
  const summary = `${finalIconDisplay} ${form.sesso} ${form.eta || '?'} ${vitals} • ${form.note.substring(0, 20)}...`;

  historyStore.addMission(summary, analysisText);
};

const closeAndReset = () => {
  showResultModal.value = false;
  patientStore.resetForm();
  // Reset manuale del campo triage se non presente nello store originale
  if(form.triage) form.triage = '';
  result.value = null;
};

const formattedResult = computed(() => {
  if (!result.value) return '';
  return result.value
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-blue-900 font-bold">$1</strong>')
      .replace(/\n/g, '<br>')
      .replace(/\* /g, '• ');
});

const copyToClipboard = () => {
  navigator.clipboard.writeText(result.value.replace(/<br>/g, '\n').replace(/<\/?[^>]+(>|$)/g, ""));
  alert("SBAR copiato!");
};
</script>

<template>
  <div class="p-4 space-y-6 pb-20">

    <!-- SEZIONE 1: ANAGRAFICA -->
    <section class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Paziente</h2>
      <div class="flex gap-3">
        <div class="flex-1">
          <label class="block text-sm font-medium text-slate-600 mb-1">Età</label>
          <input v-model="form.eta" type="number" inputmode="numeric" class="input-med w-full p-3 border rounded-lg" placeholder="Anni">
        </div>
        <div class="w-1/3">
          <label class="block text-sm font-medium text-slate-600 mb-1">Sesso</label>
          <select v-model="form.sesso" class="input-med w-full p-3 border rounded-lg bg-white">
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
      </div>
    </section>

    <!-- SEZIONE 2: NEURO & FAST -->
    <section :class="['p-4 rounded-xl border shadow-sm transition-colors duration-300', patientStore.isFastPositive ? 'bg-red-50 border-red-300' : 'bg-white border-slate-200']">
      <div class="flex justify-between items-center mb-3">
        <h2 class="text-xs font-bold uppercase tracking-wider" :class="patientStore.isFastPositive ? 'text-red-600' : 'text-slate-400'">
          Neurologico (D)
        </h2>
        <span v-if="patientStore.isFastPositive" class="bg-red-600 text-white text-xs px-2 py-1 rounded font-bold animate-pulse">
          TIME IS BRAIN
        </span>
      </div>

      <!-- AVPU -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-slate-600 mb-1">AVPU</label>
        <div class="grid grid-cols-4 gap-2">
          <button v-for="opt in ['A','V','P','U']"
                  @click="form.avpu = opt"
                  :class="['py-3 rounded-lg font-bold transition-all border',
                     form.avpu === opt
                     ? (opt === 'A' ? 'bg-green-600 text-white border-green-700' : 'bg-red-600 text-white border-red-700')
                     : 'bg-slate-50 text-slate-600 border-slate-200']">
            {{ opt }}
          </button>
        </div>
      </div>

      <!-- FAST -->
      <div class="border-t border-slate-200/50 pt-3">
        <p class="text-sm font-bold text-slate-700 mb-2 flex items-center">
          <i class="fa-solid fa-bolt mr-2" :class="patientStore.isFastPositive ? 'text-red-500' : 'text-slate-400'"></i>
          Valutazione FAST
        </p>
        <div class="grid grid-cols-3 gap-2">
          <label :class="['cursor-pointer p-2 rounded-lg border text-center text-sm font-medium transition-all select-none', form.fast.face ? 'bg-red-100 border-red-400 text-red-800' : 'bg-white border-slate-300 text-slate-500']">
            <input type="checkbox" v-model="form.fast.face" class="hidden">
            <i class="fa-regular fa-face-frown mb-1 block text-lg"></i> Face
          </label>
          <label :class="['cursor-pointer p-2 rounded-lg border text-center text-sm font-medium transition-all select-none', form.fast.arm ? 'bg-red-100 border-red-400 text-red-800' : 'bg-white border-slate-300 text-slate-500']">
            <input type="checkbox" v-model="form.fast.arm" class="hidden">
            <i class="fa-solid fa-hands mb-1 block text-lg"></i> Arm
          </label>
          <label :class="['cursor-pointer p-2 rounded-lg border text-center text-sm font-medium transition-all select-none', form.fast.speech ? 'bg-red-100 border-red-400 text-red-800' : 'bg-white border-slate-300 text-slate-500']">
            <input type="checkbox" v-model="form.fast.speech" class="hidden">
            <i class="fa-solid fa-comments mb-1 block text-lg"></i> Speech
          </label>
        </div>

        <div v-if="patientStore.isFastPositive" class="mt-3 bg-red-100 p-3 rounded-lg border border-red-200">
          <label class="block text-sm font-bold text-red-800 mb-1">
            <i class="fa-regular fa-clock mr-1"></i> Orario LKW
          </label>
          <input v-model="form.fast.time" type="time" class="w-full p-2 rounded border border-red-300 text-lg font-mono outline-none">
        </div>
      </div>
    </section>

    <!-- SEZIONE 3: PARAMETRI -->
    <section class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Parametri (B & C)</h2>

      <div class="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label class="text-sm text-slate-500 block mb-1">PA Sistolica</label>
          <div class="relative">
            <input v-model="form.pa_sys" type="number" inputmode="numeric" class="input-med w-full p-3 pl-3 pr-8 rounded-lg border" placeholder="120">
            <span class="absolute right-3 top-3.5 text-xs text-slate-400">mmHg</span>
          </div>
        </div>
        <div>
          <label class="text-sm text-slate-500 block mb-1">PA Diastolica</label>
          <div class="relative">
            <input v-model="form.pa_dia" type="number" inputmode="numeric" class="input-med w-full p-3 pl-3 pr-8 rounded-lg border" placeholder="80">
            <span class="absolute right-3 top-3.5 text-xs text-slate-400">mmHg</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="text-sm text-slate-500 block mb-1">FC</label>
          <input v-model="form.fc" type="number" inputmode="numeric" class="input-med w-full p-2 rounded-lg border text-center font-mono" :class="{'border-red-400 bg-red-50': patientStore.isArrhythmia}" placeholder="BPM">
        </div>
        <div>
          <label class="text-sm text-slate-500 block mb-1">SpO2</label>
          <input v-model="form.spo2" type="number" inputmode="numeric" class="input-med w-full p-2 rounded-lg border text-center font-mono" :class="{'border-orange-400 bg-orange-50': patientStore.isRespiratoryDistress}" placeholder="%">
        </div>
        <div>
          <label class="text-sm text-slate-500 block mb-1">FR</label>
          <input v-model="form.fr" type="number" inputmode="numeric" class="input-med w-full p-2 rounded-lg border text-center font-mono" :class="{'border-orange-400 bg-orange-50': patientStore.isRespiratoryDistress}" placeholder="Atti">
        </div>
      </div>

      <!-- SUGGERIMENTI DINAMICI -->
      <div v-if="patientStore.isRespiratoryDistress" class="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3 animate-pulse-fast">
        <h4 class="font-bold text-sm text-orange-800 mb-1">E.O. Torace Richiesto</h4>
        <select v-model="form.eo_torace" class="w-full p-2 text-sm border border-orange-300 rounded bg-white">
          <option value="">-- Seleziona --</option>
          <option value="MV Presente">Murmure Valido</option>
          <option value="MV Ridotto/Assente">Silenzio / MV Ridotto</option>
          <option value="Rumori Umidi">Rumori Umidi</option>
          <option value="Sibili/Fischi">Sibili</option>
        </select>
      </div>

      <div v-if="patientStore.isArrhythmia" class="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
        <h4 class="font-bold text-sm text-yellow-800 mb-1">Aritmia: ECG Gi-Ro-Ne-Ve</h4>
        <label class="flex items-center gap-2 mt-2 cursor-pointer">
          <input type="checkbox" v-model="form.toni_aritmici" class="w-4 h-4 text-yellow-600 rounded">
          <span class="text-sm font-medium text-slate-700">Toni Aritmici udibili?</span>
        </label>
      </div>
    </section>

    <!-- NOTE & TRIAGE -->
    <section class="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <h2 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Note & Triage</h2>
      <textarea v-model="form.note" rows="3" class="input-med w-full p-3 border rounded-lg mb-4" placeholder="Es. TCLC, emorragia, dinamica..."></textarea>

      <!-- SELETTORE TRIAGE -->
      <div class="border-t pt-4 border-slate-100">
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Codice Triage Stimato</label>
        <div class="grid grid-cols-4 gap-2 mb-2">
          <button v-for="(data, code) in triageCodes" :key="code"
                  @click="form.triage = code"
                  :class="['h-12 rounded-lg font-bold border-2 transition-all flex items-center justify-center shadow-sm',
                           form.triage === code ? data.color + ' ring-2 ring-offset-2 border-transparent transform scale-105' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300']">
            {{ code }}
          </button>
        </div>
        <p class="text-xs text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100 min-h-[3em] flex items-center">
          <i class="fa-solid fa-info-circle mr-2 text-blue-400"></i>
          {{ selectedTriageDesc }}
        </p>
      </div>
    </section>

    <!-- ACTION BUTTON -->
    <div class="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-100 to-transparent z-40">
      <div class="max-w-md mx-auto">
        <button @click="submitAnalysis"
                :disabled="isLoading"
                :class="['w-full py-4 rounded-xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 btn-medical text-white overflow-hidden relative',
                         isLoading ? 'bg-slate-800 cursor-not-allowed' : (patientStore.isFastPositive ? 'bg-red-600 animate-pulse' : 'bg-blue-700')]">

          <!-- LOADER ANIMATO (Visibile solo se isLoading è true) -->
          <!-- Il div assoluto copre tutto il bottone -->
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-slate-800">
            <div class="w-32"> <!-- Contenitore per dare una dimensione fissa al loader ECG -->
              <EcgLoader color="white" />
            </div>
          </div>

          <!-- TESTO NORMALE (Visibile solo se isLoading è false) -->
          <span v-else>
                    <i class="fa-solid fa-user-doctor"></i> {{ patientStore.isFastPositive ? 'ANALISI URGENTE' : 'Chiedi a Elena' }}
                </span>
        </button>
      </div>
    </div>

    <!-- MODAL RISULTATO -->
    <div v-if="showResultModal" class="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm p-0 sm:p-4">
      <div class="bg-white w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-slide-up">
        <div class="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div class="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">E</div>
            <h3 class="font-bold text-blue-900">Analisi Completata</h3>
          </div>
          <button @click="showResultModal = false" class="text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-xl"></i></button>
        </div>
        <div class="p-5 overflow-y-auto flex-1 prose prose-sm max-w-none text-slate-700 leading-relaxed" v-html="formattedResult"></div>
        <div class="p-4 border-t bg-slate-50 grid grid-cols-2 gap-3">
          <button @click="copyToClipboard" class="py-3 bg-white border rounded-lg font-bold text-slate-700">Copia SBAR</button>
          <button @click="closeAndReset" class="py-3 bg-blue-600 text-white rounded-lg font-bold">Nuovo Pz</button>
        </div>
      </div>
    </div>

  </div>
</template>