// ============================================
// 📅 Kalender-Logik
// ============================================

const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                     'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun',
                    'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];
const MONTH_EMOJIS = ['❄️', '🌨️', '🌱', '🌷', '🌸', '☀️',
                      '🌻', '🍅', '🍂', '🎃', '🍁', '🎄'];
const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();
let calendarView = 'tasks'; // 'tasks' oder 'calendar'

function getCurrentMonthKey() {
    return MONTH_KEYS[new Date().getMonth()];
}

function renderCalendar(plants, generalTasks, tipsData) {
    const container = document.getElementById('calendar-container');
    const monthKey = MONTH_KEYS[calendarMonth];
    const monthName = MONTH_NAMES[calendarMonth];
    const monthEmoji = MONTH_EMOJIS[calendarMonth];
    const isCurrentMonth = calendarMonth === new Date().getMonth() && calendarYear === new Date().getFullYear();

    // Alle Tasks für diesen Monat sammeln
    const allTasks = collectMonthTasks(plants, generalTasks, tipsData, monthKey);

    container.innerHTML = `
        <div class="calendar-nav">
            <button onclick="changeMonth(-1)">◀</button>
            <div class="calendar-month-title">
                ${monthEmoji} ${monthName} ${calendarYear}
                ${isCurrentMonth ? '<span style="font-size: 14px; color: var(--green-mid);"> (aktuell)</span>' : ''}
            </div>
            <button onclick="changeMonth(1)">▶</button>
        </div>

        <div class="calendar-view-toggle">
            <button class="view-btn ${calendarView === 'tasks' ? 'active' : ''}" onclick="switchCalendarView('tasks')">📋 Aufgaben</button>
            <button class="view-btn ${calendarView === 'calendar' ? 'active' : ''}" onclick="switchCalendarView('calendar')">📅 Kalender</button>
        </div>

        ${calendarView === 'tasks'
            ? renderTasksView(allTasks, monthName)
            : renderCalendarGrid(allTasks, monthKey)}
    `;
}

function collectMonthTasks(plants, generalTasks, tipsData, monthKey) {
    const tasks = { personal: [], general: [], tips: [] };

    // Persönliche Pflanzen-Aufgaben
    plants.forEach(plant => {
        const careTasks = plant.care_plan?.[monthKey] || [];
        careTasks.forEach(task => {
            tasks.personal.push({
                text: task,
                plant: plant.name,
                plantId: plant.id,
                emoji: plant.emoji || '🌿',
                type: 'care'
            });
        });
        // Custom Tasks
        (plant.custom_tasks || []).forEach(ct => {
            if (ct.due_month === monthKey) {
                tasks.personal.push({
                    text: ct.text,
                    plant: plant.name,
                    plantId: plant.id,
                    emoji: plant.emoji || '🌿',
                    type: 'custom',
                    done: ct.done
                });
            }
        });
    });

    // Allgemeine Gartenaufgaben
    if (tipsData?.general_tasks) {
        tipsData.general_tasks.forEach(task => {
            if (task.months.includes(monthKey)) {
                tasks.general.push({
                    text: task.title,
                    description: task.description,
                    emoji: task.emoji
                });
            }
        });
    }
    generalTasks.forEach(task => {
        if (task.months?.includes(monthKey)) {
            tasks.general.push({
                text: task.title,
                description: task.description,
                emoji: task.emoji || '📋'
            });
        }
    });

    // Saisonale Tipps
    tasks.tips = tipsData?.monthly?.[monthKey]?.tips || [];

    return tasks;
}

// ============================================
// 📋 Aufgaben-Ansicht (bisherig)
// ============================================

