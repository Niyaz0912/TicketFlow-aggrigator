document.addEventListener('DOMContentLoaded', function() {
  // Инициализация приложения
  initApp();
});

async function initApp() {
  
  // Проверка авторизации
  const authCheck = await auth.checkAuth();
  if (authCheck.success) {
    notifications.success('Добро пожаловать!', `Вы вошли как ${authCheck.user.name}`);
  }
  
  updateUI();
   setupEventFilters();

  
  // Загрузка мероприятий
  await loadEvents();
  
  // Назначение обработчиков событий
  setupEventListeners();
  setupZonesSystem();
}

function updateUI() {
  const authButtons = document.getElementById('authButtons');
  const userMenu = document.getElementById('userMenu');
  const userName = document.getElementById('userName');
  const dropdownName = document.getElementById('dropdownName');
  const dropdownRole = document.getElementById('dropdownRole');
  const userAvatar = document.getElementById('userAvatar');
  const adminLink = document.getElementById('adminLink');
  const tickets = document.getElementById('my-tickets');
  const createEventBtn = document.getElementById('createEventBtn');
   const scanQrBtn = document.getElementById('scanQrBtn');

  if (auth.isAuthenticated()) {
        // Пользователь авторизован
        authButtons.style.display = 'none';
        userMenu.style.display = 'flex';
        createEventBtn.style.display = 'none';
        userName.textContent = auth.user.name;
        dropdownName.textContent = auth.user.name;
        dropdownRole.textContent = auth.isAdmin() ? 'Администратор' : 'Пользователь';
        userAvatar.textContent = auth.user.name.charAt(0).toUpperCase();
        scanQrBtn.style.display = 'none';
        
        // Показываем/скрываем кнопки в зависимости от роли
        if (auth.isAdmin()) {
            adminLink.style.display = 'block';
            createEventBtn.style.display = 'block';
            scanQrBtn.style.display = 'flex'; // Показываем кнопку сканирования
        } else {
            adminLink.style.display = 'none';

        }
    } else {
        // Пользователь не авторизован
        authButtons.style.display = 'flex';
        userMenu.style.display = 'none';
        createEventBtn.style.display = 'none';

    }
}

function updateNavigation() {
  const nav = document.querySelector('nav ul');
  if (!nav) return;
  
  nav.innerHTML = `
    <li><a href="#" data-page="events">Все мероприятия</a></li>
    <li><a href="#" data-page="concerts">Концерты</a></li>
    <li><a href="#" data-page="theater">Театр</a></li>
    <li><a href="#" data-page="sports">Спорт</a></li>
    ${auth.isAuthenticated() ? `
      <li><a href="#" data-page="my-tickets" id="my-tickets" onclick="window.location.href='/my-tickets'">Мои билеты</a></li>
      <li><a href="#" data-page="my-events">Мои мероприятия</a></li>
    ` : ''}
  `;
}

async function loadEvents() {
  const result = await eventsManager.getAllEvents();
  
  if (result.success) {
    displayEvents(result.events);
  } else {
    notifications.error('Ошибка', 'Не удалось загрузить мероприятия');
  }
}


function setupEventListeners() {
  const adminLink = document.getElementById('adminLink');
  if (adminLink) {
    adminLink.addEventListener('click', function(e) {
      e.preventDefault();
      navigateToAdminPanel();
    });
  }

  // Обработчики для форм авторизации
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  
  // Обработчики для модальных окон
  document.getElementById('openLogin')?.addEventListener('click', openLoginModal);
  document.getElementById('openRegister')?.addEventListener('click', openRegisterModal);
  document.getElementById('closeLogin')?.addEventListener('click', closeLoginModal);
 const switchToRegisterBtn = document.getElementById('switchToRegister');
  if (switchToRegisterBtn) {
    switchToRegisterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchToTab('register');
    });
}
 const switchToLoginBtn = document.getElementById('switchToLogin');
  if (switchToLoginBtn) {
    switchToLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchToTab('login');
    });
  }
  
  // Обработчики для пользовательского меню
  document.getElementById('userAvatar')?.addEventListener('click', toggleUserDropdown);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  
  // Обработчик для создания мероприятия
  document.getElementById('createEventBtn')?.addEventListener('click', handleCreateEvent);
  document.getElementById('create-event-form')?.addEventListener('submit', handleEventCreation);
  
  // Обработчики для навигации
  document.querySelectorAll('nav a, .user-dropdown a').forEach(link => {
    link.addEventListener('click', handleNavigation);
  });
  
  // Закрытие dropdown при клике вне его
  document.addEventListener('click', closeDropdowns);
}

