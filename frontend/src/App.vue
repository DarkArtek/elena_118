<script setup>
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'vue-router';
import { computed } from 'vue';

const authStore = useAuthStore();
const router = useRouter();
const user = computed(() => authStore.user);

const handleLogout = async () => {
  await authStore.signOut();
  router.push('/login');
};
</script>

<template>
  <div class="max-w-md mx-auto min-h-screen bg-white shadow-xl relative flex flex-col">
    <!-- Header -->
    <header v-if="user"
            class="text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow-md select-none"
            style="background-color: #23408e;">
      <div class="flex items-center gap-3">
        <div class="bg-white text-[#23408e] rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl" style="color: #23408e;">
          <font-awesome-icon icon="staff-snake" class="text-2xl" />
        </div>
        <div>
          <h1 class="font-bold text-lg leading-tight">Elena</h1>
          <p class="text-xs opacity-80">Partner Decisionale 118</p>
        </div>
      </div>

      <!-- Navigazione Icone -->
      <nav class="flex gap-5 text-xl items-center">
        <!-- 1. Intervento -->
        <router-link to="/" active-class="opacity-100 scale-110" class="opacity-60 hover:opacity-100 transition transform" title="Nuovo Intervento">
          <font-awesome-icon icon="file-waveform" />
        </router-link>

        <!-- 2. LINK AGGIUNTO: Prontuario Farmaci (DB) -->
        <router-link to="/drugs" active-class="opacity-100 scale-110" class="opacity-60 hover:opacity-100 transition transform" title="Prontuario Farmaci">
          <font-awesome-icon icon="book-medical" />
        </router-link>

        <!-- 3. Storico -->
        <router-link to="/history" active-class="opacity-100 scale-110" class="opacity-60 hover:opacity-100 transition transform" title="Storico">
          <font-awesome-icon icon="notes-medical" />
        </router-link>

        <!-- 4. Logout -->
        <button @click="handleLogout" class="opacity-60 hover:opacity-100 hover:text-red-200 transition ml-2 p-2">
          <font-awesome-icon icon="power-off" /> <!-- Assicurati di aver registrato questa icona in main.js -->
        </button>
      </nav>
    </header>

    <!-- Content Router -->
    <main class="flex-1 bg-slate-50 relative">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Footer info -->
    <footer class="bg-slate-100 p-2 text-center text-[10px] text-slate-400 border-t">
      Solo per uso professionale
    </footer>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>