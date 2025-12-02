<template>
  <div class="max-w-md mx-auto min-h-screen bg-white shadow-xl relative flex flex-col">
    <!-- Header Comune -->
    <header class="bg-blue-800 text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow-md">
      <div class="flex items-center gap-3">
        <div class="bg-white text-blue-800 rounded-full w-10 h-10 flex items-center justify-center font-bold text-xl">
          E
        </div>
        <div>
          <h1 class="font-bold text-lg leading-tight">Elena</h1>
          <p class="text-xs text-blue-200 opacity-80">Partner Decisionale 118</p>
        </div>
      </div>
      <!-- Navigation Links -->
      <nav class="flex gap-4 text-sm font-medium">
        <router-link to="/" active-class="text-white underline decoration-2 underline-offset-4" class="text-blue-200 hover:text-white transition">
          Intervento
        </router-link>
        <router-link to="/history" active-class="text-white underline decoration-2 underline-offset-4" class="text-blue-200 hover:text-white transition">
          Storico
        </router-link>
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
      For internal use only
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