// В функции handleLogin добавляем обработку redirect
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const result = await auth.login(email, password);
    
    if (result.success) {
        notifications.success('Успешный вход', 'Вы успешно вошли в систему!');
        updateUI();
        closeLoginModal();
        await loadEvents();
        
        // Проверяем, есть ли редирект после входа
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        
        if (redirect === 'scan-qr') {
            // Переходим на страницу сканирования после входа
            window.location.href = '/scan-qr';
        }
        
        // Проверяем, есть ли отложенная покупка
        const pendingEventId = localStorage.getItem('pendingEventPurchase');
        if (pendingEventId) {
            localStorage.removeItem('pendingEventPurchase');
            
            // Показываем диалог покупки
            const quantity = parseInt(prompt('Сколько билетов вы хотите приобрести?', '1') || '1');
            if (!isNaN(quantity) && quantity > 0) {
                await purchaseTicketsWithUI(pendingEventId, quantity);
            }
        }
    } else {
        notifications.error('Ошибка входа', result.message);
    }
}





// Обновляем функцию navigateToAdminPanel
function navigateToAdminPanel() {
  if (!auth.isAuthenticated()) {
    notifications.warning('Требуется авторизация', 'Для доступа к админ панели необходимо войти в систему');
    openLoginModal();
    return;
  }
  
  if (!auth.isAdmin()) {
    notifications.error('Ошибка доступа', 'Недостаточно прав для доступа к админ панели');
    return;
  }
  
  // Переходим на страницу админки с токеном в URL
  window.location.href = `/admin?token=${encodeURIComponent(auth.token)}`;
}
// Функция для обработки покупки билета
function handleTicketPurchase(eventId) {
  if (!eventId) {
    notifications.error('Ошибка', 'Не удалось определить мероприятие');
    return;
  }
  
  // Проверяем авторизацию
  if (!auth.isAuthenticated()) {
    notifications.warning('Требуется авторизация', 'Для покупки билетов необходимо войти в систему');
    
    // Сохраняем ID мероприятия для покупки после авторизации
    localStorage.setItem('pendingEventPurchase', eventId);
    
    // Показываем модальное окно входа
    openLoginModal();
    return;
  }
  
  // Переходим на страницу покупки билета
  window.location.href = `/event/${eventId}/tickets`;
}


// Функция для добавления обработчиков на кнопки покупки
function addBookButtonHandlers() {
  const bookButtons = document.querySelectorAll('.book-btn');
  
  bookButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Находим ближайшую карточку мероприятия
      const eventCard = this.closest('.event-card');
      if (!eventCard) {
        notifications.error('Ошибка', 'Не удалось определить мероприятие');
        return;
      }
      
      // Получаем ID мероприятия из data-атрибута
      const eventId = eventCard.getAttribute('data-event-id');
      handleTicketPurchase(eventId);
    });
  });
}





