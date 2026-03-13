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

function showPlantDetail(plantId) {
    const plant = plants.find(p => p.id === plantId);
    if (!plant) return;

    currentPlantId = plantId;
    const currentMonthKey = getCurrentMonthKey();
    const container = document.getElementById('plant-detail');

    // Quick Info aus der Datenbank holen
    const dbPlant = findInDatabase(plant.species || plant.name);
    const quickInfo = plant.quick_info || dbPlant?.quick_info;

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

        <!-- Jahres-Pflegeplan -->
        <div class="year-plan">
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

        <!-- Anstehende Aufgaben -->
        <div class="upcoming-tasks">
            <h2>📌 Anstehende Aufgaben</h2>
            <button class="btn-secondary btn-small" onclick="openAddTaskDialog('${plant.id}')" style="margin-bottom: 16px;">
                ➕ Eigene Aufgabe hinzufügen
            </button>
            ${renderUpcomingTasks(plant)}
        </div>
    `;

    navigate('detail');
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

async function savePlant() {
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

    const saved = await StorageLayer.savePlant(plant);
    plants.unshift(saved);

    closeModal('modal-add-plant');
    renderPlantsGrid();
    showToast(`🌱 "${name}" wurde zu deinem Garten hinzugefügt!`, 'success');
}

// ============================================
// ➕ Manuelle Pflanze hinzufügen
// ============================================

function openManualAddDialog() {
    selectedDbPlant = null;
    selectedWikiPlant = null;
    document.getElementById('manual-selected').style.display = 'none';
    document.getElementById('manual-search').value = '';
    document.getElementById('wiki-results').innerHTML = '';
    document.getElementById('wiki-detail').style.display = 'none';
    const wikiInput = document.getElementById('wiki-search-input');
    if (wikiInput) wikiInput.value = '';
    switchManualTab('database');
    renderPlantDatabaseList('');
    openModal('modal-manual-add');
}

function filterPlantDatabase(query) {
    renderPlantDatabaseList(query);
}

function renderPlantDatabaseList(query) {
    const list = document.getElementById('plant-database-list');
    const q = query.toLowerCase();
    const filtered = plantDatabase.filter(p =>
        p.name_de.toLowerCase().includes(q) ||
        p.name_lat.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );

    const categoryLabels = {
        gemuese: '🥬 Gemüse',
        obst: '🍎 Obst',
        kraeuter: '🌿 Kräuter',
        blumen: '🌸 Blumen',
        stauden: '🌼 Stauden',
        straeucher: '🌳 Sträucher'
    };

    list.innerHTML = filtered.map(p => `
        <div class="plant-db-item" onclick="selectDbPlant('${p.id}')">
            <span class="plant-db-item-emoji">${p.emoji}</span>
            <div>
                <div class="plant-db-item-name">${p.name_de}</div>
                <div class="plant-db-item-latin">${p.name_lat}</div>
            </div>
            <span class="plant-db-item-category">${categoryLabels[p.category] || p.category}</span>
        </div>
    `).join('');
}

function selectDbPlant(id) {
    const plant = plantDatabase.find(p => p.id === id);
    if (!plant) return;

    selectedDbPlant = plant;
    selectedWikiPlant = null;

    // Highlight
    document.querySelectorAll('.plant-db-item').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');

    // Formular anzeigen + Kategorie setzen
    document.getElementById('manual-selected').style.display = 'block';
    document.getElementById('manual-name').placeholder = plant.name_de;
    document.getElementById('manual-category').value = plant.category || 'sonstige';
    showBioTips();
}

async function saveManualPlant() {
    const source = selectedDbPlant || selectedWikiPlant;
    if (!source) {
        showToast('❌ Bitte wähle eine Pflanze aus!', 'error');
        return;
    }

    const customName = document.getElementById('manual-name').value.trim() || source.name_de || source.title || 'Unbekannt';
    const location = document.getElementById('manual-location').value.trim();
    const category = document.getElementById('manual-category').value;
    const photoInput = document.getElementById('manual-photo-input');

    let photoUrl = selectedWikiPlant?.image_url || null;
    if (photoInput.files[0]) {
        const base64 = await PlantNetAPI.fileToBase64(photoInput.files[0]);
        photoUrl = base64;
        try {
            if (firebaseReady) {
                photoUrl = await StorageLayer.uploadPhoto(photoInput.files[0], 'plant_' + Date.now());
            }
        } catch (err) {
            console.warn('Photo upload fallback to base64');
        }
    }

    // Pflegeplan: aus DB oder Bio-Template generieren
    const carePlan = selectedDbPlant?.care_plan || WikipediaAPI.generateBioCarePlan(category);
    const bioTips = WikipediaAPI.getBioTips(category);

    const plant = {
        name: customName,
        species: source.name_lat || source.taxonomy?.wissenschaftlich || '',
        location,
        status: 'gesund',
        emoji: source.emoji || getCategoryEmoji(category),
        photo_url: photoUrl,
        care_plan: carePlan,
        quick_info: source.quick_info || null,
        bio_tips: bioTips,
        wiki_description: selectedWikiPlant?.description || '',
        category,
        custom_tasks: [],
        added_date: new Date().toISOString()
    };

    const saved = await StorageLayer.savePlant(plant);
    plants.unshift(saved);

    closeModal('modal-manual-add');
    renderPlantsGrid();
    showToast(`🌱 "${customName}" wurde zu deinem Garten hinzugefügt!`, 'success');
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
    // Daten sofort synchronisieren
    GitHubStorage.loadData().then(data => {
        StorageLayer._data = data;
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

// ============================================
// 🔍 Wikipedia-Suche für beliebige Pflanzen
// ============================================

let selectedWikiPlant = null;

function switchManualTab(tab) {
    document.querySelectorAll('.manual-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.manual-tab-content').forEach(c => c.style.display = 'none');

    if (tab === 'database') {
        document.querySelector('.manual-tab:first-child').classList.add('active');
        document.getElementById('manual-tab-database').style.display = 'block';
    } else {
        document.querySelector('.manual-tab:last-child').classList.add('active');
        document.getElementById('manual-tab-freetext').style.display = 'block';
    }
    document.getElementById('manual-selected').style.display = 'none';
    selectedDbPlant = null;
    selectedWikiPlant = null;
}

async function searchWikipedia() {
    const query = document.getElementById('wiki-search-input').value.trim();
    if (!query) return;

    document.getElementById('wiki-loading').style.display = 'block';
    document.getElementById('wiki-results').innerHTML = '';
    document.getElementById('wiki-detail').style.display = 'none';
    document.getElementById('manual-selected').style.display = 'none';

    try {
        const results = await WikipediaAPI.search(query);
        document.getElementById('wiki-loading').style.display = 'none';

        if (results.length === 0) {
            document.getElementById('wiki-results').innerHTML = '<p style="color: var(--text-medium); padding: 12px;">Nichts gefunden. Versuche einen anderen Suchbegriff.</p>';
            return;
        }

        const container = document.getElementById('wiki-results');
        container.innerHTML = '';
        results.forEach((r, i) => {
            const div = document.createElement('div');
            div.className = 'plant-db-item';
            div.innerHTML = `
                <span class="plant-db-item-emoji">🌿</span>
                <div>
                    <div class="plant-db-item-name">${r.title.replace(/</g, '&lt;')}</div>
                    <div class="plant-db-item-latin">${(r.description || '').replace(/</g, '&lt;')}</div>
                </div>
            `;
            div.addEventListener('click', () => selectWikiResult(i));
            container.appendChild(div);
        });

        // Ergebnisse global speichern
        window._wikiResults = results;
        console.log('[searchWikipedia] saved', results.length, 'results to window._wikiResults');
    } catch (err) {
        document.getElementById('wiki-loading').style.display = 'none';
        showToast('❌ Wikipedia-Suche fehlgeschlagen', 'error');
    }
}

async function selectWikiResult(index) {
    console.log('[selectWikiResult] called with index:', index);
    const result = window._wikiResults?.[index];
    if (!result) { console.log('[selectWikiResult] no result at index', index); return; }
    console.log('[selectWikiResult] result:', result.title);

    // Nur gewähltes Ergebnis behalten, Rest ausblenden
    const items = document.querySelectorAll('#wiki-results .plant-db-item');
    items.forEach((el, idx) => {
        if (idx === index) {
            el.classList.add('selected');
        } else {
            el.style.display = 'none';
        }
    });
    // "Andere Ergebnisse" Link
    let backLink = document.getElementById('wiki-back-link');
    if (!backLink) {
        backLink = document.createElement('a');
        backLink.id = 'wiki-back-link';
        backLink.href = '#';
        backLink.textContent = '← Andere Ergebnisse anzeigen';
        backLink.style.cssText = 'display:block; margin-top:8px; font-size:13px; color:var(--green-main);';
        backLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('#wiki-results .plant-db-item').forEach(el => {
                el.style.display = '';
                el.classList.remove('selected');
            });
            document.getElementById('wiki-detail').style.display = 'none';
            document.getElementById('manual-selected').style.display = 'none';
            backLink.remove();
            selectedWikiPlant = null;
        });
        document.getElementById('wiki-results').after(backLink);
    }

    document.getElementById('wiki-loading').style.display = 'block';

    try {
        const info = await WikipediaAPI.getPlantInfo(result.title);
        document.getElementById('wiki-loading').style.display = 'none';

        // Detail anzeigen
        document.getElementById('wiki-detail').style.display = 'block';
        document.getElementById('wiki-plant-title').textContent = info.title;
        document.getElementById('wiki-plant-taxonomy').textContent =
            [info.taxonomy.familie, info.taxonomy.wissenschaftlich].filter(Boolean).join(' · ') || '';
        document.getElementById('wiki-plant-description').textContent = info.description?.substring(0, 300) || '';

        const img = document.getElementById('wiki-plant-image');
        if (info.image_url) {
            img.src = info.image_url;
            img.style.display = 'block';
        } else {
            img.style.display = 'none';
        }

        // Kategorie erraten
        const guessedCat = WikipediaAPI.guessCategory(info.description + ' ' + info.taxonomy.familie);

        selectedWikiPlant = {
            title: info.title,
            name_de: info.title,
            name_lat: info.taxonomy.wissenschaftlich || '',
            description: info.description,
            image_url: info.image_url,
            taxonomy: info.taxonomy,
            category: guessedCat
        };

        // Formular anzeigen
        document.getElementById('manual-selected').style.display = 'block';
        document.getElementById('manual-name').placeholder = info.title;
        document.getElementById('manual-category').value = guessedCat;
        showBioTips();

        // Zum Detail scrollen
        document.getElementById('wiki-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
        console.error('[selectWikiResult] Error:', err);
        document.getElementById('wiki-loading').style.display = 'none';
        // Ergebnisse wieder einblenden bei Fehler
        document.querySelectorAll('#wiki-results .plant-db-item').forEach(el => el.style.display = '');
        showToast('❌ Konnte Details nicht laden: ' + err.message, 'error');
    }
}

// ============================================
// 🌿 Bio-Garten Tipps anzeigen
// ============================================

function showBioTips() {
    const category = document.getElementById('manual-category').value;
    const tips = WikipediaAPI.getBioTips(category);
    const container = document.getElementById('bio-tips-content');
    const preview = document.getElementById('bio-tips-preview');

    if (tips) {
        preview.style.display = 'block';
        container.innerHTML = `
            <div style="display: grid; gap: 8px; margin-top: 8px;">
                ${tips.mischkultur ? `<div class="bio-tip-item">🌱 <strong>Mischkultur:</strong> ${tips.mischkultur}</div>` : ''}
                ${tips.duengung ? `<div class="bio-tip-item">🧪 <strong>Bio-Düngung:</strong> ${tips.duengung}</div>` : ''}
                ${tips.schaedlinge ? `<div class="bio-tip-item">🐛 <strong>Natürlicher Schutz:</strong> ${tips.schaedlinge}</div>` : ''}
                ${tips.mulch ? `<div class="bio-tip-item">🍂 <strong>Mulch:</strong> ${tips.mulch}</div>` : ''}
            </div>
        `;
    }
}

// ============================================
// 📖 Wissen / Enzyklopädie
// ============================================

let wissenEntries = [];

async function loadWissen() {
    wissenEntries = await StorageLayer.getWissen();
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

    if (wissenEntries.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        countEl.textContent = '';
        return;
    }

    empty.style.display = 'none';
    countEl.textContent = `${wissenEntries.length} Einträge`;
    renderWissenEntries(wissenEntries);
}

function renderWissenEntries(entries) {
    const container = document.getElementById('wissen-entries');
    container.innerHTML = entries.map((entry, i) => `
        <div class="tips-category" id="wissen-entry-${i}">
            <div class="tips-category-header" onclick="toggleWissenEntry(${i})">
                <span class="tips-category-title">❓ ${entry.question}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; color: var(--text-medium);">${entry.date || ''}</span>
                    <span class="tips-category-arrow">▼</span>
                </div>
            </div>
            <div class="tips-category-body">
                <div class="tips-article">
                    <div class="tips-article-content" style="white-space: pre-wrap;">${entry.answer}</div>
                </div>
                <button class="btn-danger btn-small" onclick="deleteWissenEntry(${i}); event.stopPropagation();" style="margin-top: 8px;">🗑️ Löschen</button>
            </div>
        </div>
    `).join('');
}

function toggleWissenEntry(idx) {
    const el = document.getElementById(`wissen-entry-${idx}`);
    if (el) el.classList.toggle('open');
}

async function deleteWissenEntry(idx) {
    if (!confirm('Eintrag löschen?')) return;
    wissenEntries.splice(idx, 1);
    await saveWissenToStorage();
    await renderWissen();
    showToast('🗑️ Eintrag gelöscht.', 'success');
}

async function filterWissen(query) {
    await loadWissen();
    const q = query.toLowerCase();
    const filtered = wissenEntries.filter(e =>
        e.question.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q)
    );
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
        question,
        answer,
        date: new Date().toLocaleDateString('de-DE'),
        source: 'claude.ai'
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
        question: window._pendingWissenQuestion,
        answer: window._pendingWissenAnswer,
        date: new Date().toLocaleDateString('de-DE'),
        source: 'claude-api'
    });
    await saveWissenToStorage();

    document.getElementById('wissen-answer-box').style.display = 'none';
    document.getElementById('wissen-auto-answer').style.display = 'none';
    document.getElementById('wissen-question').value = '';
    renderWissen();
    showToast('📖 Wissen gespeichert!', 'success');
}
