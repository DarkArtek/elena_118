<script setup>
defineProps({
  color: {
    type: String,
    default: '#E11D48' // Rosso default, ma puoi passargli 'white' o altro
  }
});
</script>

<template>
  <div class="ecg-loader">
    <div class="heartbeat-line">
      <!-- SVG Larghezza doppia per il loop -->
      <svg width="200" height="40" viewBox="0 0 200 40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <path
              id="ecg-path"
              d="M 0 20 L 30 20 L 35 15 L 40 20 L 42 18 L 45 5 L 48 25 L 50 20 L 55 15 L 60 20 L 100 20"
              fill="none"
              :stroke="color"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
          />
        </defs>
        <!-- Ripetizione del pattern per loop fluido -->
        <use href="#ecg-path" x="0" y="0" />
        <use href="#ecg-path" x="100" y="0" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.ecg-loader {
  display: flex;
  justify-content: center;
  align-items: center;
  /* Rimosso height fissa per renderlo adattabile al contenitore padre */
  width: 100%;
  padding: 10px 0;
}

.heartbeat-line {
  width: 100px; /* Finestra visibile */
  height: 40px;
  overflow: hidden;
  position: relative;
  /* Maschera sfumata ai lati per effetto elegante */
  mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
  /* Fix per linter: usa la sintassi webkit legacy (start point 'left' invece di destination 'to right') */
  -webkit-mask-image: -webkit-linear-gradient(left, transparent, black 10%, black 90%, transparent);
}

.heartbeat-line svg {
  position: absolute;
  top: 0;
  left: 0;
  width: 200px;
  height: 40px;
  animation: ecg-scroll 1.2s infinite linear;
}

@keyframes ecg-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100px); }
}
</style>