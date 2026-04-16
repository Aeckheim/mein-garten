// ============================================
// 🌱 Mein Garten – Hauptlogik
// ============================================

let plants = [];
let generalTasks = [];
let plantDatabase = [];
let tipsData = {};
let currentPlantId = null;
let pendingPhotoFile = null;
let pendingPhotoBase64 = null;
let selectedDbPlant = null;

// ============================================
// 🚀 Initialisierung
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Token aus URL übernehmen (z.B. ?token=ghp_xxx)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
        localStorage.setItem('github_token', urlToken);
        // Token aus URL entfernen (Sicherheit)
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Storage initialisieren (GitHub API + localStorage Fallback)
    await StorageLayer.init();

    // Daten laden
    await Promise.all([
        loadPlantDatabase(),
        loadTipsData(),
        loadPlants(),
        loadGeneralTasks()
    ]);

    // UI rendern
    renderPlantsGrid();
    checkFirstRun();

    // Drag & Drop für Upload
    setupDragDrop();
});

// ============================================
// 📦 Daten laden
// ============================================

async function loadPlantDatabase() {
    try {
        const res = await fetch('plant-database.json');
        const data = await res.json();
        plantDatabase = data.plants || [];
        console.log(`🌿 ${plantDatabase.length} Pflanzen in der Datenbank geladen`);
    } catch (err) {
        console.warn('plant-database.json nicht gefunden:', err);
        plantDatabase = [];
    }
}

async function loadTipsData() {
    try {
        const res = await fetch('tips.json');
        tipsData = await res.json();
        console.log('💡 Tipps geladen');
    } catch (err) {
        console.warn('tips.json nicht gefunden:', err);
        tipsData = {};
    }
}

async function loadPlants() {
    try {
        plants = await StorageLayer.getPlants();
        console.log(`🌱 ${plants.length} Pflanzen geladen`);
    } catch (err) {
        console.error('Fehler beim Laden der Pflanzen:', err);
        plants = [];
    }
}

async function loadGeneralTasks() {
    try {
        generalTasks = await StorageLayer.getGeneralTasks();
    } catch (err) {
        console.error('Fehler beim Laden der Aufgaben:', err);
        generalTasks = [];
    }
}

// ============================================
// 🧭 Navigation
// ============================================

