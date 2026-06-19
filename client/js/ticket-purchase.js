// ============================================================
// ФАЙЛ: client/js/ticket-purchase.js
// Модуль для страницы покупки билета
// ============================================================

// --- Импорт модуля авторизации ---
import { auth } from './modules/auth.js';

// --- DOM-элементы (ссылки на HTML-элементы) ---
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const purchaseContent = document.getElementById('purchaseContent');

const eventTitle = document.getElementById('eventTitle');
const eventDate = document.getElementById('eventDate');
const eventLocation = document.getElementById('eventLocation');
const eventPrice = document.getElementById('eventPrice');

const quantityDisplay = document.getElementById('quantityDisplay');
const maxTicketsSpan = document.getElementById('maxTickets');
const decreaseBtn = document.getElementById('decreaseBtn');
const increaseBtn = document.getElementById('increaseBtn');
const buyBtn = document.getElementById('buyBtn');

const successModal = document.getElementById('successModal');
const ticketCodeSpan = document.getElementById('ticketCode');

// --- Состояние (данные) ---
let currentEvent = null;      // Объект с данными о мероприятии
let quantity = 1;            // Текущее выбранное количество
let maxAvailable = 0;        // Максимальное количество билетов

// --- Вспомогательная функция: показать ошибку ---
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingMessage.style.display = 'none';
}

// --- 1. Загрузка данных о мероприятии ---
async function loadEvent() {
    // Берём ID мероприятия из URL: /event/XXXXX/tickets
    const pathParts = window.location.pathname.split('/');
    const eventId = pathParts[2]; // Например, "9WA546I3"

    if (!eventId) {
        showError('ID мероприятия не указан');
        return;
    }

    try {
        // Запрос к новому API
        const response = await fetch(`/api/events/id/${eventId}`);
        const data = await response.json();

        if (data.status !== 'success' || !data.event) {
            showError(data.message || 'Мероприятие не найдено');
            return;
        }

        // Сохраняем данные
        currentEvent = data.event;
        displayEventInfo();
        loadingMessage.style.display = 'none';
        purchaseContent.style.display = 'block';

    } catch (error) {
        console.error('Ошибка загрузки:', error);
        showError('Не удалось загрузить информацию о мероприятии');
    }
}

// --- 2. Отображение информации о мероприятии ---
function displayEventInfo() {
    if (!currentEvent) return;

    eventTitle.textContent = currentEvent.title;

    // Форматируем дату
    const dateObj = new Date(currentEvent.date);
    eventDate.textContent = `Дата: ${dateObj.toLocaleDateString('ru-RU')} в ${currentEvent.time}`;

    eventLocation.textContent = `Место: ${currentEvent.venue}, ${currentEvent.city}`;

    // Цена: берём из freeSeating, если есть
    const price = currentEvent.freeSeating?.price || currentEvent.price || 0;
    eventPrice.textContent = `Цена: ${price} тг.`;

    // Доступное количество
    maxAvailable = currentEvent.ticketsAvailable || currentEvent.capacity || 0;
    maxTicketsSpan.textContent = maxAvailable;

    // Обновляем кнопки и количество
    updateUI();
}

// --- 3. Управление количеством ---
function updateQuantity(newValue) {
    // Ограничиваем от 1 до maxAvailable
    if (newValue < 1) return;
    if (maxAvailable > 0 && newValue > maxAvailable) {
        alert(`Доступно только ${maxAvailable} билетов`);
        return;
    }
    quantity = newValue;
    quantityDisplay.textContent = quantity;
    updateUI();
}

// --- 4. Обновление интерфейса (кнопка, сообщения) ---
function updateUI() {
    // Блокируем кнопку, если нет авторизации или нет билетов
    if (!auth.isAuthenticated()) {
        buyBtn.textContent = 'Войдите, чтобы купить';
        buyBtn.disabled = true;
        return;
    }

    if (maxAvailable <= 0) {
        buyBtn.textContent = 'Билеты закончились';
        buyBtn.disabled = true;
        return;
    }

    buyBtn.textContent = `Купить ${quantity} билет(ов)`;
    buyBtn.disabled = false;
}

// --- 5. Покупка билета ---
async function purchaseTicket() {
    // Проверка авторизации
    if (!auth.isAuthenticated()) {
        alert('Пожалуйста, войдите в систему');
        return;
    }

    // Проверка количества
    if (quantity < 1) {
        alert('Выберите хотя бы 1 билет');
        return;
    }

    if (quantity > maxAvailable) {
        alert(`Доступно только ${maxAvailable} билетов`);
        return;
    }

    // Блокируем кнопку на время запроса
    buyBtn.disabled = true;
    buyBtn.textContent = 'Оформление...';

    try {
        // Отправляем запрос на новый API
        const response = await fetch('/api/tickets/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({
                eventId: currentEvent._id,
                quantity: quantity
                // zoneId и zoneName не отправляем — они не нужны
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Показываем модалку с кодом билета
            const ticket = result.tickets[0];
            ticketCodeSpan.textContent = ticket.code;
            successModal.style.display = 'flex';
        } else {
            alert('Ошибка покупки: ' + (result.message || 'Неизвестная ошибка'));
        }

    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка сети при покупке');
    } finally {
        // Разблокируем кнопку
        buyBtn.disabled = false;
        buyBtn.textContent = `Купить ${quantity} билет(ов)`;
    }
}

// --- 6. Обработчики событий ---
// Увеличить/уменьшить количество
decreaseBtn.addEventListener('click', () => updateQuantity(quantity - 1));
increaseBtn.addEventListener('click', () => updateQuantity(quantity + 1));

// Кнопка "Купить"
buyBtn.addEventListener('click', purchaseTicket);

// Закрыть модалку по клику вне её
successModal.addEventListener('click', (e) => {
    if (e.target === successModal) {
        successModal.style.display = 'none';
        window.location.href = '/';
    }
});

// --- 7. Запуск ---
// Инициализируем auth
auth.init();

// Проверяем авторизацию для UI
if (auth.isAuthenticated()) {
    updateUI();
} else {
    // Если не авторизован — показываем кнопку входа
    buyBtn.textContent = 'Войдите, чтобы купить';
    buyBtn.disabled = true;
}

// Загружаем мероприятие
loadEvent();