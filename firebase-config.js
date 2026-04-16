// ============================================
// 🐙 GitHub Storage – Daten im Repo speichern (kostenlos!)
// ============================================
// Nutzt die GitHub Contents API um data.json im Repo zu lesen/schreiben.
// Token wird in localStorage gespeichert (nur auf deinem Gerät).

const GITHUB_OWNER = 'Aeckheim';
const GITHUB_REPO = 'mein-garten';
const GITHUB_BRANCH = 'main';
const DATA_FILE = 'data.json';

const GitHubStorage = {
    token: null,
    fileSha: null,      // SHA des aktuellen data.json (nötig für Updates)
    cache: null,         // Lokaler Cache der Daten
    saveTimeout: null,   // Debounce für Schreibvorgänge

    init() {
        this.token = localStorage.getItem('github_token') || '';
        // Lokalen Cache aus localStorage laden (Offline-Fallback)
        try {
            this.cache = JSON.parse(localStorage.getItem('garten_data') || 'null');
        } catch(e) {
            this.cache = null;
        }
    },

    isConfigured() {
        return !!this.token;
    },

    // --- GitHub API Helpers ---

    async apiRequest(path, options = {}) {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/${path}`;
        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${this.token}`
        };
        if (options.body) headers['Content-Type'] = 'application/json';

        const res = await fetch(url, { ...options, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `GitHub API Error ${res.status}`);
        }
        return res.json();
    },

    // Alle Daten vom Repo laden
    async loadData() {
        if (!this.isConfigured()) {
            return this.getLocalData();
        }

        try {
            const result = await this.apiRequest(`contents/${DATA_FILE}?ref=${GITHUB_BRANCH}`);
            this.fileSha = result.sha;
            const content = atob(result.content.replace(/\n/g, ''));
            // UTF-8 dekodieren
            const decoded = decodeURIComponent(escape(content));
            const remote = JSON.parse(decoded);

            // Mit lokalen Daten mergen (lokale Daten haben Vorrang)
            const local = this.getLocalData();
            const data = {
                plants: this._mergeById(local.plants || [], remote.plants || []),
                general_tasks: this._mergeById(local.general_tasks || [], remote.general_tasks || []),
                wissen: this._mergeById(local.wissen || [], remote.wissen || []),
                wissen_categories: remote.wissen_categories || local.wissen_categories || []
            };

            this.cache = data;
            localStorage.setItem('garten_data', JSON.stringify(data));
            console.log('🐙 Daten von GitHub geladen + mit lokal gemergt');
            return data;
        } catch (err) {
            if (err.message.includes('Not Found') || err.message.includes('404')) {
                // data.json existiert noch nicht – leer starten
                console.log('🐙 Keine data.json im Repo – starte leer');
                this.fileSha = null;
                const empty = { plants: [], general_tasks: [], wissen: [] };
                this.cache = empty;
                localStorage.setItem('garten_data', JSON.stringify(empty));
                return empty;
            }
            console.warn('🐙 GitHub nicht erreichbar, nutze lokalen Cache:', err.message);
            return this.getLocalData();
        }
    },

    // Daten ins Repo schreiben (debounced – wartet 2 Sek nach letzter Änderung)
    async saveData(data) {
        // Immer sofort lokal speichern
        this.cache = data;
        localStorage.setItem('garten_data', JSON.stringify(data));

        if (!this.isConfigured()) return;

        // Debounce: kurz warten falls mehrere Änderungen gleichzeitig kommen
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => this._pushToGitHub(data), 500);
    },

    async _pushToGitHub(data) {
        try {
            // Aktuelle SHA holen (verhindert Konflikte wenn anderes Gerät geschrieben hat)
            try {
                const current = await this.apiRequest(`contents/${DATA_FILE}?ref=${GITHUB_BRANCH}`);
                this.fileSha = current.sha;
            } catch (e) {
                // Datei existiert noch nicht, kein Problem
                this.fileSha = null;
            }

            // UTF-8 korrekt als Base64 kodieren
            const jsonStr = JSON.stringify(data, null, 2);
            const utf8Bytes = unescape(encodeURIComponent(jsonStr));
            const base64 = btoa(utf8Bytes);

            const body = {
                message: '🌿 Garten-Daten aktualisiert',
                content: base64,
                branch: GITHUB_BRANCH
            };
            if (this.fileSha) body.sha = this.fileSha;

            const result = await this.apiRequest(`contents/${DATA_FILE}`, {
                method: 'PUT',
                body: JSON.stringify(body)
            });
            this.fileSha = result.content.sha;
            console.log('🐙 Daten auf GitHub gespeichert');
        } catch (err) {
            console.error('🐙 GitHub Speichern fehlgeschlagen:', err.message);
            // Daten sind trotzdem lokal gesichert
        }
    },

    // Zwei Listen nach 'id' zusammenführen (Deep-Merge für Pflanzen)
    _mergeById(local, remote) {
        const map = new Map();
        // Remote zuerst (Basis)
        for (const item of remote) if (item.id) map.set(item.id, item);
        // Lokale Items: nur hinzufügen wenn remote nicht existiert,
        // oder Arrays (Fotos/Journal/Tasks) zusammenführen
        for (const item of local) {
            if (!item.id) continue;
            if (!map.has(item.id)) {
                // Nur lokal vorhanden → übernehmen
                map.set(item.id, item);
            } else {
                // Existiert beidseitig → Remote als Basis, Arrays mergen
                const remoteItem = map.get(item.id);
                const merged = { ...remoteItem };
                // Fotos zusammenführen (nach date deduplizieren)
                const allPhotos = [...(remoteItem.photos || []), ...(item.photos || [])];
                if (allPhotos.length > 0) {
                    const seen = new Set();
                    merged.photos = allPhotos.filter(p => {
                        const key = p.date || p.data?.substring(0, 50);
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                }
                // Journal zusammenführen (nach id deduplizieren)
                const allJournal = [...(remoteItem.journal || []), ...(item.journal || [])];
                if (allJournal.length > 0) {
                    const seenJ = new Set();
                    merged.journal = allJournal.filter(j => {
                        const key = j.id || j.date;
                        if (seenJ.has(key)) return false;
                        seenJ.add(key);
                        return true;
                    });
                }
                // Custom tasks zusammenführen
                const allTasks = [...(remoteItem.custom_tasks || []), ...(item.custom_tasks || [])];
                if (allTasks.length > 0) {
                    const seenT = new Set();
                    merged.custom_tasks = allTasks.filter(t => {
                        const key = t.id || (t.text + t.due_month);
                        if (seenT.has(key)) return false;
                        seenT.add(key);
                        return true;
                    });
                }
                map.set(item.id, merged);
            }
        }
        return Array.from(map.values());
    },

    getLocalData() {
        if (this.cache) return this.cache;
        // Migration: alte localStorage-Daten übernehmen
        const plants = JSON.parse(localStorage.getItem('garten_plants') || '[]');
        const tasks = JSON.parse(localStorage.getItem('garten_general_tasks') || '[]');
        const wissen = JSON.parse(localStorage.getItem('garten_wissen') || '[]');
        return { plants, general_tasks: tasks, wissen };
    }
};

// ============================================
// 💾 Storage Layer (GitHub API + localStorage Fallback)
// ============================================

const StorageLayer = {
    _data: null,

    async init() {
        GitHubStorage.init();
        this._data = await GitHubStorage.loadData();
        if (!this._data.plants) this._data.plants = [];
        if (!this._data.general_tasks) this._data.general_tasks = [];
        if (!this._data.wissen) this._data.wissen = [];
        if (!this._data.wissen_categories) this._data.wissen_categories = [];

        // Automatisch neu laden wenn Tab/App wieder aktiv wird
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'visible' && GitHubStorage.isConfigured()) {
                console.log('🔄 Tab aktiv – lade Daten von GitHub...');
                await this.refresh();
            }
        });
    },

    // Daten von GitHub neu laden und UI aktualisieren
    async refresh() {
        const remote = await GitHubStorage.loadData();
        if (!remote) return;

        // Merge: alle Pflanzen zusammenführen (nach ID deduplizieren)
        const mergedPlants = this._mergeLists(this._data.plants, remote.plants || [], 'id');
        const mergedWissen = this._mergeLists(this._data.wissen, remote.wissen || [], 'id');
        const mergedTasks = this._mergeLists(this._data.general_tasks, remote.general_tasks || [], 'id');

        this._data.plants = mergedPlants;
        this._data.wissen = mergedWissen;
        this._data.general_tasks = mergedTasks;

        // UI neu rendern wenn vorhanden
        if (typeof renderPlantsGrid === 'function') renderPlantsGrid();
        console.log('🔄 Daten synchronisiert');
    },

    // Deep-Merge über GitHubStorage nutzen
    _mergeLists(local, remote) {
        return GitHubStorage._mergeById(local, remote);
    },

    async _save() {
        await GitHubStorage.saveData(this._data);
    },

    // --- Plants ---
    async getPlants() {
        return this._data.plants;
    },

    async savePlant(plant) {
        plant.id = 'plant_' + Date.now();
        this._data.plants.push(plant);
        await this._save();
        return plant;
    },

    async updatePlant(id, data) {
        const idx = this._data.plants.findIndex(p => p.id === id);
        if (idx !== -1) {
            Object.assign(this._data.plants[idx], data);
            await this._save();
        }
    },

    async deletePlant(id) {
        this._data.plants = this._data.plants.filter(p => p.id !== id);
        await this._save();
    },

    // --- Photos ---
    async uploadPhoto(file, plantId) {
        // Foto als Base64 Data-URL speichern (bleibt in data.json)
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Komprimieren via Canvas
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    const MAX = 600;
                    if (w > MAX || h > MAX) {
                        const scale = MAX / Math.max(w, h);
                        w = Math.round(w * scale);
                        h = Math.round(h * scale);
                    }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    },

    // --- General Tasks ---
    async getGeneralTasks() {
        return this._data.general_tasks;
    },

    async saveGeneralTask(task) {
        task.id = 'task_' + Date.now();
        this._data.general_tasks.push(task);
        await this._save();
        return task;
    },

    // --- Wissen ---
    async getWissen() {
        return this._data.wissen;
    },

    async saveWissen(entry) {
        this._data.wissen.push(entry);
        await this._save();
    },

    async deleteWissen(index) {
        this._data.wissen.splice(index, 1);
        await this._save();
    },

    // --- Wissen Kategorien ---
    getWissenCategories() {
        return this._data.wissen_categories || [];
    },

    async saveWissenCategories(cats) {
        this._data.wissen_categories = cats;
        await this._save();
    }
};