function navigate(section) {
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const sectionEl = document.getElementById(`section-${section}`);
    if (sectionEl) {
        sectionEl.classList.add('active');
    }

    const navBtn = document.querySelector(`.nav-btn[data-section="${section}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
    }

    // Section-spezifisches Rendering
    if (section === 'kalender') {
        refreshCalendar();
    } else if (section === 'tipps') {
        renderTips();
    } else if (section === 'garten') {
        renderPlantsGrid();
    } else if (section === 'wissen') {
        renderWissen();
    }
}

function refreshCalendar() {
    renderCalendar(plants, generalTasks, tipsData);
}

// ============================================
// 🌿 Pflanzen-Grid
// ============================================

function renderPlantsGrid() {
    const grid = document.getElementById('plants-grid');
    const empty = document.getElementById('empty-garden');

    if (plants.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    grid.style.display = 'grid';
    empty.style.display = 'none';

    grid.innerHTML = plants.map(plant => {
        const nextTask = getNextTask(plant);
        const statusClass = `status-${plant.status || 'gesund'}`;
        const statusText = {
            'gesund': '🟢 Gesund',
            'achtung': '🟡 Aufmerksamkeit',
            'krank': '🔴 Krank',
            'ruhend': '🌙 Ruhend'
        }[plant.status] || '🟢 Gesund';

        return `
            <div class="plant-card" onclick="showPlantDetail('${plant.id}')">
                <div class="plant-card-image">
                    ${plant.photo_url
                        ? `<img src="${plant.photo_url}" alt="${plant.name}" loading="lazy">`
                        : (plant.emoji || '🌿')}
                </div>
                <div class="plant-card-body">
                    <div class="plant-card-name">${plant.emoji || ''} ${plant.name}</div>
                    <div class="plant-card-species">${plant.species || ''}</div>
                    <div class="plant-card-status ${statusClass}">${statusText}</div>
                    ${nextTask ? `
                    <div class="plant-card-next">
                        <strong>📌 Als nächstes</strong>
                        ${nextTask.text} (${nextTask.monthName})
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function getNextTask(plant) {
    if (!plant.care_plan) return null;

    const now = new Date();
    const currentMonthIdx = now.getMonth();

    // Ab aktuellem Monat suchen, dann im nächsten Jahr
    for (let i = 0; i < 12; i++) {
        const idx = (currentMonthIdx + i) % 12;
        const key = MONTH_KEYS[idx];
        const tasks = plant.care_plan[key];
        if (tasks && tasks.length > 0) {
            return {
                text: tasks[0],
                monthKey: key,
                monthName: MONTH_NAMES[idx]
            };
        }
    }
    return null;
}

// ============================================
// 🔍 Pflanzen-Detail
// ============================================

async function showPlantDetail(plantId) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;

    // Wissen laden falls noch nicht geschehen
    if (wissenEntries.length === 0) await loadWissen();

    currentPlantId = plantId;
    const currentMonthKey = getCurrentMonthKey();
    const container = document.getElementById('plant-detail');

    // Quick Info aus der Datenbank holen
    const dbPlant = findInDatabase(plant.species || plant.name);
    const quickInfo = plant.quick_info || dbPlant?.quick_info;
    const photos = plant.photos || [];
    const journal = plant.journal || [];

    container.innerHTML = `
        <div class="detail-header">
            ${plant.photo_url
                ? `<img class="detail-photo" src="${plant.photo_url}" alt="${plant.name}">`
                : `<div class="detail-photo-placeholder">${plant.emoji || '🌿'}</div>`
            }
            <div class="detail-info">
                <h1 class="detail-name">${plant.emoji || '🌿'} ${plant.name}</h1>
                <p class="detail-species">${plant.species || ''}</p>
                <div class="detail-meta">
                    <span class="detail-meta-item plant-card-status status-${plant.status || 'gesund'}">
                        ${{
                            'gesund': '🟢 Gesund',
                            'achtung': '🟡 Aufmerksamkeit',
                            'krank': '🔴 Krank',
                            'ruhend': '🌙 Ruhend'
                        }[plant.status] || '🟢 Gesund'}
                    </span>
                    ${plant.location ? `<span class="detail-meta-item">📍 ${plant.location}</span>` : ''}
                    ${plant.added_date ? `<span class="detail-meta-item">📅 ${new Date(plant.added_date).toLocaleDateString('de-DE')}</span>` : ''}
                </div>
                ${quickInfo ? `
                <div class="detail-quick-info">
                    ${quickInfo.sonne ? `<div class="quick-info-item"><strong>☀️ Sonne</strong>${quickInfo.sonne}</div>` : ''}
                    ${quickInfo.wasser ? `<div class="quick-info-item"><strong>💧 Wasser</strong>${quickInfo.wasser}</div>` : ''}
                    ${quickInfo.boden ? `<div class="quick-info-item"><strong>🌍 Boden</strong>${quickInfo.boden}</div>` : ''}
                    ${quickInfo.abstand ? `<div class="quick-info-item"><strong>📏 Abstand</strong>${quickInfo.abstand}</div>` : ''}
                </div>
                ` : ''}
                ${plant.wiki_description ? `<p class="detail-wiki-desc">${plant.wiki_description.substring(0, 300)}${plant.wiki_description.length > 300 ? '...' : ''}</p>` : ''}
                <div class="detail-actions">
                    <select onchange="updatePlantStatus('${plant.id}', this.value)" style="padding: 8px 12px; border-radius: 20px; border: 2px solid var(--green-pale); font-family: Nunito; font-weight: 700;">
                        <option value="gesund" ${plant.status === 'gesund' ? 'selected' : ''}>🟢 Gesund</option>
                        <option value="achtung" ${plant.status === 'achtung' ? 'selected' : ''}>🟡 Aufmerksamkeit</option>
                        <option value="krank" ${plant.status === 'krank' ? 'selected' : ''}>🔴 Krank</option>
                        <option value="ruhend" ${plant.status === 'ruhend' ? 'selected' : ''}>🌙 Ruhend</option>
                    </select>
                    <button class="btn-danger btn-small" onclick="deletePlant('${plant.id}')">🗑️ Löschen</button>
                </div>
            </div>
        </div>

        <!-- 📸 Fotogalerie -->
        <div class="detail-section">
            <div class="detail-section-header">
                <h2>📸 Fotos (${photos.length})</h2>
                <button class="btn-secondary btn-small" onclick="openPlantCamera('${plant.id}')">📷</button>
                <label class="btn-secondary btn-small" style="cursor:pointer;">
                    🖼️ +
                    <input type="file" accept="image/*" multiple
                           onchange="addPhotosToPlant('${plant.id}', event)" style="display:none;">
                </label>
            </div>
            <div class="photo-gallery">
                ${photos.length > 0 ? photos.map((p, i) => `
                    <div class="gallery-item">
                        <img src="${p.data}" alt="Foto ${i+1}" onclick="openPhotoViewer('${plant.id}', ${i})">
                        <span class="gallery-date">${new Date(p.date).toLocaleDateString('de-DE')}</span>
                        <button class="gallery-remove" onclick="removePhoto('${plant.id}', ${i})">✕</button>
                    </div>
                `).join('') : '<p style="color:var(--text-medium); font-style:italic; grid-column:1/-1;">Noch keine Fotos. Füge welche hinzu!</p>'}
            </div>
        </div>

        <!-- 📝 Tagebuch -->
        <div class="detail-section">
            <div class="detail-section-header">
                <h2>📝 Tagebuch</h2>
                <button class="btn-secondary btn-small" onclick="toggleJournalForm('${plant.id}')">➕ Eintrag</button>
            </div>
            <div id="journal-form-${plant.id}" class="journal-form" style="display:none;">
                <textarea id="journal-text-${plant.id}" placeholder="Was hast du gemacht? Was fällt dir auf?" rows="3"></textarea>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px;">
                    <button class="btn-secondary btn-small" onclick="openJournalCamera('${plant.id}')">📷</button>
                    <label class="btn-secondary btn-small" style="cursor:pointer;">
                        🖼️
                        <input type="file" accept="image/*" id="journal-photo-${plant.id}" style="display:none;">
                    </label>
                    <span id="journal-photo-name-${plant.id}" style="font-size:12px; color:var(--text-medium);"></span>
                    <button class="btn-primary btn-small" onclick="saveJournalEntry('${plant.id}')" style="margin-left:auto;">💾 Speichern</button>
                </div>
            </div>
            <div class="journal-entries">
                ${journal.length > 0 ? journal.slice().reverse().map((entry, i) => {
                    const realIdx = journal.length - 1 - i;
                    return `
                    <div class="journal-entry">
                        <div class="journal-entry-header">
                            <span class="journal-date">📅 ${new Date(entry.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <div class="journal-actions">
                                ${realIdx < journal.length - 1 ? `<button class="journal-move-btn" onclick="moveJournalEntry('${plant.id}', ${realIdx}, 1); event.stopPropagation();" title="Nach oben">▲</button>` : ''}
                                ${realIdx > 0 ? `<button class="journal-move-btn" onclick="moveJournalEntry('${plant.id}', ${realIdx}, -1); event.stopPropagation();" title="Nach unten">▼</button>` : ''}
                                <button class="gallery-remove" onclick="deleteJournalEntry('${plant.id}', ${realIdx})">✕</button>
                            </div>
                        </div>
                        <p class="journal-text">${entry.text}</p>
                        ${entry.photo ? `<img class="journal-photo" src="${entry.photo}" alt="Foto">` : ''}
                    </div>`;
                }).join('') : '<p style="color:var(--text-medium); font-style:italic;">Noch keine Einträge. Dokumentiere deinen Garten!</p>'}
            </div>
        </div>

        <!-- Jahres-Pflegeplan -->
        <div class="detail-section">
            <h2>📋 Jahres-Pflegeplan</h2>
            <div class="year-plan-grid">
                ${MONTH_KEYS.map((key, idx) => {
                    const tasks = plant.care_plan?.[key] || [];
                    const isCurrent = key === currentMonthKey;
                    return `
                        <div class="month-card ${isCurrent ? 'current-month' : ''}">
                            <div class="month-name">${MONTH_EMOJIS[idx]} ${MONTH_NAMES[idx]}</div>
                            ${tasks.length > 0
                                ? tasks.map(t => `<div class="month-task">${t}</div>`).join('')
                                : '<div class="month-empty">Keine Aufgaben</div>'
                            }
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <!-- Verknüpftes Wissen -->
        <div class="detail-section" id="linked-wissen-section-${plant.id}">
            <div class="detail-section-header">
                <h2>📖 Verknüpftes Wissen</h2>
                <button class="btn-secondary btn-small" onclick="openAddWissenToPlant('${plant.id}')">➕ Wissen verknüpfen</button>
            </div>
            ${renderLinkedWissen(plant)}
        </div>

        <!-- Anstehende Aufgaben -->
        <div class="detail-section">
            <h2>📌 Anstehende Aufgaben</h2>
            <button class="btn-secondary btn-small" onclick="openAddTaskDialog('${plant.id}')" style="margin-bottom: 16px;">
                ➕ Eigene Aufgabe hinzufügen
            </button>
            ${renderUpcomingTasks(plant)}
        </div>
    `;

    // Journal-Foto Listener
    const journalPhotoInput = document.getElementById(`journal-photo-${plant.id}`);
    if (journalPhotoInput) {
        journalPhotoInput.addEventListener('change', (e) => {
            const name = e.target.files[0]?.name || '';
            document.getElementById(`journal-photo-name-${plant.id}`).textContent = name;
        });
    }

    navigate('detail');
}

// ============================================
// 📸 Foto-Funktionen
// ============================================

async function addPhotosToPlant(plantId, event) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;
    if (!plant.photos) plant.photos = [];

    const files = Array.from(event.target.files);
    for (const file of files) {
        const base64 = await compressPhoto(file);
        plant.photos.push({ data: base64, date: new Date().toISOString() });
    }

    // Erstes Foto auch als Hauptfoto setzen wenn noch keins da
    if (!plant.photo_url && plant.photos.length > 0) {
        plant.photo_url = plant.photos[0].data;
    }

    await StorageLayer.updatePlant(plantId, { photos: plant.photos, photo_url: plant.photo_url });
    showPlantDetail(plantId);
    showToast(`📸 ${files.length} Foto(s) hinzugefügt!`, 'success');
}

async function removePhoto(plantId, index) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant || !plant.photos) return;

    plant.photos.splice(index, 1);
    if (plant.photos.length > 0) {
        plant.photo_url = plant.photos[0].data;
    } else {
        plant.photo_url = null;
    }

    await StorageLayer.updatePlant(plantId, { photos: plant.photos, photo_url: plant.photo_url });
    showPlantDetail(plantId);
}

function openPhotoViewer(plantId, index) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant?.photos?.[index]) return;

    const overlay = document.createElement('div');
    overlay.className = 'photo-viewer-overlay';
    overlay.innerHTML = `<img src="${plant.photos[index].data}" alt="Foto">`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

// ============================================
// 📷 Kamera-Funktion (getUserMedia)
// ============================================

function openCamera(callback) {
    // Overlay erstellen
    const overlay = document.createElement('div');
    overlay.className = 'camera-overlay';
    overlay.innerHTML = `
        <div class="camera-container">
            <video autoplay playsinline></video>
            <div class="camera-controls">
                <button class="camera-btn camera-cancel" onclick="this.closest('.camera-overlay').remove()">✕</button>
                <button class="camera-btn camera-shutter" id="camera-shutter">📸</button>
                <button class="camera-btn camera-flip" id="camera-flip">🔄</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const video = overlay.querySelector('video');
    let facingMode = 'environment'; // Rückkamera
    let stream = null;

    async function startStream() {
        if (stream) stream.getTracks().forEach(t => t.stop());
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } }
            });
            video.srcObject = stream;
        } catch (err) {
            console.error('Kamera-Fehler:', err);
            showToast('❌ Kamera nicht verfügbar. Bitte Berechtigung erteilen.', 'error');
            overlay.remove();
        }
    }

    startStream();

    // Kamera wechseln
    overlay.querySelector('#camera-flip').addEventListener('click', () => {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        startStream();
    });

    // Foto aufnehmen
    overlay.querySelector('#camera-shutter').addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Stream stoppen und Overlay schließen
        if (stream) stream.getTracks().forEach(t => t.stop());
        overlay.remove();

        callback(dataUrl);
    });

    // Overlay schließen stoppt auch Stream
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            if (stream) stream.getTracks().forEach(t => t.stop());
            overlay.remove();
        }
    });
}

// Kamera für "Pflanze erstellen" Dialog
function openCreateCamera() {
    openCamera(async (dataUrl) => {
        if (!window._createPhotos) window._createPhotos = [];
        const compressed = await compressPhoto(dataURLtoFile(dataUrl, 'camera.jpg'));
        window._createPhotos.push(compressed);
        updateCreatePhotoPreview();
    });
}

// Kamera für bestehende Pflanze
function openPlantCamera(plantId) {
    openCamera(async (dataUrl) => {
        const plant = plants.find(p => p.id === plantId);
        if (!plant) return;
        if (!plant.photos) plant.photos = [];

        const compressed = await compressPhoto(dataURLtoFile(dataUrl, 'camera.jpg'));
        plant.photos.push({ data: compressed, date: new Date().toISOString() });

        if (!plant.photo_url) plant.photo_url = plant.photos[0].data;
        await StorageLayer.updatePlant(plantId, { photos: plant.photos, photo_url: plant.photo_url });
        showPlantDetail(plantId);
        showToast('📸 Foto aufgenommen!', 'success');
    });
}

// Kamera für Tagebuch
function openJournalCamera(plantId) {
    openCamera((dataUrl) => {
        // Foto in ein verstecktes Input-ähnliches Feld speichern
        window._journalCameraPhoto = dataUrl;
        const nameSpan = document.getElementById(`journal-photo-name-${plantId}`);
        if (nameSpan) nameSpan.textContent = '📷 Kamera-Foto';
    });
}

// Helper: DataURL → File
function dataURLtoFile(dataUrl, filename) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
}

// Preview für "Pflanze erstellen" aktualisieren
function updateCreatePhotoPreview() {
    const preview = document.getElementById('create-photo-preview');
    if (!preview || !window._createPhotos) return;
    preview.innerHTML = window._createPhotos.map((src, i) => `
        <div class="photo-thumb">
            <img src="${src}" alt="Foto ${i+1}">
            <button onclick="window._createPhotos.splice(${i},1); updateCreatePhotoPreview();">✕</button>
        </div>
    `).join('');
}

// ============================================
// 📝 Tagebuch-Funktionen
// ============================================

function toggleJournalForm(plantId) {
    const form = document.getElementById(`journal-form-${plantId}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function saveJournalEntry(plantId) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;

    const text = document.getElementById(`journal-text-${plantId}`).value.trim();
    if (!text) { showToast('❌ Bitte schreib etwas!', 'error'); return; }

    const photoInput = document.getElementById(`journal-photo-${plantId}`);
    let photo = null;
    if (window._journalCameraPhoto) {
        photo = await compressPhoto(dataURLtoFile(window._journalCameraPhoto, 'camera.jpg'));
        window._journalCameraPhoto = null;
    } else if (photoInput?.files[0]) {
        photo = await compressPhoto(photoInput.files[0]);
    }

    if (!plant.journal) plant.journal = [];
    plant.journal.push({
        id: 'j_' + Date.now(),
        date: new Date().toISOString(),
        text,
        photo
    });

    await StorageLayer.updatePlant(plantId, { journal: plant.journal });
    showPlantDetail(plantId);
    showToast('📝 Eintrag gespeichert!', 'success');
}

async function deleteJournalEntry(plantId, index) {
    if (!confirm('Eintrag löschen?')) return;
    const plant = plants.find(p => p.id === plantId);
    if (!plant?.journal) return;

    plant.journal.splice(index, 1);
    await StorageLayer.updatePlant(plantId, { journal: plant.journal });
    showPlantDetail(plantId);
}

async function moveJournalEntry(plantId, index, direction) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant?.journal) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= plant.journal.length) return;

    // Swap
    const temp = plant.journal[index];
    plant.journal[index] = plant.journal[newIndex];
    plant.journal[newIndex] = temp;

    await StorageLayer.updatePlant(plantId, { journal: plant.journal });
    showPlantDetail(plantId);
}

