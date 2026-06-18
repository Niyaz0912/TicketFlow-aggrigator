import { auth } from './modules/auth.js';

auth.init();

// DOM элементы
const eventsGrid = document.getElementById('eventsGrid');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const createEventBtn = document.getElementById('createEventBtn');
const userMenu = document.getElementById('userMenu');
const authButtons = document.getElementById('authButtons');
const userName = document.getElementById('userName');

// Модалки
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');

// Хранилище мероприятий
let allEvents = [];

// --- Загрузка мероприятий ---
async function loadEvents() {
    try {
        const res = await fetch('/api/events');
        const data = await res.json();
        if (data.status === 'success') {
            allEvents = data.events;
            renderEvents(allEvents);
        }
    } catch (e) {
        eventsGrid.innerHTML = '<p>Ошибка загрузки</p>';
    }
}

function renderEvents(events) {
    if (!events || events.length === 0) {
        eventsGrid.innerHTML = '<p>Мероприятий пока нет</p>';
        return;
    }
    eventsGrid.innerHTML = events.map(event => `
        <div class="event-card">
            <div class="event-details">
                <h3>${event.title}</h3>
                <p>${event.description || ''}</p>
                <p>📍 ${event.city}, ${event.venue}</p>
                <p>💰 ${event.freeSeating?.price || 0} тг.</p>
                <button class="book-btn" data-event-id="${event._id}">Купить билет</button>
            </div>
        </div>
    `).join('');

    // Обработчики кнопок
    document.querySelectorAll('.book-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const eventId = btn.dataset.eventId;
            if (!auth.isAuthenticated()) {
                alert('Войдите в систему');
                openLoginModal();
                return;
            }
            const event = allEvents.find(e => e._id === eventId);
            if (event) {
                window.location.href = `/event/${event.eventId}/tickets`;
            } else {
                alert('Мероприятие не найдено');
            }
        });
    });
}

// --- UI ---
function updateUI() {
    if (auth.isAuthenticated()) {
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        userName.textContent = auth.user.name;
        createEventBtn.style.display = auth.isAdmin() ? 'block' : 'none';
    } else {
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
        createEventBtn.style.display = 'none';
    }
}

// --- Модалки ---
function openLoginModal() { loginModal.style.display = 'flex'; }
function closeLoginModal() { loginModal.style.display = 'none'; }
function openRegisterModal() { registerModal.style.display = 'flex'; }
function closeRegisterModal() { registerModal.style.display = 'none'; }

// --- Обработчики ---
loginBtn?.addEventListener('click', openLoginModal);
registerBtn?.addEventListener('click', openRegisterModal);

document.getElementById('switchToRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeLoginModal();
    openRegisterModal();
});

document.getElementById('switchToLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    closeRegisterModal();
    openLoginModal();
});

// Логин
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const result = await auth.login(email, password);
    if (result.status === 'success') {
        updateUI();
        closeLoginModal();
        loadEvents();
    } else {
        alert(result.message || 'Ошибка входа');
    }
});

// Регистрация
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    if (password !== confirm) {
        alert('Пароли не совпадают');
        return;
    }
    const result = await auth.register(name, email, password);
    if (result.status === 'success') {
        updateUI();
        closeRegisterModal();
        loadEvents();
    } else {
        alert(result.message || 'Ошибка регистрации');
    }
});

// Выход
logoutBtn?.addEventListener('click', () => {
    auth.logout();
    updateUI();
    loadEvents();
});

// Создание мероприятия (админ)
createEventBtn?.addEventListener('click', () => {
    window.location.href = '/create-event';
});

// --- Старт ---
updateUI();
loadEvents();

// Закрытие модалок по клику вне
document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
        if (e.target === el) {
            el.style.display = 'none';
        }
    });
});