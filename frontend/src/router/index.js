import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import HistoryView from '../views/HistoryView.vue';
import LoginView from '../views/LoginView.vue';
import DrugsView from '../views/DrugsView.vue'; // <-- Importa
import { useAuthStore } from '@/store/authStore';

const routes = [
    { path: '/login', name: 'Login', component: LoginView },
    { path: '/', name: 'Home', component: HomeView, meta: { requiresAuth: true } },
    { path: '/history', name: 'History', component: HistoryView, meta: { requiresAuth: true } },
    { path: '/drugs', name: 'Drugs', component: DrugsView, meta: { requiresAuth: true } } // <-- Nuova Rotta
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore();
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