function renderUpcomingTasks(plant) {
    const currentMonthIdx = new Date().getMonth();
    const tasks = [];

    // Care Plan Aufgaben (nächste 6 Monate)
    for (let i = 0; i < 6; i++) {
        const idx = (currentMonthIdx + i) % 12;
        const key = MONTH_KEYS[idx];
        const monthTasks = plant.care_plan?.[key] || [];
        monthTasks.forEach(t => {
            tasks.push({
                text: t,
                month: MONTH_NAMES[idx],
                monthKey: key,
                isCurrent: i === 0,
                isCustom: false
            });
        });
    }

    // Custom Tasks
    (plant.custom_tasks || []).forEach(ct => {
        const monthIdx = MONTH_KEYS.indexOf(ct.due_month);
        tasks.push({
            text: ct.text,
            month: MONTH_NAMES[monthIdx],
            monthKey: ct.due_month,
            isCurrent: ct.due_month === getCurrentMonthKey(),
            isCustom: true,
            done: ct.done
        });
    });

    if (tasks.length === 0) {
        return '<p style="color: var(--text-medium); font-style: italic;">Keine anstehenden Aufgaben</p>';
    }

    return tasks.map(t => `
        <div class="task-item ${t.isCurrent ? 'task-current' : ''} ${t.done ? 'task-done' : ''}">
            ${t.isCustom ? `
                <div class="task-checkbox ${t.done ? 'checked' : ''}"
                     onclick="toggleCustomTask('${currentPlantId}', '${t.text}'); event.stopPropagation();">
                    ${t.done ? '✓' : ''}
                </div>
            ` : '<span style="font-size: 18px;">📋</span>'}
            <span>${t.text}</span>
            <span class="task-month-badge">${t.month}</span>
        </div>
    `).join('');
}

// ============================================
// 📸 Foto-Upload & Pflanzenerkennung
// ============================================

function openAddPlantDialog() {
    const apiKey = PlantNetAPI.getApiKey();
    if (!apiKey) {
        showToast('⚙️ Bitte zuerst Pl@ntNet API-Key in den Einstellungen eintragen!', 'error');
        openSettings();
        return;
    }
    resetAddPlant();
    openModal('modal-add-plant');
}

function resetAddPlant() {
    pendingPhotoFile = null;
    pendingPhotoBase64 = null;
    document.getElementById('add-plant-step1').style.display = 'block';
    document.getElementById('add-plant-step2').style.display = 'none';
    document.getElementById('add-plant-step3').style.display = 'none';
    document.getElementById('photo-preview').style.display = 'none';
    const input = document.getElementById('plant-photo-input');
    if (input) input.value = '';
}

async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    pendingPhotoFile = file;
    pendingPhotoBase64 = await PlantNetAPI.fileToBase64(file);

    const preview = document.getElementById('photo-preview');
    const img = document.getElementById('preview-image');
    img.src = pendingPhotoBase64;
    preview.style.display = 'block';
}

async function analyzePlant() {
    if (!pendingPhotoFile) return;

    // Schritt 2: Loading
    document.getElementById('add-plant-step1').style.display = 'none';
    document.getElementById('add-plant-step2').style.display = 'block';

    try {
        const result = await PlantNetAPI.identify(pendingPhotoFile);

        // Schritt 3: Ergebnis
        document.getElementById('add-plant-step2').style.display = 'none';
        document.getElementById('add-plant-step3').style.display = 'block';

        document.getElementById('result-image').src = pendingPhotoBase64;
        document.getElementById('plant-name').value = result.name_de;
        document.getElementById('plant-species').value = result.name_lat;

        // Confidence Bar
        const confBar = document.getElementById('confidence-bar');
        const confColor = result.confidence > 70 ? 'var(--green-mid)' :
                          result.confidence > 40 ? 'var(--orange-warm)' : 'var(--red-soft)';
        confBar.innerHTML = `<div class="confidence-bar-fill" style="width: ${result.confidence}%; background: ${confColor};"></div>`;
        confBar.title = `${result.confidence}% Konfidenz`;

        // Pflanze in der Datenbank suchen
        const dbMatch = findInDatabase(result.name_lat) || findInDatabase(result.name_de);
        if (dbMatch) {
            selectedDbPlant = dbMatch;
            showToast(`✨ "${dbMatch.name_de}" in der Datenbank gefunden – Pflegeplan wird übernommen!`, 'success');
        } else {
            selectedDbPlant = null;
        }

    } catch (err) {
        document.getElementById('add-plant-step2').style.display = 'none';
        document.getElementById('add-plant-step1').style.display = 'block';

        if (err.message === 'NO_API_KEY') {
            showToast('⚙️ Bitte Pl@ntNet API-Key in den Einstellungen eintragen!', 'error');
            openSettings();
        } else if (err.message === 'INVALID_API_KEY') {
            showToast('❌ Ungültiger API-Key! Bitte in den Einstellungen prüfen.', 'error');
        } else if (err.message === 'RATE_LIMIT') {
            showToast('⏳ Zu viele Anfragen – bitte warte kurz.', 'error');
        } else if (err.message === 'NOT_RECOGNIZED') {
            showToast('🤔 Pflanze nicht erkannt. Versuche ein anderes Foto oder füge sie manuell hinzu.', 'error');
        } else {
            showToast('❌ Fehler bei der Erkennung: ' + err.message, 'error');
        }
    }
}

let _savingPlant = false;
async function savePlant() {
    if (_savingPlant) return;
    _savingPlant = true;
    const name = document.getElementById('plant-name').value.trim();
    const species = document.getElementById('plant-species').value.trim();
    const location = document.getElementById('plant-location').value.trim();
    const status = document.getElementById('plant-status').value;

    if (!name) {
        showToast('❌ Bitte gib einen Namen ein!', 'error');
        return;
    }

    // Pflegeplan aus Datenbank oder leer
    const carePlan = selectedDbPlant?.care_plan || generateEmptyCarePlan();
    const quickInfo = selectedDbPlant?.quick_info || null;
    const emoji = selectedDbPlant?.emoji || '🌿';

    // Foto hochladen
    let photoUrl = pendingPhotoBase64; // Default: base64
    try {
        if (pendingPhotoFile && firebaseReady) {
            const tempId = 'plant_' + Date.now();
            photoUrl = await StorageLayer.uploadPhoto(pendingPhotoFile, tempId);
        }
    } catch (err) {
        console.warn('Foto-Upload fehlgeschlagen, nutze Base64:', err);
    }

    const plant = {
        name,
        species,
        location,
        status,
        emoji,
        photo_url: photoUrl,
        care_plan: carePlan,
        quick_info: quickInfo,
        custom_tasks: [],
        added_date: new Date().toISOString()
    };

    await StorageLayer.savePlant(plant);
    _savingPlant = false;

    closeModal('modal-add-plant');
    renderPlantsGrid();
    showToast(`🌱 "${name}" wurde zu deinem Garten hinzugefügt!`, 'success');
}

// ============================================
// ➕ Pflanze anlegen (neuer Flow)
// ============================================

let createPhotos = []; // temporäre Fotos beim Anlegen
let createWikiInfo = null; // Wikipedia-Infos der gewählten Pflanze

function openManualAddDialog() {
    createPhotos = [];
    createWikiInfo = null;
    document.getElementById('create-step1').style.display = 'block';
    document.getElementById('create-step2').style.display = 'none';
    document.getElementById('create-plant-name').value = '';
    document.getElementById('create-suggestions').innerHTML = '';
    document.getElementById('create-loading').style.display = 'none';
    openModal('modal-manual-add');
}

