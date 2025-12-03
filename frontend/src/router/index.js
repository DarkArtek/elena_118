import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import HistoryView from '../views/HistoryView.vue';
import LoginView from '../views/LoginView.vue';
import { useAuthStore } from '@/store/authStore';

const routes = [
    { path: '/login', name: 'Login', component: LoginView },
    { path: '/', name: 'Home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/history', name: 'History', component: HistoryView, meta: { requiresAuth: true } }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

// Navigation Guard
router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();
    // Assicuriamoci che l'auth sia inizializzata
    if (!authStore.user) {
        await authStore.initialize();
    }

    if (to.meta.requiresAuth && !authStore.user) {
        next('/login');
    } else if (to.path === '/login' && authStore.user) {
        next('/');
    } else {
        next();
    }
});

export default router;