import { createClient } from '@supabase/supabase-js';

export default {
    // --- GESTIONE CHIAMATE HTTP (Richieste dal Frontend) ---
    async fetch(request, env, ctx) {
        // 1. Configurazione CORS (Permette al frontend di comunicare)
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*", // In produzione puoi restringerlo al dominio .pages.dev
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        // Gestione Preflight request
        if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
        if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

        try {
            const data = await request.json();

            // Inizializzazione Client Supabase (Service Role per poter scrivere nella cache farmaci)
            const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

            const MODEL_NAME = "gemini-2.5-pro"; // Modello veloce ed economico

            // ---------------------------------------------------------
            // MODALITÀ 1: RICERCA FARMACI (Ibrida: DB AIFA + Gemini)
            // ---------------------------------------------------------
            if (data.type === 'drug_search') {
                const query = data.query.trim(); // Mantieni case originale per ricerca, ma AIFA è spesso UPPERCASE
                let aiText = "";
                let dbRecord = null;

                // A. Cerchiamo nel DB AIFA (Supabase) per nome commerciale
                // Usiamo ilike per case-insensitive matching
                const { data: farmaci, error } = await supabase
                    .from('farmaci')
                    .select('*')
                    .ilike('denominazione', `%${query}%`)
                    .limit(1);

                if (farmaci && farmaci.length > 0) {
                    dbRecord = farmaci[0];
                    console.log(`✅ Farmaco trovato nel DB: ${dbRecord.denominazione}`);

                    // B. Cache Hit: Abbiamo già la scheda clinica AI?
                    if (dbRecord.ai_summary) {
                        return new Response(JSON.stringify({ analysis: dbRecord.ai_summary }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
                    }
                }

                // C. Cache Miss o Farmaco non in DB: Chiediamo a Gemini
                const systemInstruction = `
                    Sei un assistente farmacologico esperto per il soccorso sanitario 118.
                    Analizza il farmaco richiesto: "${dbRecord ? dbRecord.denominazione : query}".
                    ${dbRecord ? `(Dati Ufficiali AIFA: Principio Attivo: ${dbRecord.principio_attivo})` : ''}
                    
                    DEVI PRODURRE UN OUTPUT HTML CON QUESTA STRUTTURA ESATTA:
                    1. <b>Principio Attivo & Classe:</b> [Nome], [Classe Farmacologica].
                    2. <b>A cosa serve (Sintesi):</b> [Indicazioni principali].
                    3. <b>⚠️ ALERT PER IL SOCCORRITORE:</b> [Rischi vitali, interazioni critiche, effetti collaterali gravi da monitorare].
                    
                    Sii sintetico, diretto e professionale.
                `;

                // Chiamata Gemini
                const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: "Genera scheda." }] }],
                            systemInstruction: { parts: [{ text: systemInstruction }] }
                        })
                    }
                );

                const geminiJson = await geminiResponse.json();
                aiText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna informazione disponibile.";

                // D. Salvataggio in Cache (Solo se il farmaco esiste ufficialmente nel DB AIFA)
                if (dbRecord) {
                    await supabase
                        .from('farmaci')
                        .update({
                            ai_summary: aiText,
                            ai_updated_at: new Date()
                        })
                        .eq('aic_code', dbRecord.aic_code);
                }

                return new Response(JSON.stringify({ analysis: aiText }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            // ---------------------------------------------------------
            // MODALITÀ 2: ANALISI PAZIENTE (Standard XABCDE)
            // ---------------------------------------------------------

            // System Prompt "Dr.ssa Elena"
            const systemInstruction = `
        Sei la Dr.ssa Elena Vitali, dottoressa digitale per il SUEM 118.
        
        COMPITO: Analisi clinica e assegnazione CODICE COLORE DI RIENTRO (Triage).
        
        CRITERI TRIAGE:
        - ROSSO: Funzioni vitali compromesse (ABCD instabile), Stroke, Infarto, Shock.
        - GIALLO: Stabile ma rischio evolutivo (dolore, dispnea moderata).
        - VERDE: Urgenza differibile, stabile.
        - BIANCO: Non urgente.

        FORMATO OUTPUT (HTML):
        Inizia SEMPRE con: <div style="..." data-ai-triage="[COLORE]">...</div>
        Poi usa <b>Titoli</b>, liste puntate e <br> per a capo.
      `;

            const fastText = (data.fast_face || data.fast_arm || data.fast_speech) ? `POSITIVO (LKW: ${data.fast_time || '?'})` : "Negativo";
            const userPrompt = `
                Paziente: ${data.sesso} ${data.eta}aa.
                AVPU: ${data.avpu}. FAST: ${fastText}.
                Parametri: PA ${data.pa_sys}/${data.pa_dia}, FC ${data.fc}, SpO2 ${data.spo2}, FR ${data.fr}.
                Note: "${data.note}".
                Triage Stimato Soccorritore: ${data.triage || 'N/D'}.
            `;

            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${env.GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemInstruction }] },
                        contents: [{ parts: [{ text: userPrompt }] }]
                    })
                }
            );

            const geminiJson = await geminiResponse.json();

            // Gestione errori e safety filter
            if (!geminiJson.candidates || geminiJson.candidates.length === 0) {
                throw new Error("Risposta bloccata o vuota (Safety Filter?).");
            }

            const aiText = geminiJson.candidates[0].content.parts[0].text;

            // Log su D1 (Scatola Nera) - Per statistiche anonime interne
            try {
                await env.DB.prepare(
                    `INSERT INTO interventi (sesso, eta, avpu, note, suggerimento_ai) VALUES (?, ?, ?, ?, ?)`
                ).bind(data.sesso, data.eta, data.avpu, data.note, aiText).run();
            } catch (e) { console.error("Errore salvataggio D1:", e); }

            return new Response(JSON.stringify({ analysis: aiText }), { headers: { "Content-Type": "application/json", ...corsHeaders } });

        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
        }
    },

    // --- GESTIONE CRON JOB (Aggiornamento AIFA Notturno) ---
    async scheduled(event, env, ctx) {
        console.log("🕒 Cron Job AIFA avviato...");
        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

        try {
            // 1. Scarica il CSV Aggiornato
            console.log(`Scaricamento da: ${env.AIFA_CSV_URL}`);
            const response = await fetch(env.AIFA_CSV_URL);
            if (!response.ok) throw new Error(`Fallito download CSV AIFA: ${response.status}`);

            // Il file AIFA usa encoding ISO-8859-1 (spesso) o UTF-8.
            // `response.text()` prova a decodificare UTF-8. Se ci sono caratteri strani, servirebbe TextDecoder.
            const csvText = await response.text();

            // 2. Parsing (Separatore ';')
            // Struttura attesa: codice_aic;cod_farmaco;cod_confezione;denominazione;...;pa_associati;...
            const rows = csvText.split('\n');
            // La prima riga è l'header, la saltiamo
            const dataRows = rows.slice(1);

            console.log(`Trovate ${dataRows.length} righe. Inizio aggiornamento DB...`);

            const batchSize = 100;
            let batch = [];
            let count = 0;

            for (const row of dataRows) {
                if (!row.trim()) continue; // Salta righe vuote

                const cols = row.split(';');

                // Mappatura colonne basata sullo standard AIFA 'confezioni.csv'
                // 0: codice_aic
                // 3: denominazione
                // 6: ragione_sociale (ditta)
                // 11: pa_associati (principio attivo)

                // Controllo integrità riga minima
                if (cols.length < 12) continue;

                const clean = (txt) => txt ? txt.replace(/"/g, '').trim() : null;

                batch.push({
                    aic_code: clean(cols[0]),
                    denominazione: clean(cols[3]),
                    principio_attivo: clean(cols[11]),
                    ditta: clean(cols[6]),
                    last_updated: new Date() // Timestamp aggiornamento
                });

                // Upsert a pacchetti per performance
                if (batch.length >= batchSize) {
                    const { error } = await supabase.from('farmaci').upsert(batch, { onConflict: 'aic_code' });
                    if (error) console.error("Errore batch:", error.message);
                    else count += batch.length;
                    batch = [];
                }
            }

            // Ultimo pacchetto residuo
            if (batch.length > 0) {
                const { error } = await supabase.from('farmaci').upsert(batch, { onConflict: 'aic_code' });
                if (!error) count += batch.length;
            }

            console.log(`✅ Aggiornamento completato. Processati ${count} farmaci.`);

        } catch (error) {
            console.error("❌ Errore Critico Cron AIFA:", error.message);
        }
    }
};