function displayEvents(events) {
  const eventsGrid = document.querySelector('.events-grid');
  if (!eventsGrid) return;
  
  eventsGrid.innerHTML = '';
  
  if (events.length === 0) {
    eventsGrid.innerHTML = '<p class="no-events">Мероприятий пока нет</p>';
    return;
  }
  
  events.forEach(event => {
    const eventDate = new Date(event.date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    // Определяем минимальную цену в зависимости от структуры данных
    let minPrice = 0;
    
    if (event.seatingType === 'free' && event.freeSeating) {
      minPrice = event.freeSeating.price || 0;
    } else if (event.seatingType === 'zones' && event.zones && event.zones.length > 0) {
      // Находим минимальную цену среди всех зон
      const prices = event.zones.map(zone => zone.price).filter(price => price > 0);
      minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    }
    
    const eventCard = document.createElement('div');
    eventCard.className = 'event-card';
    eventCard.innerHTML = `
      <div class="event-image" style="background-color: #8338ec; background-image: url('${event.image}'); background-size: cover;">
        ${event.image ? '' : 'Изображение мероприятия'}
      </div>
      <div class="event-details">
        <div class="event-date">${eventDate}, ${event.time}</div>
        <h3 class="event-title">${event.title}</h3>
        <div class="event-location">${event.city}, ${event.venue}</div>
        <div class="event-price">от ${minPrice.toLocaleString('ru-RU')} тг.</div>
        <div class="event-id">ID: ${event.eventId}</div>
        <button class="book-btn" data-event-id="${event.eventId}">
          Купить билет
        </button>
      </div>
    `;
    
    eventsGrid.appendChild(eventCard);
  });
  
  // Добавляем обработчики для всех кнопок покупки
  addBookButtonHandlers();
}

// Обработчик для кнопки сканирования QR
// Обработчик для кнопки сканирования QR
function setupScanQrButton() {
  const scanQrBtn = document.getElementById('scanQrBtn');
  if (scanQrBtn) {
    scanQrBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      // Проверяем авторизацию
      if (!auth.isAuthenticated()) {
        notifications.warning('Требуется авторизация', 'Для сканирования QR-кодов необходимо войти в систему');
        openLoginModal();
        
        // Сохраняем информацию о том, куда нужно перенаправить после входа
        localStorage.setItem('afterLoginRedirect', 'scan-qr');
        return;
      }
      
      // Проверяем права доступа
      try {
        const response = await fetch('/api/check-admin', {
          headers: {
            'Authorization': `Bearer ${auth.token}`
          }
        });
        
        const data = await response.json();
        
        if (data.status === 'success' && data.isAdmin) {
          // Администратор - переходим на страницу сканирования
          window.location.href = '/scan-qr';
          return;
        }
        
        // Проверяем, является ли пользователь организатором
        const eventsResponse = await fetch('/api/events/my', {
          headers: {
            'Authorization': `Bearer ${auth.token}`
          }
        });
        
        const eventsData = await eventsResponse.json();
        
        if (eventsData.status === 'success' && eventsData.events.length > 0) {
          // Организатор - переходим на страницу сканирования
          window.location.href = '/scan-qr';
        } else {
          notifications.error('Доступ запрещен', 'Только администраторы и организаторы мероприятий могут сканировать QR-коды');
        }
      } catch (error) {
        console.error('Ошибка проверки прав:', error);
        notifications.error('Ошибка', 'Не удалось проверить права доступа');
      }
    });
  }
}


// Функции для фильтрации и сортировки
function setupEventFilters() {
  const filtersContainer = document.createElement('div');
  filtersContainer.className = 'events-filters';
  filtersContainer.innerHTML = `
    <div class="filter-group">
      <button class="filter-btn active" data-filter="all">Все</button>
      <button class="filter-btn" data-filter="upcoming">Предстоящие</button>
      <button class="filter-btn" data-filter="past">Прошедшие</button>
      <button class="filter-btn" data-filter="concerts">Концерты</button>
      <button class="filter-btn" data-filter="theater">Театр</button>
    </div>
    <div class="sort-group">
      <select class="sort-select" id="eventsSort">
        <option value="date-asc">По дате (сначала ближайшие)</option>
        <option value="date-desc">По дате (сначала дальние)</option>
        <option value="price-asc">По цене (дешевые first)</option>
        <option value="price-desc">По цене (дорогие first)</option>
        <option value="newest">Сначала новые</option>
      </select>
    </div>
  `;

  // Вставляем перед сеткой мероприятий
  const eventsGrid = document.querySelector('.events-grid');
  if (eventsGrid && eventsGrid.parentNode) {
    eventsGrid.parentNode.insertBefore(filtersContainer, eventsGrid);
  }

  // Добавляем обработчики
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      applyFilters(this.dataset.filter);
    });
  });

  document.getElementById('eventsSort').addEventListener('change', function() {
    applySorting(this.value);
  });
}