async function startPlantSearch() {
    const query = document.getElementById('create-plant-name').value.trim();
    if (!query) return;

    document.getElementById('create-loading').style.display = 'block';
    document.getElementById('create-suggestions').innerHTML = '';

    // Erst in lokaler Datenbank suchen
    const q = query.toLowerCase();
    const dbMatches = plantDatabase.filter(p =>
        p.name_de.toLowerCase().includes(q) ||
        p.name_lat.toLowerCase().includes(q)
    ).slice(0, 3);

    // Dann Wikipedia suchen
    let wikiResults = [];
    try {
        wikiResults = await WikipediaAPI.search(query);
    } catch (e) {
        console.warn('Wikipedia-Suche fehlgeschlagen:', e);
    }

    document.getElementById('create-loading').style.display = 'none';

    let html = '';

    // Datenbank-Treffer
    if (dbMatches.length > 0) {
        html += '<p style="font-size:12px; color:var(--text-medium); margin:8px 0 4px;">📚 Aus der Datenbank:</p>';
        dbMatches.forEach(p => {
            html += `
                <div class="plant-db-item" onclick="selectCreatePlant('db', '${p.id}')">
                    <span class="plant-db-item-emoji">${p.emoji}</span>
                    <div>
                        <div class="plant-db-item-name">${p.name_de}</div>
                        <div class="plant-db-item-latin">${p.name_lat}</div>
                    </div>
                </div>`;
        });
    }

    // Wikipedia-Treffer
    if (wikiResults.length > 0) {
        window._wikiResults = wikiResults;
        html += '<p style="font-size:12px; color:var(--text-medium); margin:12px 0 4px;">🌍 Von Wikipedia:</p>';
        wikiResults.forEach((r, i) => {
            html += `
                <div class="plant-db-item" onclick="selectCreatePlant('wiki', ${i})">
                    <span class="plant-db-item-emoji">🌿</span>
                    <div>
                        <div class="plant-db-item-name">${r.title.replace(/</g, '&lt;')}</div>
                        <div class="plant-db-item-latin">${(r.description || '').replace(/</g, '&lt;')}</div>
                    </div>
                </div>`;
        });
    }

    // Freie Eingabe immer anbieten
    html += `
        <div class="plant-db-item" onclick="selectCreatePlant('free', '${query.replace(/'/g, "\\'")}')">
            <span class="plant-db-item-emoji">✏️</span>
            <div>
                <div class="plant-db-item-name">"${query}" einfach anlegen</div>
                <div class="plant-db-item-latin">Ohne automatische Infos</div>
            </div>
        </div>`;

    document.getElementById('create-suggestions').innerHTML = html;
}

async function selectCreatePlant(type, idOrIndex) {
    createWikiInfo = null;

    if (type === 'db') {
        const dbPlant = plantDatabase.find(p => p.id === idOrIndex);
        if (!dbPlant) return;
        createWikiInfo = {
            source: 'db',
            name: dbPlant.name_de,
            species: dbPlant.name_lat,
            emoji: dbPlant.emoji,
            category: dbPlant.category,
            care_plan: dbPlant.care_plan,
            quick_info: dbPlant.quick_info,
            description: ''
        };
        goToStep2(dbPlant.name_de, dbPlant.category);

    } else if (type === 'wiki') {
        const result = window._wikiResults?.[idOrIndex];
        if (!result) return;

        document.getElementById('create-loading').style.display = 'block';
        try {
            const info = await WikipediaAPI.getPlantInfo(result.title);
            const guessedCat = WikipediaAPI.guessCategory((info.description || '') + ' ' + (info.taxonomy?.familie || ''));

            createWikiInfo = {
                source: 'wiki',
                name: info.title,
                species: info.taxonomy?.wissenschaftlich || '',
                emoji: getCategoryEmoji(guessedCat),
                category: guessedCat,
                care_plan: WikipediaAPI.generateBioCarePlan(guessedCat),
                quick_info: null,
                description: info.description || '',
                image_url: info.image_url,
                taxonomy: info.taxonomy,
                bio_tips: WikipediaAPI.getBioTips(guessedCat)
            };

            document.getElementById('create-loading').style.display = 'none';
            goToStep2(info.title, guessedCat);
        } catch (err) {
            document.getElementById('create-loading').style.display = 'none';
            showToast('❌ Konnte Details nicht laden', 'error');
        }

    } else if (type === 'free') {
        createWikiInfo = {
            source: 'free',
            name: idOrIndex,
            species: '',
            emoji: '🌱',
            category: 'sonstige',
            care_plan: generateEmptyCarePlan(),
            quick_info: null,
            description: ''
        };
        goToStep2(idOrIndex, 'sonstige');
    }
}

function goToStep2(name, category) {
    document.getElementById('create-step1').style.display = 'none';
    document.getElementById('create-step2').style.display = 'block';

    document.getElementById('create-name').value = name;
    document.getElementById('create-category').value = category;
    document.getElementById('create-location').value = '';

    // Wiki-Info anzeigen
    const infoBox = document.getElementById('create-wiki-info');
    if (createWikiInfo?.description) {
        infoBox.style.display = 'block';
        infoBox.innerHTML = `
            <div style="display:flex; gap:12px; align-items:flex-start;">
                ${createWikiInfo.image_url ? `<img src="${createWikiInfo.image_url}" alt="" style="width:80px; height:80px; border-radius:8px; object-fit:cover;">` : ''}
                <div style="flex:1;">
                    <strong>${createWikiInfo.name}</strong>
                    ${createWikiInfo.species ? `<span style="font-style:italic; color:var(--text-medium);"> – ${createWikiInfo.species}</span>` : ''}
                    <p style="font-size:13px; margin-top:4px; line-height:1.5;">${createWikiInfo.description.substring(0, 250)}${createWikiInfo.description.length > 250 ? '...' : ''}</p>
                </div>
            </div>`;
    } else {
        infoBox.style.display = 'none';
    }

    // Foto-Preview zurücksetzen
    createPhotos = [];
    document.getElementById('create-photo-preview').innerHTML = '';
}

function backToStep1() {
    document.getElementById('create-step1').style.display = 'block';
    document.getElementById('create-step2').style.display = 'none';
}

async function handleCreatePhotos(event) {
    const files = Array.from(event.target.files);
    for (const file of files) {
        const base64 = await compressPhoto(file);
        createPhotos.push({ data: base64, date: new Date().toISOString() });
    }
    renderCreatePhotoPreview();
}

function renderCreatePhotoPreview() {
    const container = document.getElementById('create-photo-preview');
    container.innerHTML = createPhotos.map((p, i) => `
        <div class="photo-thumb">
            <img src="${p.data}" alt="Foto ${i+1}">
            <button class="photo-thumb-remove" onclick="createPhotos.splice(${i},1); renderCreatePhotoPreview();">✕</button>
        </div>
    `).join('');
}

async function compressPhoto(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                const MAX = 800;
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
}

let _savingNewPlant = false;
async function saveNewPlant() {
    if (_savingNewPlant) return;
    _savingNewPlant = true;
    const name = document.getElementById('create-name').value.trim();
    if (!name) { showToast('❌ Bitte gib einen Namen ein!', 'error'); return; }

    const location = document.getElementById('create-location').value.trim();
    const category = document.getElementById('create-category').value;

    const plant = {
        name,
        species: createWikiInfo?.species || '',
        location,
        status: 'gesund',
        emoji: createWikiInfo?.emoji || getCategoryEmoji(category),
        photo_url: createPhotos[0]?.data || createWikiInfo?.image_url || null,
        photos: createPhotos,
        care_plan: createWikiInfo?.care_plan || generateEmptyCarePlan(),
        quick_info: createWikiInfo?.quick_info || null,
        bio_tips: createWikiInfo?.bio_tips || null,
        wiki_description: createWikiInfo?.description || '',
        category,
        custom_tasks: [],
        journal: [],
        added_date: new Date().toISOString()
    };

    await StorageLayer.savePlant(plant);
    _savingNewPlant = false;

    closeModal('modal-manual-add');
    renderPlantsGrid();
    showToast(`🌱 "${name}" wurde zu deinem Garten hinzugefügt!`, 'success');
}

function getCategoryEmoji(cat) {
    return { gemuese: '🥬', obst: '🍎', kraeuter: '🌿', blumen: '🌸', stauden: '🌼', straeucher: '🌳', sonstige: '🌱' }[cat] || '🌱';
}

// ============================================
// 🗑️ Pflanze verwalten
// ============================================

async function updatePlantStatus(plantId, status) {
    await StorageLayer.updatePlant(plantId, { status });
    const plant = plants.find(p => p.id === plantId);
    if (plant) plant.status = status;
    showToast('✅ Status aktualisiert!', 'success');
}

async function deletePlant(plantId) {
    if (!confirm('Wirklich löschen? 🗑️')) return;

    await StorageLayer.deletePlant(plantId);
    plants = plants.filter(p => p.id !== plantId);
    navigate('garten');
    showToast('🗑️ Pflanze gelöscht.', 'success');
}

// ============================================
// 📝 Custom Tasks
// ============================================

function openAddTaskDialog(plantId) {
    currentPlantId = plantId;
    document.getElementById('task-text').value = '';
    document.getElementById('task-month').value = getCurrentMonthKey();
    openModal('modal-add-task');
}

async function saveCustomTask() {
    const text = document.getElementById('task-text').value.trim();
    const month = document.getElementById('task-month').value;

    if (!text) {
        showToast('❌ Bitte gib eine Aufgabe ein!', 'error');
        return;
    }

    const plant = plants.find(p => p.id === currentPlantId);
    if (!plant) return;

    if (!plant.custom_tasks) plant.custom_tasks = [];
    plant.custom_tasks.push({ text, due_month: month, done: false });

    await StorageLayer.updatePlant(currentPlantId, { custom_tasks: plant.custom_tasks });

    closeModal('modal-add-task');
    showPlantDetail(currentPlantId);
    showToast('✅ Aufgabe hinzugefügt!', 'success');
}

