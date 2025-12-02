import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';

export const usePatientStore = defineStore('patient', () => {
    // Stato reattivo del form
    const form = reactive({
        eta: '',
        sesso: 'M',
        avpu: '',
        fast: {
            face: false,
            arm: false,
            speech: false,
            time: ''
        },
        pa_sys: '',
        pa_dia: '',
        fc: '',
        spo2: '',
        fr: '',
        note: '',
        eo_torace: '',
        toni_aritmici: false
    });

    // Reset del form per nuovo intervento
    const resetForm = () => {
        form.eta = '';
        form.sesso = 'M';
        form.avpu = '';
        form.fast.face = false;
        form.fast.arm = false;
        form.fast.speech = false;
        form.fast.time = '';
        form.pa_sys = '';
        form.pa_dia = '';
        form.fc = '';
        form.spo2 = '';
        form.fr = '';
        form.note = '';
        form.eo_torace = '';
        form.toni_aritmici = false;
    };

    // Computed Properties per UI Logic
    const isFastPositive = computed(() => form.fast.face || form.fast.arm || form.fast.speech);

    const isArrhythmia = computed(() => {
        const val = parseInt(form.fc);
        return !isNaN(val) && (val < 60 || val > 100);
    });

    const isRespiratoryDistress = computed(() => {
        const s = parseInt(form.spo2);
        const f = parseInt(form.fr);
        return (!isNaN(s) && s < 90) || (!isNaN(f) && (f < 12 || f > 25));
    });

    return {
        form,
        resetForm,
        isFastPositive,
        isArrhythmia,
        isRespiratoryDistress
    };
});