// Применение фильтров
function applyFilters(filterType) {
  // В реальном приложении здесь бы был запрос к серверу
  // Для демо просто скрываем/показываем карточки
  const eventCards = document.querySelectorAll('.event-card');
  const now = new Date();
  
  eventCards.forEach(card => {
    const eventDate = new Date(card.querySelector('.event-date').textContent.split(' в ')[0]);
    const eventType = card.querySelector('.event-title').textContent.toLowerCase();
    
    let shouldShow = true;
    
    switch (filterType) {
      case 'upcoming':
        shouldShow = eventDate >= now;
        break;
      case 'past':
        shouldShow = eventDate < now;
        break;
      case 'concerts':
        shouldShow = eventType.includes('концерт') || eventType.includes('concert');
        break;
      case 'theater':
        shouldShow = eventType.includes('театр') || eventType.includes('theater') || eventType.includes('ballet');
        break;
      default:
        shouldShow = true;
    }
    
    card.style.display = shouldShow ? 'block' : 'none';
  });
}

// Применение сортировки
function applySorting(sortType) {
  const eventsGrid = document.querySelector('.events-grid');
  const eventCards = Array.from(eventsGrid.querySelectorAll('.event-card'));
  
  eventCards.sort((a, b) => {
    const aDate = new Date(a.querySelector('.event-date').textContent.split(' в ')[0]);
    const bDate = new Date(b.querySelector('.event-date').textContent.split(' в ')[0]);
    const aPrice = parseInt(a.querySelector('.event-price').textContent.replace(/\D/g, ''));
    const bPrice = parseInt(b.querySelector('.event-price').textContent.replace(/\D/g, ''));
    
    switch (sortType) {
      case 'date-asc':
        return aDate - bDate;
      case 'date-desc':
        return bDate - aDate;
      case 'price-asc':
        return aPrice - bPrice;
      case 'price-desc':
        return bPrice - aPrice;
      case 'newest':
        return b.dataset.created - a.dataset.created;
      default:
        return 0;
    }
  });
  
  // Очищаем и переставляем карточки
  eventsGrid.innerHTML = '';
  eventCards.forEach(card => eventsGrid.appendChild(card));
}





// Обновляем все функции для использования apiFetch
// Загрузка мероприятий
async function loadEvents() {
  try {
    console.log('Загрузка мероприятий...');
    
    // Загружаем популярные мероприятия для главной страницы
    const response = await fetch('/api/events/popular');
    const result = await response.json();
    
    if (result.status === 'success') {
      displayEvents(result.events);
    } else {
      console.error('Ошибка загрузки мероприятий:', result.message);
      notifications.error('Ошибка', 'Не удалось загрузить мероприятия');
      
      // Показываем заглушку
      showEmptyEventsState();
    }
  } catch (error) {
    console.error('Ошибка сети при загрузке мероприятий:', error);
    notifications.error('Ошибка', 'Не удалось загрузить мероприятия');
    showEmptyEventsState();
  }
}

async function purchaseTicketsWithUI(eventId, quantity = 1) {
    try {
        const result = await apiFetch('/api/tickets/purchase', {
            method: 'POST',
            body: JSON.stringify({
                eventId: eventId,
                quantity: quantity,
                seat: ''
            })
        });
        
        if (result && result.status === 'success') {
            showPurchaseSuccessModal(result.tickets);
            return true;
        } else if (result) {
            notifications.error('Ошибка покупки', result.message);
            return false;
        }
    } catch (error) {
        console.error('Ошибка покупки:', error);
        return false;
    }
}