async function toggleCustomTask(plantId, taskText) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;

    const task = plant.custom_tasks?.find(t => t.text === taskText);
    if (task) {
        task.done = !task.done;
        await StorageLayer.updatePlant(plantId, { custom_tasks: plant.custom_tasks });
        showPlantDetail(plantId);
    }
}

// ============================================
// 💡 Tipps rendern
// ============================================

function renderTips() {
    const container = document.getElementById('tips-container');
    const currentMonthKey = getCurrentMonthKey();
    const currentMonth = tipsData?.monthly?.[currentMonthKey];

    let html = '';

    // Aktuelle Monatstipps oben
    if (currentMonth) {
        html += `
            <div class="tips-current-month">
                <h2>${currentMonth.emoji || '🌿'} ${currentMonth.title}</h2>
                <ul>
                    ${(currentMonth.tips || []).map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    // Kategorien als Akkordeon
    if (tipsData?.categories) {
        for (const [key, cat] of Object.entries(tipsData.categories)) {
            html += `
                <div class="tips-category" id="tips-cat-${key}">
                    <div class="tips-category-header" onclick="toggleTipsCategory('${key}')">
                        <span class="tips-category-title">${cat.emoji || '📌'} ${cat.title}</span>
                        <span class="tips-category-arrow">▼</span>
                    </div>
                    <div class="tips-category-body">
                        ${(cat.articles || []).map(article => `
                            <div class="tips-article">
                                <h4>${article.title}</h4>
                                <div class="tips-article-content">${article.content}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
    }

    if (!html) {
        html = `
            <div class="calendar-empty">
                <div style="font-size: 48px; margin-bottom: 16px;">💡</div>
                <p>Tipps werden geladen...</p>
            </div>
        `;
    }

    container.innerHTML = html;
}

function toggleTipsCategory(key) {
    const el = document.getElementById(`tips-cat-${key}`);
    if (el) {
        el.classList.toggle('open');
    }
}

// ============================================
// 🔧 Hilfsfunktionen
// ============================================

function findInDatabase(searchTerm) {
    if (!searchTerm) return null;
    const term = searchTerm.toLowerCase();
    return plantDatabase.find(p =>
        p.name_de.toLowerCase() === term ||
        p.name_lat.toLowerCase() === term ||
        p.name_de.toLowerCase().includes(term) ||
        p.name_lat.toLowerCase().includes(term)
    );
}

function generateEmptyCarePlan() {
    const plan = {};
    MONTH_KEYS.forEach(k => plan[k] = []);
    return plan;
}

function checkFirstRun() {
    const apiKey = PlantNetAPI.getApiKey();
    if (!apiKey && plants.length === 0) {
        // Erster Start – freundlicher Willkommens-Hinweis
        setTimeout(() => {
            showToast('👋 Willkommen! Trage deinen Pl@ntNet API-Key in den Einstellungen ein, um loszulegen.', 'success');
        }, 1000);
    }
}

// ============================================
// 🔲 Modals
// ============================================

function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    document.body.style.overflow = '';
}

function openSettings() {
    document.getElementById('plantnet-api-key').value = PlantNetAPI.getApiKey();
    document.getElementById('claude-api-key').value = localStorage.getItem('claude_api_key') || '';
    document.getElementById('github-token').value = localStorage.getItem('github_token') || '';
    updateGitHubStatus();
    openModal('modal-settings');
}

function savePlantNetKey() {
    const key = document.getElementById('plantnet-api-key').value.trim();
    PlantNetAPI.setApiKey(key);
    showToast('✅ Pl@ntNet Key gespeichert!', 'success');
}

function saveClaudeKey() {
    const key = document.getElementById('claude-api-key').value.trim();
    localStorage.setItem('claude_api_key', key);
    showToast('✅ Claude Key gespeichert!', 'success');
}

function saveGitHubToken() {
    const token = document.getElementById('github-token').value.trim();
    localStorage.setItem('github_token', token);
    GitHubStorage.token = token;
    // Daten synchronisieren: lokal + remote mergen
    const localData = { ...StorageLayer._data };
    GitHubStorage.loadData().then(async remote => {
        // Merge: lokale UND remote Pflanzen zusammenführen
        StorageLayer._data.plants = StorageLayer._mergeLists(localData.plants || [], remote.plants || [], 'id');
        StorageLayer._data.wissen = StorageLayer._mergeLists(localData.wissen || [], remote.wissen || [], 'id');
        StorageLayer._data.general_tasks = StorageLayer._mergeLists(localData.general_tasks || [], remote.general_tasks || [], 'id');
        // Gemergte Daten zurück auf GitHub pushen
        await StorageLayer._save();
        loadPlants().then(() => renderPlantsGrid());
    });
    updateGitHubStatus();
    showToast('✅ GitHub Token gespeichert! Daten werden synchronisiert.', 'success');
}

function updateGitHubStatus() {
    const status = document.getElementById('github-status');
    if (!status) return;

    if (GitHubStorage.isConfigured()) {
        status.innerHTML = '<span class="status-dot connected"></span> Verbunden mit GitHub ✅';
    } else {
        status.innerHTML = '<span class="status-dot"></span> Nur lokaler Speicher (Token eintragen für Sync)';
    }
}

// ============================================
// 📱 Drag & Drop
// ============================================

function setupDragDrop() {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;

    ['dragenter', 'dragover'].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--green-mid)';
            uploadArea.style.background = 'var(--green-bg)';
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => {
            e.preventDefault();
            uploadArea.style.borderColor = '';
            uploadArea.style.background = '';
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            document.getElementById('plant-photo-input').files = e.dataTransfer.files;
            handlePhotoUpload({ target: { files: [file] } });
        }
    });
}

// ============================================
// 🍞 Toast Notifications
// ============================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(50px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// (Wikipedia-Suche ist jetzt in startPlantSearch/selectCreatePlant integriert)

// ============================================
// 📖 Wissen / Enzyklopädie
// ============================================

let wissenEntries = [];
let wissenCategories = [];
let _activeWissenCategory = null; // null = alle

async function loadWissen() {
    wissenEntries = await StorageLayer.getWissen();
    wissenCategories = StorageLayer.getWissenCategories();
    // IDs nachrüsten falls noch keine vorhanden
    let needsSave = false;
    wissenEntries.forEach((e, i) => {
        if (!e.id) {
            e.id = 'wissen_' + (Date.now() + i);
            needsSave = true;
        }
        if (!e.linkedPlants) e.linkedPlants = [];
    });
    if (needsSave) await saveWissenToStorage();
}

async function saveWissenToStorage() {
    // Wird über StorageLayer gespeichert (GitHub + localStorage)
    StorageLayer._data.wissen = wissenEntries;
    await StorageLayer._save();
}

async function renderWissen() {
    await loadWissen();
    const container = document.getElementById('wissen-entries');
    const empty = document.getElementById('wissen-empty');
    const countEl = document.getElementById('wissen-count');

    // Kategorie-Tabs rendern
    renderCategoryTabs();

    // Gefilterte Einträge
    const filtered = _activeWissenCategory
        ? wissenEntries.filter(e => e.category === _activeWissenCategory)
        : wissenEntries;

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        countEl.textContent = wissenEntries.length > 0 ? `${wissenEntries.length} Einträge` : '';
        return;
    }

    empty.style.display = 'none';
    countEl.textContent = `${filtered.length}${_activeWissenCategory ? '/' + wissenEntries.length : ''} Einträge`;
    renderWissenEntries(filtered);
}

function renderCategoryTabs() {
    const tabs = document.getElementById('wissen-category-tabs');
    if (!tabs) return;
    if (wissenCategories.length === 0) { tabs.innerHTML = ''; return; }

    tabs.innerHTML = [
        `<button class="wissen-cat-tab ${!_activeWissenCategory ? 'active' : ''}" onclick="setWissenCategory(null)">📚 Alle</button>`,
        ...wissenCategories.map(cat =>
            `<button class="wissen-cat-tab ${_activeWissenCategory === cat.id ? 'active' : ''}" onclick="setWissenCategory('${cat.id}')">
                ${cat.emoji || '🏷️'} ${cat.name}
            </button>`
        )
    ].join('');
}

function setWissenCategory(id) {
    _activeWissenCategory = id;
    renderWissen();
}

function renderWissenEntries(entries) {
    const container = document.getElementById('wissen-entries');
    container.innerHTML = entries.map((entry) => {
        const linkedNames = (entry.linkedPlants || [])
            .map(pid => plants.find(p => p.id === pid)?.name)
            .filter(Boolean);
        const sourceIcon = entry.source === 'youtube' ? '📹' : '❓';
        const cat = wissenCategories.find(c => c.id === entry.category);
        const catBadge = cat
            ? `<span style="font-size:11px; background:var(--green-pale); color:var(--green-dark); padding:2px 8px; border-radius:12px;">${cat.emoji || '🏷️'} ${cat.name}</span>`
            : '';
        const linkedBadge = linkedNames.length > 0
            ? `<span style="font-size:11px; background:var(--green-pale); color:var(--green-dark); padding:2px 8px; border-radius:12px; cursor:pointer;" onclick="openLinkWissenDialog('${entry.id}'); event.stopPropagation();">🔗 ${linkedNames.join(', ')}</span>`
            : '';
        return `
        <div class="tips-category" id="wissen-entry-${entry.id}">
            <div class="tips-category-header" onclick="toggleWissenEntryById('${entry.id}')">
                <span class="tips-category-title">${sourceIcon} ${entry.question}</span>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                    ${catBadge}
                    ${linkedBadge}
                    <span style="font-size:11px; color:var(--text-medium);">${entry.date || ''}</span>
                    <span class="tips-category-arrow">▼</span>
                </div>
            </div>
            <div class="tips-category-body">
                ${entry.videoId ? `<div style="margin-bottom:10px;"><a href="https://www.youtube.com/watch?v=${entry.videoId}" target="_blank" style="color:var(--green-dark); font-size:13px;">▶ Video ansehen</a></div>` : ''}
                <div class="tips-article">
                    <div class="tips-article-content" style="white-space:pre-wrap;">${entry.answer}</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; align-items:center;">
                    <select onchange="setWissenCategory_entry('${entry.id}', this.value)" onclick="event.stopPropagation()"
                            style="padding:6px 10px; border:2px solid var(--green-pale); border-radius:var(--radius-sm); font-family:Nunito; font-size:13px;">
                        <option value="">🏷️ Thema zuordnen...</option>
                        ${wissenCategories.map(c => `<option value="${c.id}" ${entry.category === c.id ? 'selected' : ''}>${c.emoji || '🏷️'} ${c.name}</option>`).join('')}
                    </select>
                    <button class="btn-secondary btn-small" onclick="openLinkWissenDialog('${entry.id}'); event.stopPropagation();">🔗 Pflanze</button>
                    <button class="btn-danger btn-small" onclick="deleteWissenEntryById('${entry.id}'); event.stopPropagation();">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function toggleWissenEntryById(id) {
    const el = document.getElementById(`wissen-entry-${id}`);
    if (el) el.classList.toggle('open');
}

async function deleteWissenEntryById(id) {
    if (!confirm('Eintrag löschen?')) return;
    wissenEntries = wissenEntries.filter(e => e.id !== id);
    await saveWissenToStorage();
    await renderWissen();
    showToast('🗑️ Eintrag gelöscht.', 'success');
}

async function setWissenCategory_entry(wissenId, categoryId) {
    const entry = wissenEntries.find(e => e.id === wissenId);
    if (!entry) return;
    entry.category = categoryId || null;
    await saveWissenToStorage();
    renderCategoryTabs();
    showToast('🏷️ Thema gesetzt', 'success');
}

async function filterWissen(query) {
    await loadWissen();
    const q = query.toLowerCase();
    let filtered = wissenEntries.filter(e =>
        e.question.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q)
    );
    if (_activeWissenCategory) {
        filtered = filtered.filter(e => e.category === _activeWissenCategory);
    }
    renderWissenEntries(filtered);
}

// Frage stellen → Claude öffnen oder API nutzen
function askGardenQuestion() {
    const question = document.getElementById('wissen-question').value.trim();
    if (!question) return;

    const claudeKey = localStorage.getItem('claude_api_key');

    if (claudeKey) {
        // API-Modus: automatische Antwort
        askClaudeAPI(question, claudeKey);
    } else {
        // Copy-Paste-Modus: Claude.ai öffnen
        const prompt = encodeURIComponent(`Du bist ein erfahrener Bio-Gärtner mit viel traditionellem Wissen. Beantworte folgende Gartenfrage ausführlich, praktisch und anfängerfreundlich. Fokus auf biologisches Gärtnern und altes Wissen. Nutze Emojis.\n\nFrage: ${question}`);
        window.open(`https://claude.ai/new?q=${prompt}`, '_blank');

        // Paste-Box anzeigen
        document.getElementById('wissen-paste-box').style.display = 'block';
        document.getElementById('wissen-current-question').textContent = question;
        document.getElementById('wissen-answer-paste').value = '';
    }
}

function cancelWissenPaste() {
    document.getElementById('wissen-paste-box').style.display = 'none';
}

async function saveWissenFromPaste() {
    const question = document.getElementById('wissen-current-question').textContent;
    const answer = document.getElementById('wissen-answer-paste').value.trim();

    if (!answer) {
        showToast('❌ Bitte füge Claudes Antwort ein!', 'error');
        return;
    }

    await loadWissen();
    wissenEntries.unshift({
        id: 'wissen_' + Date.now(),
        question,
        answer,
        date: new Date().toLocaleDateString('de-DE'),
        source: 'claude.ai',
        linkedPlants: []
    });
    await saveWissenToStorage();

    document.getElementById('wissen-paste-box').style.display = 'none';
    document.getElementById('wissen-question').value = '';
    await renderWissen();
    showToast('📖 Wissen gespeichert!', 'success');
}

// Claude API (optional, falls Key vorhanden)
async function askClaudeAPI(question, apiKey) {
    const autoBox = document.getElementById('wissen-auto-answer');
    const loading = document.getElementById('wissen-loading');
    const answerBox = document.getElementById('wissen-answer-box');

    autoBox.style.display = 'block';
    loading.style.display = 'block';
    answerBox.style.display = 'none';

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                messages: [{
                    role: 'user',
                    content: `Du bist ein erfahrener Bio-Gärtner mit viel traditionellem Wissen. Beantworte folgende Gartenfrage ausführlich, praktisch und anfängerfreundlich. Fokus auf biologisches Gärtnern, Mischkultur, natürliche Methoden und altes Wissen. Nutze Emojis zur Auflockerung.\n\nFrage: ${question}`
                }]
            })
        });

        const data = await response.json();
        loading.style.display = 'none';

        if (data.content?.[0]?.text) {
            window._pendingWissenQuestion = question;
            window._pendingWissenAnswer = data.content[0].text;

            document.getElementById('wissen-answer-content').innerHTML =
                `<div style="white-space: pre-wrap; line-height: 1.7;">${data.content[0].text}</div>`;
            answerBox.style.display = 'block';
        } else {
            throw new Error(data.error?.message || 'Unbekannter Fehler');
        }
    } catch (err) {
        loading.style.display = 'none';
        autoBox.style.display = 'none';
        showToast('❌ Claude API Fehler: ' + err.message, 'error');
    }
}

