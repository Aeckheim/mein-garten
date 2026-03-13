// ============================================
// 📅 Kalender-Logik
// ============================================

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                     'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun',
                    'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];
const MONTH_EMOJIS = ['❄️', '🌨️', '🌱', '🌷', '🌸', '☀️',
                      '🌻', '🍅', '🍂', '🎃', '🍁', '🎄'];

let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();

function getCurrentMonthKey() {
    return MONTH_KEYS[new Date().getMonth()];
}

function renderCalendar(plants, generalTasks, tipsData) {
    const container = document.getElementById('calendar-container');
    const monthKey = MONTH_KEYS[calendarMonth];
    const monthName = MONTH_NAMES[calendarMonth];
    const monthEmoji = MONTH_EMOJIS[calendarMonth];
    const isCurrentMonth = calendarMonth === new Date().getMonth() && calendarYear === new Date().getFullYear();

    // Persönliche Aufgaben aus Pflanzen sammeln
    const personalTasks = [];
    plants.forEach(plant => {
        const tasks = plant.care_plan?.[monthKey] || [];
        tasks.forEach(task => {
            personalTasks.push({
                text: task,
                plant: plant.name,
                emoji: plant.emoji || '🌿',
                photo_url: plant.photo_url
            });
        });
        // Custom Tasks für diesen Monat
        (plant.custom_tasks || []).forEach(ct => {
            if (ct.due_month === monthKey) {
                personalTasks.push({
                    text: ct.text + (ct.done ? ' ✅' : ''),
                    plant: plant.name,
                    emoji: plant.emoji || '🌿',
                    isCustom: true,
                    done: ct.done
                });
            }
        });
    });

    // Allgemeine Aufgaben für diesen Monat
    const monthGeneralTasks = [];

    // Aus tips.json general_tasks
    if (tipsData?.general_tasks) {
        tipsData.general_tasks.forEach(task => {
            if (task.months.includes(monthKey)) {
                monthGeneralTasks.push({
                    text: task.title,
                    description: task.description,
                    emoji: task.emoji
                });
            }
        });
    }

    // Aus Firebase/localStorage general_tasks
    generalTasks.forEach(task => {
        if (task.months && task.months.includes(monthKey)) {
            monthGeneralTasks.push({
                text: task.title,
                description: task.description,
                emoji: task.emoji || '📋'
            });
        }
    });

    // Saisonale Tipps
    const seasonalTips = tipsData?.monthly?.[monthKey]?.tips || [];

    container.innerHTML = `
        <div class="calendar-nav">
            <button onclick="changeMonth(-1)">◀</button>
            <div class="calendar-month-title">
                ${monthEmoji} ${monthName} ${calendarYear}
                ${isCurrentMonth ? '<span style="font-size: 14px; color: var(--green-mid);"> (aktuell)</span>' : ''}
            </div>
            <button onclick="changeMonth(1)">▶</button>
        </div>

        ${personalTasks.length > 0 ? `
        <div class="calendar-section">
            <h3 class="calendar-section-title">🌿 Meine Pflanzen-Aufgaben</h3>
            ${personalTasks.map(t => `
                <div class="calendar-task task-personal ${t.done ? 'task-done' : ''}">
                    <span class="calendar-task-emoji">${t.emoji}</span>
                    <div>
                        <div>${t.text}</div>
                        <div class="calendar-task-plant">${t.plant}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${monthGeneralTasks.length > 0 ? `
        <div class="calendar-section">
            <h3 class="calendar-section-title">🏡 Allgemeine Gartenaufgaben</h3>
            ${monthGeneralTasks.map(t => `
                <div class="calendar-task task-general">
                    <span class="calendar-task-emoji">${t.emoji}</span>
                    <div>
                        <div>${t.text}</div>
                        ${t.description ? `<div class="calendar-task-plant">${t.description}</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${seasonalTips.length > 0 ? `
        <div class="calendar-section">
            <h3 class="calendar-section-title">💡 Saisonale Tipps</h3>
            ${seasonalTips.map(tip => `
                <div class="calendar-task task-tip">
                    <span class="calendar-task-emoji">💡</span>
                    <div>${tip}</div>
                </div>
            `).join('')}
        </div>
        ` : ''}

        ${personalTasks.length === 0 && monthGeneralTasks.length === 0 && seasonalTips.length === 0 ? `
        <div class="calendar-empty">
            <div style="font-size: 48px; margin-bottom: 16px;">🌙</div>
            <p>Keine Aufgaben für ${monthName}.</p>
        </div>
        ` : ''}
    `;
}

function changeMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth > 11) {
        calendarMonth = 0;
        calendarYear++;
    } else if (calendarMonth < 0) {
        calendarMonth = 11;
        calendarYear--;
    }
    // Trigger re-render from app.js
    if (typeof refreshCalendar === 'function') {
        refreshCalendar();
    }
}
