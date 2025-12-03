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
    <!-- Header Comune con nuovo colore personalizzato -->
    <header v-if="user"
            class="text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow-md select-none"
            style="background-color: #23408e;">
      <div class="flex items-center gap-3">
        <!-- Logo con icona Staff Snake (Bastone di Asclepio) -->
        <div class="bg-white text-[#23408e] rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl" style="color: #23408e;">
          <font-awesome-icon icon="staff-snake" class="text-2xl" />
        </div>
        <div>
          <h1 class="font-bold text-lg leading-tight">Elena</h1>
          <p class="text-xs opacity-80">Partner Decisionale 118</p>
        </div>
      </div>
      <!-- Navigation Links -->
      <nav class="flex gap-4 text-sm font-medium items-center">
        <router-link to="/" active-class="underline decoration-2 underline-offset-4" class="opacity-80 hover:opacity-100 transition">
          Intervento
        </router-link>
        <router-link to="/history" active-class="underline decoration-2 underline-offset-4" class="opacity-80 hover:opacity-100 transition">
          Storico
        </router-link>

        <!-- Logout Button: Aumentato area click per mobile -->
        <button @click="handleLogout" class="p-2 ml-1 text-red-200 hover:text-white hover:bg-white/10 rounded-full transition-colors active:scale-95" title="Logout">
          <i class="fa-solid fa-power-off text-lg"></i>
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
      Gemini 2.5 Pro Model • Cloudflare & Supabase
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