async function saveWissenEntry() {
    if (!window._pendingWissenQuestion || !window._pendingWissenAnswer) return;

    await loadWissen();
    wissenEntries.unshift({
        id: 'wissen_' + Date.now(),
        question: window._pendingWissenQuestion,
        answer: window._pendingWissenAnswer,
        date: new Date().toLocaleDateString('de-DE'),
        source: 'claude-api',
        linkedPlants: []
    });
    await saveWissenToStorage();

    document.getElementById('wissen-answer-box').style.display = 'none';
    document.getElementById('wissen-auto-answer').style.display = 'none';
    document.getElementById('wissen-question').value = '';
    renderWissen();
    showToast('📖 Wissen gespeichert!', 'success');
}

// ============================================
// 🏷️ Wissen-Kategorien
// ============================================

const CATEGORY_EMOJIS = ['🌱','💧','☀️','🪲','✂️','🌿','🍅','🌸','🍎','🌍','📅','💡','⚠️','🔬','🌾'];

function openManageCategories() {
    renderCategoryManageList();
    openModal('modal-manage-categories');
}

function renderCategoryManageList() {
    const list = document.getElementById('category-list');
    if (!wissenCategories.length) {
        list.innerHTML = '<p style="color:var(--text-medium); font-size:14px; text-align:center; padding:12px;">Noch keine Themen. Erstelle dein erstes!</p>';
        return;
    }
    list.innerHTML = wissenCategories.map((cat, i) => {
        const count = wissenEntries.filter(e => e.category === cat.id).length;
        return `
        <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--green-bg); border-radius:var(--radius-sm);">
            <span style="font-size:22px; cursor:pointer;" onclick="cycleCategoryEmoji('${cat.id}')" title="Emoji ändern">${cat.emoji || '🏷️'}</span>
            <span style="flex:1; font-weight:600;">${cat.name}</span>
            <span style="font-size:12px; color:var(--text-medium);">${count} Einträge</span>
            <button class="btn-danger btn-small" onclick="deleteCategory('${cat.id}')">🗑️</button>
        </div>`;
    }).join('');
}

async function addWissenCategory() {
    const input = document.getElementById('new-category-name');
    const name = input.value.trim();
    if (!name) return;
    const emoji = CATEGORY_EMOJIS[wissenCategories.length % CATEGORY_EMOJIS.length];
    wissenCategories.push({ id: 'cat_' + Date.now(), name, emoji });
    await StorageLayer.saveWissenCategories(wissenCategories);
    input.value = '';
    renderCategoryManageList();
    renderCategoryTabs();
    showToast('🏷️ Thema erstellt!', 'success');
}

async function deleteCategory(catId) {
    if (!confirm('Thema löschen? Einträge bleiben erhalten, verlieren aber ihre Zuordnung.')) return;
    wissenCategories = wissenCategories.filter(c => c.id !== catId);
    wissenEntries.forEach(e => { if (e.category === catId) e.category = null; });
    await StorageLayer.saveWissenCategories(wissenCategories);
    await saveWissenToStorage();
    renderCategoryManageList();
    renderCategoryTabs();
    if (_activeWissenCategory === catId) {
        _activeWissenCategory = null;
        await renderWissen();
    }
    showToast('🗑️ Thema gelöscht', 'success');
}

async function cycleCategoryEmoji(catId) {
    const cat = wissenCategories.find(c => c.id === catId);
    if (!cat) return;
    const idx = CATEGORY_EMOJIS.indexOf(cat.emoji);
    cat.emoji = CATEGORY_EMOJIS[(idx + 1) % CATEGORY_EMOJIS.length];
    await StorageLayer.saveWissenCategories(wissenCategories);
    renderCategoryManageList();
    renderCategoryTabs();
}

// ============================================
// 📹 YouTube Video → Wissen
// ============================================