// Функция для добавления обработчиков событий
function setupSeatingInputListeners() {
  // Обработчики для свободной рассадки
  const totalRowsInput = document.getElementById('totalRows');
  const seatsPerRowInput = document.getElementById('seatsPerRow');
  
  if (totalRowsInput) {
    totalRowsInput.addEventListener('input', debounce(updateHallVisualization, 300));
    totalRowsInput.addEventListener('change', updateHallVisualization);
  }
  
  if (seatsPerRowInput) {
    seatsPerRowInput.addEventListener('input', debounce(updateHallVisualization, 300));
    seatsPerRowInput.addEventListener('change', updateHallVisualization);
  }
  
}

// Функция debounce для оптимизации
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Добавляем в main.js обработчик для формы
document.getElementById('create-event-form').addEventListener('submit', function(e) {
  // Проверяем, не вызвано ли нажатием кнопки внутри конструктора
  const activeElement = document.activeElement;
  if (activeElement.closest('.seating-constructor')) {
    e.preventDefault();
    return false;
  }
});

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('registerName').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirm').value;
  const isAdmin = auth.user && auth.user.isAdmin === true;
  
  if (password !== confirm) {
    notifications.error('Ошибка регистрации', 'Пароли не совпадают!');
    return;
  }
  
  const result = await auth.register({ name, email, password, isAdmin });
  
  if (result.success) {
    notifications.success('Регистрация успешна', 'Вы успешно зарегистрировались!');
    updateUI();
    closeLoginModal();
    await loadEvents();
  } else {
    notifications.error('Ошибка регистрации', result.message);
  }
}

async function handleEventCreation(e) {
  e.preventDefault();
  
  if (!auth.isAuthenticated()) {
    notifications.warning('Требуется авторизация', 'Для создания мероприятия необходимо войти в систему!');
    openLoginModal();
    return;
  }

  // Получаем выбранный тип рассадки
  const seatingTypeElement = document.querySelector('input[name="seatingType"]:checked');
  if (!seatingTypeElement) {
    notifications.error('Ошибка', 'Выберите тип рассадки');
    return;
  }
  const seatingType = seatingTypeElement.value;
  
  const eventData = {
    title: document.getElementById('event-title').value,
    description: document.getElementById('event-description').value,
    category: document.getElementById('event-category').value,
    date: document.getElementById('event-date').value,
    time: document.getElementById('event-time').value,
    venue: document.getElementById('event-venue').value,
    address: document.getElementById('event-address').value,
    city: document.getElementById('event-city').value,
    country: document.getElementById('event-country').value,
    capacity: parseInt(document.getElementById('event-capacity').value),
    image: document.getElementById('event-image').value || '',
    seatingType: seatingType // ✅ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ДОБАВЛЯЕМ
  };

  // Добавляем endTime только если оно заполнено
  const endTime = document.getElementById('event-end-time').value;
  if (endTime) {
    eventData.endTime = endTime;
  }

  // Добавляем данные ТОЛЬКО для выбранного типа рассадки
  if (seatingType === 'zones') {
    eventData.zones = getZonesData();
    
    if (eventData.zones.length === 0) {
      notifications.error('Ошибка', 'Добавьте хотя бы одну зону для зональной рассадки');
      return;
    }
    
    // Убеждаемся, что для зональной рассадки нет freeSeating
    delete eventData.freeSeating;
    
  } else if (seatingType === 'free') {
    // Для свободной рассадки добавляем freeSeating
    const price = parseInt(document.getElementById('event-price').value) || 0;
    eventData.freeSeating = { price: price };
    
    // Убеждаемся, что для свободной рассадки нет zones
    delete eventData.zones;
  }

  console.log('Отправляемые данные на сервер:', JSON.stringify(eventData, null, 2));

  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify(eventData)
    });

    const result = await response.json();
    
    if (result.status === 'success') {
      notifications.success('Мероприятие создано', 'Ваше мероприятие успешно опубликовано!');
      document.getElementById('create-event-form').reset();
      showPage('home-page');
      await loadEvents();
    } else {
      notifications.error('Ошибка', result.message || 'Не удалось создать мероприятие');
    }
  } catch (error) {
    console.error('Ошибка при создании мероприятия:', error);
    notifications.error('Ошибка', 'Не удалось создать мероприятие');
  }
}
// // И добавляем в форму создание мероприятия скрытое поле
// const form = document.getElementById('create-event-form');
// const seatingConfigInput = document.createElement('input');
// seatingConfigInput.type = 'hidden';
// seatingConfigInput.id = 'seatingConfig';
// seatingConfigInput.name = 'seatingConfig';
// form.appendChild(seatingConfigInput);


