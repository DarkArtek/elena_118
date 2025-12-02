DROP TABLE IF EXISTS interventi;

CREATE TABLE interventi (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Anagrafica
                            sesso TEXT,
                            eta INTEGER,

    -- Neuro
                            avpu TEXT,
                            fast_summary TEXT, -- Es. "POSITIVO: Braccio. LKW: 14:00"

    -- Parametri
                            pressione_sistolica INTEGER,
                            pressione_diastolica INTEGER,
                            frequenza_cardiaca INTEGER,
                            saturazione INTEGER,
                            respiri_minuto INTEGER,

    -- Clinica aggiuntiva
                            eo_torace TEXT, -- Es. "Rumori Umidi"
                            note TEXT,

    -- Output AI
                            suggerimento_ai TEXT
);