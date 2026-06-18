// Заглушка для updateMaxTickets
function updateMaxTickets() {
    const maxTicketsEl = document.getElementById("maxTickets");
    if (!maxTicketsEl) return;
    maxTicketsEl.textContent = currentEvent?.ticketsAvailable || 0;
}

// Упрощенное отображение билетов
function displayTickets(tickets) {
    const ticketsContainer = document.getElementById('tickets-container');
    const ticketsList = document.getElementById('ticketsList');
    const ticketsCount = document.getElementById('ticketsCount');

    ticketsContainer.innerHTML = '';
    tickets.forEach(ticket => {
    const eventDate = new Date(ticket.event.date).toLocaleDateString('ru-RU');
    
    const ticketElement = document.createElement('div');
    ticketElement.className = 'ticket-card';
    ticketElement.innerHTML = `
      <div class="ticket-header">
        <span class="ticket-code">${ticket.code}</span>
        <span class="ticket-status ${getStatusClass(ticket.status)}">${ticket.status}</span>
      </div>
      <div class="ticket-info">
        <h3>${ticket.event.title}</h3>
        <p><i class="fas fa-calendar"></i> ${eventDate} в ${ticket.event.time}</p>
        <p><i class="fas fa-map-marker-alt"></i> ${ticket.event.venue}, ${ticket.event.city}</p>
        <p><i class="fas fa-tag"></i> Зона: ${ticket.zoneName || ticket.zone || 'Не указана'}</p>
        ${ticket.seat ? `<p><i class="fas fa-chair"></i> Место: ${ticket.seat}</p>` : ''}
        <p><i class="fas fa-ruble-sign"></i> ${ticket.price} тг.</p>
        
        ${ticket.qrCode ? `
          <div class="ticket-qr">
            <img src="${ticket.qrCode}" alt="QR-код билета" style="max-width: 150px;">
            <p class="qr-hint">Покажите этот QR-код на входе</p>
          </div>
        ` : ''}
      </div>
      <div class="ticket-actions">
        ${ticket.qrCode ? `
          <button class="btn-secondary" onclick="downloadQRCode('${ticket._id}')">
            <i class="fas fa-download"></i> Скачать QR-код
          </button>
        ` : ''}
        ${ticket.status === 'Активен' ? `
          <button class="btn-warning" onclick="invalidateTicket('${ticket.code}')">
            <i class="fas fa-times"></i> Аннулировать
          </button>
        ` : ''}
      </div>
    `;
    
    ticketsContainer.appendChild(ticketElement);
  });
    
    console.log('Отображаем билеты:', tickets);
    
    if (!tickets || tickets.length === 0) {
        ticketsList.innerHTML = `
            <div class="no-tickets">
                <i class="fas fa-ticket-alt"></i>
                <h3>Билетов не найдено</h3>
                <p>У вас пока нет приобретенных билетов</p>
                <button class="btn btn-primary" onclick="window.location.href='/'">
                    Найти мероприятия
                </button>
                <button class="btn btn-secondary" onclick="createTestTicket()" style="margin-top: 10px;">
                    <i class="fas fa-plus"></i> Создать тестовый билет
                </button>
            </div>
        `;
        ticketsCount.textContent = 'Найдено билетов: 0';
        return;
    }
    
    ticketsCount.textContent = `Найдено билетов: ${tickets.length}`;
    
    ticketsList.innerHTML = tickets.map(ticket => {
        console.log('Обрабатываем билет:', ticket);
        
        const eventDate = ticket.event?.date ? new Date(ticket.event.date).toLocaleDateString('ru-RU') : 'Дата не указана';
        const purchaseDate = new Date(ticket.purchaseDate).toLocaleDateString('ru-RU');
        const eventTitle = ticket.event?.title || 'Мероприятие без названия';
        const eventVenue = ticket.event?.venue || 'Место не указано';
        const eventCity = ticket.event?.city ? `, ${ticket.event.city}` : '';
        const zoneInfo = ticket.zoneName || ticket.zone || 'Зона не указана';
        
        return `
            <div class="ticket-card">
                <div class="ticket-header">
                    <div class="ticket-code">${ticket.code || 'Без кода'}</div>
                    <div class="ticket-status status-${getStatusClass(ticket.status)}">
                        ${ticket.status || 'Неизвестно'}
                    </div>
                </div>
                
                <div class="ticket-info">
                    <div class="ticket-event">${eventTitle}</div>
                    
                    <div class="ticket-detail">
                        <i class="fas fa-calendar"></i>
                        <span>${eventDate} ${ticket.event?.time || ''}</span>
                    </div>
                    
                    <div class="ticket-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${eventVenue}${eventCity}</span>
                    </div>
                    
                    <div class="ticket-detail">
                        <i class="fas fa-tag"></i>
                        <span>Зона: ${zoneInfo}</span>
                    </div>
                    
                    ${ticket.seat ? `
                    <div class="ticket-detail">
                        <i class="fas fa-chair"></i>
                        <span>Место: ${ticket.seat}</span>
                    </div>
                    ` : ''}
                    
                    <div class="ticket-detail">
                        <i class="fas fa-clock"></i>
                        <span>Куплен: ${purchaseDate}</span>
                    </div>
                    
                    <div class="ticket-price">
                        ${ticket.price || 0} тг.
                    </div>
                </div>
                
                <div class="ticket-actions">
                    <button class="btn btn-primary" onclick="viewTicket('${ticket._id}')">
                        <i class="fas fa-eye"></i> Подробнее
                    </button>
                    <button class="btn btn-secondary" onclick="saveTicket('${ticket.code}')">
                        <i class="fas fa-download"></i> Сохранить
                    </button>
                </div>
            </div>
        `;
    }).join('');
}