function handleLogout(e) {
  e.preventDefault();
  const result = auth.logout();
  notifications.info('Выход из системы', result.message);
  scanQrBtn.style.display = 'none';
  updateUI();
  closeUserDropdown();
}

function openLoginModal() {
  document.getElementById('loginModal').classList.add('active');
  switchToTab('login');
}

function openRegisterModal() {
  document.getElementById('loginModal').classList.add('active');
  switchToTab('register');
}

function closeLoginModal() {
  document.getElementById('loginModal').classList.remove('active');
}

function switchToTab(tabName) {
  // Переключаем активные вкладки
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Переключаем активные формы
  document.querySelectorAll('.modal-form').forEach(form => {
    form.classList.toggle('active', form.id === `${tabName}Form`);
  });
}

function toggleUserDropdown() {
  document.getElementById('userDropdown').classList.toggle('show');
}

function closeUserDropdown() {
  document.getElementById('userDropdown').classList.remove('show');
}

function closeDropdowns(e) {
  if (!e.target.closest('.user-menu')) {
    closeUserDropdown();
  }
}

function handleCreateEvent() {
  if (!auth.isAuthenticated()) {
    notifications.warning('Требуется авторизация', 'Для создания мероприятия необходимо войти в систему!');
    openLoginModal();
    return;
  }
  
  showPage('create-event-page');
}

function handleNavigation(e) {
  e.preventDefault();
  const pageId = e.target.getAttribute('data-page') + '-page';
  showPage(pageId);
}

function addBookButtonHandlers() {
  const bookButtons = document.querySelectorAll('.book-btn');
  
  bookButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const eventId = this.getAttribute('data-event-id');
      
      if (!eventId) {
        notifications.error('Ошибка', 'Не удалось определить мероприятие');
        return;
      }
      
      // Проверяем авторизацию
      if (!auth.isAuthenticated()) {
        notifications.warning('Требуется авторизация', 'Для покупки билетов необходимо войти в систему');
        
        // Показываем модальное окно входа
        openLoginModal();
        
        // Сохраняем ID мероприятия для покупки после авторизации
        localStorage.setItem('pendingEventPurchase', eventId);
        return;
      }
      
      // Переходим на страницу покупки билета
      window.location.href = `/event/${eventId}/tickets`;
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll('.page-content').forEach(page => {
    page.classList.remove('active');
  });
  
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  } else {
    document.getElementById('home-page').classList.add('active');
  }
  
  closeUserDropdown();
  window.scrollTo(0, 0);
  
}

// Добавление новой зоны
function addNewZone() {
    const zonesList = document.getElementById('zonesList');
    const zoneId = Date.now();
    
    const zoneHtml = `
        <div class="zone-item" data-zone-id="${zoneId}">
            <div class="zone-header">
                <h5>Зона ${document.querySelectorAll('.zone-item').length + 1}</h5>
                <div class="zone-controls">
                    <button type="button" class="btn-danger" onclick="removeZone(${zoneId})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="zone-content">
                <div class="form-group">
                    <label>Название зоны</label>
                    <input type="text" class="zone-name" placeholder="Партер, Балкон и т.д." 
                           oninput="updateZoneTotal(${zoneId})">
                </div>
                <div class="form-group">
                    <label>Цена билета (тг.)</label>
                    <input type="number" class="zone-price" min="0" placeholder="5000" 
                           oninput="updateZoneTotal(${zoneId})">
                </div>
                <div class="form-group">
                    <label>Количество мест</label>
                    <input type="number" class="zone-capacity" min="1" placeholder="50" 
                           oninput="updateZoneTotal(${zoneId})">
                </div>
                <div class="form-group">
                    <label>Рядов (опционально)</label>
                    <input type="number" class="zone-rows" min="1" placeholder="5">
                </div>
                <div class="zone-total" id="zoneTotal-${zoneId}">
                    Всего: 0 мест × 0 тг. = 0 тг.
                </div>
            </div>
        </div>
    `;
    
    zonesList.insertAdjacentHTML('beforeend', zoneHtml);
    updateTotalCapacity();
}

