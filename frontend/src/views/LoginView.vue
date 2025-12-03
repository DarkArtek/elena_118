<script setup>
import { ref } from 'vue';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'vue-router';
import EcgLoader from '@/components/EcgLoader.vue';

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMsg = ref('');

const authStore = useAuthStore();
const router = useRouter();

const handleSubmit = async () => {
  loading.value = true;
  errorMsg.value = '';

  try {
    // Solo Login consentito
    await authStore.signIn(email.value, password.value);
    router.push('/'); // Vai alla Home
  } catch (e) {
    console.error(e);
    if (e.message.includes('Invalid login')) {
      errorMsg.value = 'Credenziali non valide.';
    } else {
      errorMsg.value = e.message || 'Errore di connessione.';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-slate-100 flex items-center justify-center p-4">
    <div class="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 transition-all">
      <div class="text-center mb-8">
        <!-- LOGO AGGIORNATO -->
        <!-- Sfondo Blu Scuro #23408e, Icona Bianca -->
        <div class="w-20 h-20 bg-[#23408e] text-white rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-4 shadow-lg ring-4 ring-blue-50">
          <font-awesome-icon icon="staff-snake" />
        </div>
        <h1 class="text-2xl font-bold text-slate-800">Elena 118</h1>
        <p class="text-slate-500">
          Accesso Personale Soccorritore
        </p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Email</label>
          <input v-model="email" type="email" required class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#23408e] outline-none" placeholder="soccorritore@cri.it">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-600 mb-1">Password</label>
          <input v-model="password" type="password" required class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#23408e] outline-none" placeholder="••••••••">
        </div>

        <div v-if="errorMsg" class="text-red-500 text-sm text-center bg-red-50 p-2 rounded border border-red-100">
          {{ errorMsg }}
        </div>

        <button type="submit" :disabled="loading" class="w-full bg-[#23408e] hover:bg-blue-800 text-white font-bold py-4 rounded-xl transition-all shadow-md flex justify-center items-center">
          <span v-if="!loading">Accedi</span>
          <div v-else class="w-24"><EcgLoader color="white"/></div>
        </button>
      </form>

      <p class="text-xs text-center text-slate-400 mt-6 pt-4 border-t border-slate-50">
        Sistema di Supporto Decisionale Clinico<br>
        Prototipo v1.0
      </p>
    </div>
  </div>
</template>