function extractYouTubeId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function previewVideoWissen() {
    const url = document.getElementById('video-url-input').value.trim();
    if (!url) { showToast('❌ Bitte YouTube-URL eingeben', 'error'); return; }

    const videoId = extractYouTubeId(url);
    if (!videoId) { showToast('❌ Keine gültige YouTube-URL', 'error'); return; }

    try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (!res.ok) throw new Error('Video nicht gefunden');
        const data = await res.json();

        window._pendingVideoId = videoId;
        window._pendingVideoTitle = data.title;
        window._pendingVideoAuthor = data.author_name;

        document.getElementById('video-thumb').src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        document.getElementById('video-title-display').textContent = data.title;
        document.getElementById('video-channel').textContent = data.author_name;
        document.getElementById('video-preview-box').style.display = 'block';
        document.getElementById('video-extract-result').style.display = 'none';
        document.getElementById('video-manual-paste').style.display = 'none';

        const claudeKey = localStorage.getItem('claude_api_key');
        document.getElementById('video-extract-btn').textContent = claudeKey ? '🤖 Wissen extrahieren' : '🤖 Wissen extrahieren (API-Key nötig)';
        document.getElementById('video-extract-btn').disabled = !claudeKey;
    } catch (err) {
        showToast('❌ Video konnte nicht geladen werden', 'error');
    }
}

function closeVideoPreview() {
    document.getElementById('video-preview-box').style.display = 'none';
    document.getElementById('video-url-input').value = '';
    window._pendingVideoId = null;
    window._pendingVideoTitle = null;
}

function openVideoManualPaste() {
    document.getElementById('video-manual-paste').style.display = 'block';
    document.getElementById('video-manual-content').focus();
}

async function saveVideoManualWissen() {
    const content = document.getElementById('video-manual-content').value.trim();
    if (!content) { showToast('❌ Bitte Infos eintragen', 'error'); return; }

    await loadWissen();
    wissenEntries.unshift({
        id: 'wissen_' + Date.now(),
        question: window._pendingVideoTitle || 'YouTube Video',
        answer: content,
        date: new Date().toLocaleDateString('de-DE'),
        source: 'youtube',
        videoId: window._pendingVideoId,
        linkedPlants: []
    });
    await saveWissenToStorage();

    closeVideoPreview();
    document.getElementById('video-manual-content').value = '';
    await renderWissen();
    showToast('📖 Video-Wissen gespeichert!', 'success');
}

async function extractVideoWissen() {
    const apiKey = localStorage.getItem('claude_api_key');

    const extractResult = document.getElementById('video-extract-result');
    const extractLoading = document.getElementById('video-extract-loading');
    const extractContent = document.getElementById('video-extract-content');

    extractResult.style.display = 'block';
    extractLoading.style.display = 'block';
    extractContent.style.display = 'none';

    const videoUrl = document.getElementById('video-url-input').value.trim();
    const title = window._pendingVideoTitle;
    const author = window._pendingVideoAuthor;

    // 1. Versuch: lokaler serve.py-Server (transkribiert das Video vollständig)
    const localServerUrl = 'http://localhost:8181/transcribe';
    let usedTranscript = false;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s Verbindungstest
        const testResp = await fetch(localServerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: videoUrl, claude_key: apiKey || '' }),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (testResp.ok) {
            const data = await testResp.json();
            extractLoading.style.display = 'none';
            if (data.summary) {
                window._pendingVideoExtract = data.summary;
                document.getElementById('video-extract-text').textContent = data.summary;
                extractContent.style.display = 'block';
                usedTranscript = true;
                return;
            } else if (data.error) {
                throw new Error(data.error);
            }
        }
    } catch (localErr) {
        if (localErr.name !== 'AbortError') {
            // Server läuft, aber Fehler (z.B. kein Transkript)
            const errMsg = localErr.message || '';
            if (errMsg && !errMsg.includes('fetch') && !errMsg.includes('Failed') && !errMsg.includes('NetworkError')) {
                extractLoading.style.display = 'none';
                extractResult.style.display = 'none';
                showToast('❌ ' + errMsg, 'error');
                return;
            }
        }
        console.log('[video] Lokaler Server nicht erreichbar, nutze Titel-Analyse');
    }

    // 2. Fallback: Analyse nur nach Titel (benötigt Claude API-Key)
    if (!apiKey) {
        extractLoading.style.display = 'none';
        extractResult.style.display = 'none';
        showToast('❌ Kein Claude API-Key + Server nicht lokal. Bitte starte start-garten.bat oder trage einen API-Key ein.', 'error');
        return;
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                messages: [{
                    role: 'user',
                    content: `Du bist ein erfahrener Bio-Gärtner. Basierend auf dem Videotitel und Kanal, fasse das wahrscheinliche Gartenwissen zusammen.

Video: "${title}"
Kanal: "${author}"

🌱 **Hauptthema:**
💡 **Wichtigste Tipps:** (Bullet-Liste)
📅 **Zeitplan:** (falls erkennbar)
🔗 **Passende Pflanzen:**

(Hinweis: Basiert nur auf dem Titel – für vollständige Transkription starte start-garten.bat lokal)`
                }]
            })
        });

        const data = await response.json();
        extractLoading.style.display = 'none';

        if (data.content?.[0]?.text) {
            window._pendingVideoExtract = data.content[0].text;
            document.getElementById('video-extract-text').textContent = data.content[0].text;
            extractContent.style.display = 'block';
        } else {
            throw new Error(data.error?.message || 'Unbekannter Fehler');
        }
    } catch (err) {
        extractLoading.style.display = 'none';
        extractResult.style.display = 'none';
        showToast('❌ Fehler: ' + err.message, 'error');
    }
}

async function saveExtractedVideoWissen() {
    if (!window._pendingVideoExtract) return;

    await loadWissen();
    wissenEntries.unshift({
        id: 'wissen_' + Date.now(),
        question: window._pendingVideoTitle || 'YouTube Video',
        answer: window._pendingVideoExtract,
        date: new Date().toLocaleDateString('de-DE'),
        source: 'youtube',
        videoId: window._pendingVideoId,
        linkedPlants: []
    });
    await saveWissenToStorage();

    closeVideoPreview();
    window._pendingVideoExtract = null;
    await renderWissen();
    showToast('📖 Video-Wissen gespeichert!', 'success');
}

// ============================================
// 🔗 Wissen ↔ Pflanzen verknüpfen
// ============================================

let _linkingWissenId = null;

function openLinkWissenDialog(wissenId) {
    _linkingWissenId = wissenId;
    filterLinkPlants('');
    document.getElementById('link-plant-search').value = '';
    openModal('modal-link-wissen');
}

function filterLinkPlants(query) {
    const entry = wissenEntries.find(e => e.id === _linkingWissenId);
    const linked = entry?.linkedPlants || [];
    const q = query.toLowerCase();
    const filtered = plants.filter(p => !query || p.name.toLowerCase().includes(q));

    const list = document.getElementById('link-plant-list');
    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:var(--text-medium); font-size:14px; text-align:center; padding:16px;">Keine Pflanzen gefunden</p>';
        return;
    }

    list.innerHTML = filtered.map(p => {
        const isLinked = linked.includes(p.id);
        return `<div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:${isLinked ? 'var(--green-bg)' : 'var(--white)'}; border:2px solid ${isLinked ? 'var(--green-mid)' : 'var(--green-pale)'}; border-radius:var(--radius-sm); cursor:pointer;" onclick="toggleWissenPlantLink('${p.id}')">
            <span style="font-weight:600;">${p.emoji || '🌿'} ${p.name}</span>
            <span style="font-size:18px;">${isLinked ? '✅' : '⭕'}</span>
        </div>`;
    }).join('');
}

async function toggleWissenPlantLink(plantId) {
    const entry = wissenEntries.find(e => e.id === _linkingWissenId);
    if (!entry) return;

    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;

    if (!entry.linkedPlants) entry.linkedPlants = [];
    if (!plant.linkedWissen) plant.linkedWissen = [];

    const isLinked = entry.linkedPlants.includes(plantId);

    if (isLinked) {
        entry.linkedPlants = entry.linkedPlants.filter(id => id !== plantId);
        plant.linkedWissen = (plant.linkedWissen || []).filter(id => id !== _linkingWissenId);
    } else {
        entry.linkedPlants.push(plantId);
        if (!plant.linkedWissen.includes(_linkingWissenId)) {
            plant.linkedWissen.push(_linkingWissenId);
        }
    }

    await saveWissenToStorage();
    await StorageLayer.updatePlant(plantId, { linkedWissen: plant.linkedWissen });

    filterLinkPlants(document.getElementById('link-plant-search').value);
    showToast(isLinked ? '🔗 Verknüpfung entfernt' : '🔗 Verknüpft!', 'success');
}

// Von Pflanzenseite: Wissen hinzufügen
let _linkingPlantId = null;

async function openAddWissenToPlant(plantId) {
    _linkingPlantId = plantId;
    await loadWissen();
    document.getElementById('add-wissen-search').value = '';
    filterAddWissen('');
    openModal('modal-add-wissen-to-plant');
}