// Управление системой зон
function setupZonesSystem() {
    const seatingTypeRadios = document.querySelectorAll('input[name="seatingType"]');
    const zonesContainer = document.getElementById('zonesContainer');
    const freeSeatingSection = document.getElementById('freeSeatingSection');
    const seatingTypeInput = document.getElementById('seatingTypeInput');
    
    seatingTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const isZones = this.value === 'zones';
            const isFree = this.value === 'free';
            
            zonesContainer.style.display = isZones ? 'block' : 'none';
            freeSeatingSection.style.display = isFree ? 'block' : 'none';
            
            // Обновляем hidden input
            if (seatingTypeInput) {
                seatingTypeInput.value = this.value;
            }
            
            // Очищаем ненужные данные
            if (isFree) {
                document.getElementById('zonesList').innerHTML = '';
            }
            if (isZones) {
                document.getElementById('event-price').value = '';
            }
            
            updateTotalCapacity();
        });
    });
    
    // Инициализация
    if (seatingTypeRadios.length > 0) {
        const initialType = document.querySelector('input[name="seatingType"]:checked').value;
        if (seatingTypeInput) {
            seatingTypeInput.value = initialType;
        }
    }
    addZoneBtn.addEventListener('click', addNewZone);
    updateTotalCapacity();

}

// Удаление зоны
function removeZone(zoneId) {
    const zoneElement = document.querySelector(`[data-zone-id="${zoneId}"]`);
    if (zoneElement && confirm('Удалить эту зону?')) {
        zoneElement.remove();
        updateTotalCapacity();
        renumberZones();
    }
}

// Обновление итогов по зоне
function updateZoneTotal(zoneId) {
    const zoneElement = document.querySelector(`[data-zone-id="${zoneId}"]`);
    const price = parseInt(zoneElement.querySelector('.zone-price').value) || 0;
    const capacity = parseInt(zoneElement.querySelector('.zone-capacity').value) || 0;
    const total = price * capacity;
    
    const totalElement = document.getElementById(`zoneTotal-${zoneId}`);
    totalElement.textContent = `Всего: ${capacity} мест × ${price} тг. = ${total.toLocaleString()} тг.`;
    
    updateTotalCapacity();

}

// Обновление общей вместимости
function updateTotalCapacity() {
    const zoneCapacities = Array.from(document.querySelectorAll('.zone-capacity'))
        .map(input => parseInt(input.value) || 0);
    
    const totalCapacity = zoneCapacities.reduce((sum, cap) => sum + cap, 0);
    document.getElementById('event-capacity').value = totalCapacity;
}

// Перенумерация зон
function renumberZones() {
    document.querySelectorAll('.zone-item').forEach((zone, index) => {
        const title = zone.querySelector('h5');
        if (title) {
            title.textContent = `Зона ${index + 1}`;
        }
    });
}

// Получение данных зон для отправки
function getZonesData() {
    const zones = [];
    
    document.querySelectorAll('.zone-item').forEach(zone => {
        const name = zone.querySelector('.zone-name').value;
        const price = parseInt(zone.querySelector('.zone-price').value);
        const capacity = parseInt(zone.querySelector('.zone-capacity').value);
        const rowsInput = zone.querySelector('.zone-rows');
        const rows = rowsInput ? parseInt(rowsInput.value) : null;
        
        if (name && !isNaN(price) && !isNaN(capacity)) {
            zones.push({
                name: name,
                price: price,
                capacity: capacity,
                rows: isNaN(rows) ? null : rows
            });
        }
    });
    
    return zones;
}