// Функция для получения QR-кода билета
async function getTicketQRCode(ticketId) {
  try {
    const response = await fetch(`/api/tickets/${ticketId}/qrcode`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        success: true,
        qrCodeUrl: data.qrCodeUrl,
        ticket: data.ticket
      };
    } else {
      return {
        success: false,
        message: data.message
      };
    }
  } catch (error) {
    console.error('Ошибка получения QR-кода:', error);
    return {
      success: false,
      message: 'Ошибка получения QR-кода'
    };
  }
}

// Функция для сканирования QR-кода
async function scanTicketQRCode(qrData) {
  try {
    const response = await fetch('/api/tickets/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth.token}`
      },
      body: JSON.stringify({ qrData })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка сканирования QR-кода:', error);
    return {
      status: 'error',
      message: 'Ошибка сканирования QR-кода'
    };
  }
}

// Функция для проверки билета по коду
async function checkTicketByCode(ticketCode) {
  try {
    const response = await fetch(`/api/tickets/check/${ticketCode}`, {
      headers: {
        'Authorization': `Bearer ${auth.token}`
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка проверки билета:', error);
    return {
      status: 'error',
      message: 'Ошибка проверки билета'
    };
  }
}

// Простая функция покупки билетов
// Обновляем функцию покупки билетов
async function purchaseTickets() {
    console.log('Начало покупки билетов...');
    
    // Проверяем авторизацию
    if (!auth.isAuthenticated()) {
        alert('Требуется авторизация! Для покупки билетов необходимо войти в систему');
        openLoginModal();
        return;
    }

    if (!currentEvent || !currentEvent._id) {
        alert('Ошибка! Мероприятие не выбрано');
        return;
    }

    // Получаем выбранную зону
const zoneSelect = document.getElementById("ticket-zone");
const selectedZoneId = zoneSelect ? zoneSelect.value : null;
const selectedOption = zoneSelect ? zoneSelect.options[zoneSelect.selectedIndex] : null;

// Проверка зоны в зависимости от типа рассадки
if (currentEvent && currentEvent.seatingType === 'free') {
    // Для свободной рассадки зона не нужна
    console.log('Свободная рассадка, проверка зоны пропущена');
} else if (!selectedZoneId) {
    // Для зональной рассадки зона обязательна
    notifications.error('Ошибка', 'Выберите зону для покупки билетов');
    return;
}

// Проверяем доступность мест (только если есть выбор зоны)
if (selectedOption && selectedOption.dataset) {
    const availableSeats = parseInt(selectedOption.dataset.available || 0);
    if (currentQuantity > availableSeats) {
        alert(`В выбранной зоне доступно только ${availableSeats} мест(а)`);
        return;
    }
}

    // Показываем загрузку
    const purchaseBtn = document.getElementById('purchaseButton');
    const originalText = purchaseBtn.textContent;
    purchaseBtn.disabled = true;
    purchaseBtn.textContent = 'Покупка...';

    try {
        console.log('Отправка запроса на покупку...');
        
        // Подготавливаем данные с выбранной зоной
        const requestData = {
            eventId: currentEvent._id,
            quantity: currentQuantity
        };

        // Добавляем информацию о зоне ТОЛЬКО если это не свободная рассадка
        if (currentEvent.seatingType !== 'free' && selectedZoneId && selectedOption) {
            requestData.zoneId = selectedZoneId;
            requestData.zoneName = selectedOption.dataset.zoneName;
        }

        console.log('Данные для отправки:', requestData);

        const response = await fetch('/api/tickets/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify(requestData)
        });

        const result = await response.json();
        console.log('Ответ сервера:', result);

        if (result.status === 'success') {
            showPurchaseSuccess(result.tickets);
            notifications.success('Успех!', `Вы успешно приобрели ${currentQuantity} билет(ов)`);
            // Не обновляем страницу, просто показываем успех
        } else {
            alert('Ошибка покупки: ' + (result.message || 'Неизвестная ошибка'));
        }
    
        

    } catch (error) {
        console.error('Ошибка сети:', error);
        alert('Ошибка сети при покупке билетов');
    } finally {
        // Восстанавливаем кнопку
          ticketPrice = 0;
        purchaseBtn.disabled = false;
        purchaseBtn.textContent = originalText;
    }
}

// // Функция для кнопки покупки
// window.buyTickets = async function(eventId) {
//   const quantity = parseInt(prompt('Сколько билетов хотите купить?', '1') || '1');
//   if (isNaN(quantity) || quantity < 1) {
//     alert('Введите корректное количество билетов');
//     return;
//   }

//   await purchaseTickets(eventId, quantity);
// };

// WORKING VARIANT IS BELOW

// Функция показа модального окна успешной покупки
function showPurchaseSuccess(tickets) {
    if (!tickets || tickets.length === 0) {
        console.error('Нет билетов для отображения');
        return;
    }
    
    // Сохраняем купленные билеты для использования в модальном окне
    purchasedTickets = tickets;
    
    const totalPrice = tickets.reduce((sum, ticket) => sum + (ticket.price || 0), 0);
    
    // Обновляем информацию в модальном окне
    document.getElementById('purchasedTicketsCount').textContent = tickets.length;
    document.getElementById('purchasedTotalPrice').textContent = totalPrice.toLocaleString('ru-RU');
    
    // Очищаем и заполняем список кодов билетов
    const codesContainer = document.getElementById('ticketCodesPreview');
    codesContainer.innerHTML = '';
    
    tickets.forEach(ticket => {
        const codeBadge = document.createElement('span');
        codeBadge.className = 'ticket-code-badge';
        codeBadge.textContent = ticket.code;
        codeBadge.title = `Цена: ${ticket.price} тг.`;
        codesContainer.appendChild(codeBadge);
    });
    
    // Показываем модальное окно
    openPurchaseSuccessModal();
}

// Функция открытия модального окна успеха
function openPurchaseSuccessModal() {
    const modal = document.getElementById('purchaseSuccessModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Функция закрытия модального окна успеха
function closePurchaseSuccessModal() {
    const modal = document.getElementById('purchaseSuccessModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}





// Обновляем обработчик кнопок покупки
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
            
            // Запрашиваем количество билетов
            const quantity = parseInt(prompt('Сколько билетов вы хотите приобрести?', '1') || '1');
            if (isNaN(quantity) || quantity < 1) {
                notifications.error('Ошибка', 'Пожалуйста, введите корректное количество билетов');
                return;
            }
            
            purchaseTicket(eventId, quantity);
        });
    });
}