function filterAddWissen(query) {
    const plant = plants.find(p => p.id === _linkingPlantId);
    const linked = plant?.linkedWissen || [];
    const q = query.toLowerCase();
    const filtered = wissenEntries.filter(e => !query || e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q));

    const list = document.getElementById('add-wissen-list');
    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:var(--text-medium); font-size:14px; text-align:center; padding:16px;">Keine Einträge gefunden</p>';
        return;
    }

    list.innerHTML = filtered.map(entry => {
        const isLinked = linked.includes(entry.id);
        const preview = entry.answer.substring(0, 80) + (entry.answer.length > 80 ? '...' : '');
        return `<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:12px 14px; background:${isLinked ? 'var(--green-bg)' : 'var(--white)'}; border:2px solid ${isLinked ? 'var(--green-mid)' : 'var(--green-pale)'}; border-radius:var(--radius-sm); cursor:pointer;" onclick="togglePlantWissenLink('${entry.id}')">
            <div style="flex:1; min-width:0;">
                <p style="font-weight:700; margin-bottom:2px; font-size:14px;">${entry.source === 'youtube' ? '📹' : '📖'} ${entry.question}</p>
                <p style="font-size:12px; color:var(--text-medium); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${preview}</p>
            </div>
            <span style="font-size:18px; flex-shrink:0;">${isLinked ? '✅' : '⭕'}</span>
        </div>`;
    }).join('');
}

async function togglePlantWissenLink(wissenId) {
    const plant = plants.find(p => p.id === _linkingPlantId);
    const entry = wissenEntries.find(e => e.id === wissenId);
    if (!plant || !entry) return;

    if (!plant.linkedWissen) plant.linkedWissen = [];
    if (!entry.linkedPlants) entry.linkedPlants = [];

    const isLinked = plant.linkedWissen.includes(wissenId);

    if (isLinked) {
        plant.linkedWissen = plant.linkedWissen.filter(id => id !== wissenId);
        entry.linkedPlants = entry.linkedPlants.filter(id => id !== _linkingPlantId);
    } else {
        plant.linkedWissen.push(wissenId);
        if (!entry.linkedPlants.includes(_linkingPlantId)) {
            entry.linkedPlants.push(_linkingPlantId);
        }
    }

    await StorageLayer.updatePlant(_linkingPlantId, { linkedWissen: plant.linkedWissen });
    await saveWissenToStorage();

    filterAddWissen(document.getElementById('add-wissen-search').value);
    // Linked-Wissen-Section im Detail neu rendern
    const section = document.getElementById(`linked-wissen-section-${_linkingPlantId}`);
    if (section) {
        const inner = section.querySelector('.linked-wissen-list');
        if (inner) inner.outerHTML = renderLinkedWissen(plant);
    }
    showToast(isLinked ? '🔗 Verknüpfung entfernt' : '🔗 Wissen verknüpft!', 'success');
}

function renderLinkedWissen(plant) {
    const linked = (plant.linkedWissen || [])
        .map(id => wissenEntries.find(e => e.id === id))
        .filter(Boolean);

    if (linked.length === 0) {
        return '<div class="linked-wissen-list"><p style="color:var(--text-medium); font-style:italic; font-size:14px;">Noch kein Wissen verknüpft. Füge relevante Enzyklopädie-Einträge hinzu!</p></div>';
    }

    return `<div class="linked-wissen-list">${linked.map(entry => `
        <div class="tips-category" style="margin-bottom:8px;">
            <div class="tips-category-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="tips-category-title">${entry.source === 'youtube' ? '📹' : '📖'} ${entry.question}</span>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:11px; color:var(--text-medium);">${entry.date || ''}</span>
                    <span class="tips-category-arrow">▼</span>
                </div>
            </div>
            <div class="tips-category-body">
                ${entry.videoId ? `<div style="margin-bottom:10px;"><a href="https://www.youtube.com/watch?v=${entry.videoId}" target="_blank" style="color:var(--green-dark); font-size:13px;">▶ Video ansehen</a></div>` : ''}
                <div class="tips-article-content" style="white-space:pre-wrap; font-size:14px; line-height:1.7;">${entry.answer}</div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                    <button class="btn-secondary btn-small" onclick="openCarePlanIntegrate('${plant.id}', '${entry.id}'); event.stopPropagation();">📋 In Pflegeplan einarbeiten</button>
                </div>
            </div>
        </div>
    `).join('')}</div>`;
}

// ============================================
// 📋 Wissen in Pflegeplan einarbeiten
// ============================================

let _integratePlantId = null;
let _integrateWissenId = null;
let _carePlanSuggestions = [];

async function openCarePlanIntegrate(plantId, wissenId) {
    _integratePlantId = plantId;
    _integrateWissenId = wissenId;
    const entry = wissenEntries.find(e => e.id === wissenId);
    if (!entry) return;

    const apiKey = localStorage.getItem('claude_api_key');
    const loading = document.getElementById('care-integrate-loading');
    const content = document.getElementById('care-integrate-content');
    const manual = document.getElementById('care-integrate-manual');

    loading.style.display = apiKey ? 'block' : 'none';
    content.style.display = 'none';
    manual.style.display = apiKey ? 'none' : 'block';

    openModal('modal-care-plan-integrate');

    if (!apiKey) {
        // Manueller Modus
        document.getElementById('care-integrate-wissen-preview').textContent = entry.answer;
        renderManualCarePlanForm(plantId);
        return;
    }

    // Claude API: Pflegeplan-Vorschläge
    const plant = plants.find(p => p.id === plantId);
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1200,
                messages: [{
                    role: 'user',
                    content: `Du bist ein Garten-Assistent. Ich habe folgendes Gartenwissen:

---
${entry.answer}
---

Pflanze: ${plant?.name || 'unbekannt'}

Erstelle daraus konkrete Aufgaben für den Jahres-Pflegeplan dieser Pflanze. Antworte NUR mit einem JSON-Array, kein anderer Text:

[
  { "monat": "jan", "aufgabe": "Aufgabe für Januar" },
  { "monat": "mar", "aufgabe": "..." }
]

Monate: jan, feb, mar, apr, mai, jun, jul, aug, sep, okt, nov, dez
Nur Monate einschließen, die wirklich relevant sind. Max. 8 Einträge.`
                }]
            })
        });

        const data = await response.json();
        loading.style.display = 'none';

        if (data.content?.[0]?.text) {
            try {
                const jsonMatch = data.content[0].text.match(/\[[\s\S]*\]/);
                _carePlanSuggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
            } catch {
                _carePlanSuggestions = [];
            }

            if (_carePlanSuggestions.length === 0) {
                showToast('❌ Keine Vorschläge gefunden', 'error');
                closeModal('modal-care-plan-integrate');
                return;
            }

            const suggestionsEl = document.getElementById('care-integrate-suggestions');
            suggestionsEl.innerHTML = _carePlanSuggestions.map((s, i) => `
                <label style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--green-bg); border-radius:var(--radius-sm); cursor:pointer;">
                    <input type="checkbox" id="suggest-${i}" checked style="width:18px; height:18px;">
                    <div>
                        <span style="font-weight:700; font-size:13px;">${MONTH_NAMES[MONTH_KEYS.indexOf(s.monat)] || s.monat}</span>
                        <span style="font-size:14px; margin-left:6px;">${s.aufgabe}</span>
                    </div>
                </label>
            `).join('');
            content.style.display = 'block';
        } else {
            throw new Error(data.error?.message || 'Fehler');
        }
    } catch (err) {
        loading.style.display = 'none';
        closeModal('modal-care-plan-integrate');
        showToast('❌ Fehler: ' + err.message, 'error');
    }
}

async function applyCarePlanSuggestions() {
    const plant = plants.find(p => p.id === _integratePlantId);
    if (!plant) return;

    if (!plant.care_plan) plant.care_plan = generateEmptyCarePlan();

    _carePlanSuggestions.forEach((s, i) => {
        const checkbox = document.getElementById(`suggest-${i}`);
        if (checkbox?.checked && s.monat && MONTH_KEYS.includes(s.monat)) {
            if (!plant.care_plan[s.monat]) plant.care_plan[s.monat] = [];
            if (!plant.care_plan[s.monat].includes(s.aufgabe)) {
                plant.care_plan[s.monat].push(s.aufgabe);
            }
        }
    });

    await StorageLayer.updatePlant(_integratePlantId, { care_plan: plant.care_plan });
    closeModal('modal-care-plan-integrate');
    showPlantDetail(_integratePlantId);
    showToast('📋 Pflegeplan aktualisiert!', 'success');
}

function renderManualCarePlanForm(plantId) {
    const container = document.getElementById('care-integrate-manual-months');
    container.innerHTML = MONTH_KEYS.map((key, idx) => `
        <div style="display:flex; align-items:center; gap:8px;">
            <label style="width:90px; font-size:13px; font-weight:700; flex-shrink:0;">${MONTH_EMOJIS[idx]} ${MONTH_NAMES[idx]}</label>
            <input type="text" id="manual-month-${key}" placeholder="Aufgabe für ${MONTH_NAMES[idx]} (leer = überspringen)"
                   style="flex:1; padding:8px 12px; border:2px solid var(--green-pale); border-radius:var(--radius-sm); font-family:Nunito; font-size:13px;">
        </div>
    `).join('');
}

async function applyManualCarePlan() {
    const plant = plants.find(p => p.id === _integratePlantId);
    if (!plant) return;

    if (!plant.care_plan) plant.care_plan = generateEmptyCarePlan();
    let added = 0;

    MONTH_KEYS.forEach(key => {
        const val = document.getElementById(`manual-month-${key}`)?.value.trim();
        if (val) {
            if (!plant.care_plan[key]) plant.care_plan[key] = [];
            if (!plant.care_plan[key].includes(val)) {
                plant.care_plan[key].push(val);
                added++;
            }
        }
    });

    if (added === 0) { showToast('❌ Keine Aufgaben eingegeben', 'error'); return; }

    await StorageLayer.updatePlant(_integratePlantId, { care_plan: plant.care_plan });
    closeModal('modal-care-plan-integrate');
    showPlantDetail(_integratePlantId);
    showToast(`📋 ${added} Aufgaben zum Pflegeplan hinzugefügt!`, 'success');
}