function renderTasksView(tasks, monthName) {
    let html = '';

    if (tasks.personal.length > 0) {
        html += `
        <div class="calendar-section">
            <h3 class="calendar-section-title">🌿 Meine Pflanzen-Aufgaben</h3>
            ${tasks.personal.map(t => `
                <div class="calendar-task task-personal ${t.done ? 'task-done' : ''}" onclick="showPlantDetail('${t.plantId}')">
                    <span class="calendar-task-emoji">${t.emoji}</span>
                    <div>
                        <div>${t.text}${t.done ? ' ✅' : ''}</div>
                        <div class="calendar-task-plant">${t.plant}</div>
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    if (tasks.general.length > 0) {
        html += `
        <div class="calendar-section">
            <h3 class="calendar-section-title">🏡 Allgemeine Gartenaufgaben</h3>
            ${tasks.general.map(t => `
                <div class="calendar-task task-general">
                    <span class="calendar-task-emoji">${t.emoji}</span>
                    <div>
                        <div>${t.text}</div>
                        ${t.description ? `<div class="calendar-task-plant">${t.description}</div>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    if (tasks.tips.length > 0) {
        html += `
        <div class="calendar-section">
            <h3 class="calendar-section-title">💡 Saisonale Tipps</h3>
            ${tasks.tips.map(tip => `
                <div class="calendar-task task-tip">
                    <span class="calendar-task-emoji">💡</span>
                    <div>${tip}</div>
                </div>
            `).join('')}
        </div>`;
    }

    if (tasks.personal.length === 0 && tasks.general.length === 0 && tasks.tips.length === 0) {
        html = `
        <div class="calendar-empty">
            <div style="font-size: 48px; margin-bottom: 16px;">🌙</div>
            <p>Keine Aufgaben für ${monthName}.</p>
        </div>`;
    }

    return html;
}

// ============================================
// 📅 Kalender-Grid-Ansicht
// ============================================

function renderCalendarGrid(tasks, monthKey) {
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Montag = 0, Sonntag = 6
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const today = new Date();
    const isCurrentMonth = calendarMonth === today.getMonth() && calendarYear === today.getFullYear();
    const todayDate = today.getDate();

    // Task-Dots: Pflanzen-Tasks über den Monat verteilen
    const taskDots = distributeTasksToDays(tasks, daysInMonth);

    let html = '<div class="cal-grid">';

    // Header: Wochentage
    DAY_NAMES.forEach(d => {
        html += `<div class="cal-header">${d}</div>`;
    });

    // Leere Zellen vor dem 1.
    for (let i = 0; i < startDay; i++) {
        html += '<div class="cal-day cal-empty"></div>';
    }

    // Tage
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = isCurrentMonth && day === todayDate;
        const dayTasks = taskDots[day] || [];
        const hasPersonal = dayTasks.some(t => t.type === 'personal');
        const hasGeneral = dayTasks.some(t => t.type === 'general');

        html += `
            <div class="cal-day ${isToday ? 'cal-today' : ''} ${dayTasks.length > 0 ? 'cal-has-tasks' : ''}"
                 ${dayTasks.length > 0 ? `onclick="showDayTasks(${day})"` : ''}>
                <span class="cal-day-num">${day}</span>
                ${dayTasks.length > 0 ? `
                    <div class="cal-dots">
                        ${hasPersonal ? '<span class="cal-dot cal-dot-personal"></span>' : ''}
                        ${hasGeneral ? '<span class="cal-dot cal-dot-general"></span>' : ''}
                    </div>
                ` : ''}
            </div>`;
    }

    html += '</div>';

    // Legende
    html += `
        <div class="cal-legend">
            <span><span class="cal-dot cal-dot-personal"></span> Pflanzen-Aufgaben</span>
            <span><span class="cal-dot cal-dot-general"></span> Allgemeine Aufgaben</span>
        </div>`;

    // Task-Übersicht unter dem Kalender
    const allPersonal = tasks.personal;
    const allGeneral = tasks.general;

    if (allPersonal.length > 0 || allGeneral.length > 0) {
        html += '<div class="cal-task-summary">';
        if (allPersonal.length > 0) {
            html += `<h4>🌿 ${allPersonal.length} Pflanzen-Aufgaben</h4>`;
            html += allPersonal.map(t => `
                <div class="calendar-task task-personal ${t.done ? 'task-done' : ''}" onclick="showPlantDetail('${t.plantId}')">
                    <span class="calendar-task-emoji">${t.emoji}</span>
                    <div><div>${t.text}${t.done ? ' ✅' : ''}</div><div class="calendar-task-plant">${t.plant}</div></div>
                </div>
            `).join('');
        }
        if (allGeneral.length > 0) {
            html += `<h4 style="margin-top:12px;">🏡 ${allGeneral.length} Allgemeine Aufgaben</h4>`;
            html += allGeneral.map(t => `
                <div class="calendar-task task-general">
                    <span class="calendar-task-emoji">${t.emoji}</span>
                    <div><div>${t.text}</div></div>
                </div>
            `).join('');
        }
        html += '</div>';
    }

    return html;
}

function distributeTasksToDays(tasks, daysInMonth) {
    const dots = {};

    // Pflanzen-Aufgaben gleichmäßig verteilen
    tasks.personal.forEach((task, i) => {
        const day = Math.min(Math.floor((i / Math.max(tasks.personal.length, 1)) * daysInMonth) + 1, daysInMonth);
        if (!dots[day]) dots[day] = [];
        dots[day].push({ ...task, type: 'personal' });
    });

    // Allgemeine Aufgaben in der Monatsmitte
    tasks.general.forEach((task, i) => {
        const day = Math.min(Math.floor(daysInMonth / 2) + i, daysInMonth);
        if (!dots[day]) dots[day] = [];
        dots[day].push({ ...task, type: 'general' });
    });

    return dots;
}

function showDayTasks(day) {
    // Scroll zu den Tasks unter dem Kalender
    const summary = document.querySelector('.cal-task-summary');
    if (summary) summary.scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// 🔄 Navigation & View Switch
// ============================================

function switchCalendarView(view) {
    calendarView = view;
    if (typeof refreshCalendar === 'function') {
        refreshCalendar();
    }
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
    if (typeof refreshCalendar === 'function') {
        refreshCalendar();
    }
}
