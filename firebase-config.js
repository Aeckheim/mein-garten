// ============================================
// 🔥 Firebase Configuration
// ============================================
// HINWEIS: Ersetze die Werte unten mit deiner eigenen Firebase Config!
// Anleitung: https://console.firebase.google.com → Projekteinstellungen → Web-App

const firebaseConfig = {
    apiKey: "DEIN_API_KEY",
    authDomain: "DEIN_PROJEKT.firebaseapp.com",
    projectId: "DEIN_PROJEKT",
    storageBucket: "DEIN_PROJEKT.appspot.com",
    messagingSenderId: "DEINE_ID",
    appId: "DEINE_APP_ID"
};

// Firebase initialisieren
let db = null;
let storage = null;
let firebaseReady = false;

function initFirebase() {
    try {
        if (firebaseConfig.apiKey === "DEIN_API_KEY") {
            console.warn('⚠️ Firebase nicht konfiguriert – nutze localStorage als Fallback');
            firebaseReady = false;
            return false;
        }
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        storage = firebase.storage();

        // Offline-Cache aktivieren
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
            console.warn('Offline-Persistence nicht verfügbar:', err.code);
        });

        firebaseReady = true;
        console.log('🔥 Firebase verbunden!');
        return true;
    } catch (err) {
        console.error('Firebase Fehler:', err);
        firebaseReady = false;
        return false;
    }
}

// ============================================
// 💾 Storage Layer (Firebase oder localStorage Fallback)
// ============================================

const StorageLayer = {
    // --- Plants ---
    async getPlants() {
        if (firebaseReady) {
            const snapshot = await db.collection('plants').orderBy('added_date', 'desc').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        return JSON.parse(localStorage.getItem('garten_plants') || '[]');
    },

    async savePlant(plant) {
        if (firebaseReady) {
            const docRef = await db.collection('plants').add(plant);
            return { id: docRef.id, ...plant };
        }
        const plants = JSON.parse(localStorage.getItem('garten_plants') || '[]');
        plant.id = 'local_' + Date.now();
        plants.push(plant);
        localStorage.setItem('garten_plants', JSON.stringify(plants));
        return plant;
    },

    async updatePlant(id, data) {
        if (firebaseReady) {
            await db.collection('plants').doc(id).update(data);
            return;
        }
        const plants = JSON.parse(localStorage.getItem('garten_plants') || '[]');
        const idx = plants.findIndex(p => p.id === id);
        if (idx !== -1) {
            Object.assign(plants[idx], data);
            localStorage.setItem('garten_plants', JSON.stringify(plants));
        }
    },

    async deletePlant(id) {
        if (firebaseReady) {
            await db.collection('plants').doc(id).delete();
            return;
        }
        const plants = JSON.parse(localStorage.getItem('garten_plants') || '[]');
        const filtered = plants.filter(p => p.id !== id);
        localStorage.setItem('garten_plants', JSON.stringify(filtered));
    },

    // --- Photos ---
    async uploadPhoto(file, plantId) {
        if (firebaseReady) {
            const ref = storage.ref(`plant-photos/${plantId}/${file.name}`);
            await ref.put(file);
            return await ref.getDownloadURL();
        }
        // Fallback: store as base64 data URL
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    },

    // --- General Tasks ---
    async getGeneralTasks() {
        if (firebaseReady) {
            const snapshot = await db.collection('general_tasks').get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        return JSON.parse(localStorage.getItem('garten_general_tasks') || '[]');
    },

    async saveGeneralTask(task) {
        if (firebaseReady) {
            const docRef = await db.collection('general_tasks').add(task);
            return { id: docRef.id, ...task };
        }
        const tasks = JSON.parse(localStorage.getItem('garten_general_tasks') || '[]');
        task.id = 'local_' + Date.now();
        tasks.push(task);
        localStorage.setItem('garten_general_tasks', JSON.stringify(tasks));
        return task;
    }
};
