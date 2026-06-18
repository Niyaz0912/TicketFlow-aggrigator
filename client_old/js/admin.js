// Главный скрипт админ панели
class AdminPanel {
    constructor() {
        this.currentPage = {
            tickets: 1,
            limit: 20
        };
        this.init();
    }

    async init() {
        // Проверяем авторизацию и права
        if (!auth.isAuthenticated() || !auth.isAdmin()) {
            alert('Недостаточно прав для доступа к админ панели');
            window.location.href = '/';
            return;
        }

        this.setupEventListeners();
        await this.loadStats();
        await this.loadEvents();
        await this.loadTickets();
        await this.loadUsers();
    }

    setupEventListeners() {
        // Навигация по разделам
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');
                this.showSection(section);
            });
        });

        // Выход
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
            window.location.href = '/';
        });
    }

    showSection(section) {
        // Активная кнопка
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');

        // Активная секция
        document.querySelectorAll('.admin-section').forEach(sec => {
            sec.classList.remove('active');
        });
        document.getElementById(`section-${section}`).classList.add('active');
    }

    async loadStats() {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки статистики');

            const data = await response.json();

            if (data.status === 'success') {
                this.displayStats(data.stats);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    displayStats(stats) {
        document.getElementById('statEvents').textContent = stats.totalEvents;
        document.getElementById('statTickets').textContent = stats.totalTickets;
        document.getElementById('statRevenue').textContent = `${stats.totalRevenue} тг.`;
        document.getElementById('statUsers').textContent = stats.totalUsers;
    }

    async loadEvents() {
        try {
            const response = await fetch('/api/admin/events', {
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки мероприятий');

            const data = await response.json();

            if (data.status === 'success') {
                this.displayEvents(data.events);
            }
        } catch (error) {
            console.error('Ошибка загрузки мероприятий:', error);
        }
    }

    displayEvents(events) {
        const tbody = document.getElementById('eventsTableBody');
        
        if (events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">Мероприятий нет</td></tr>';
            return;
        }

        tbody.innerHTML = events.map(event => {
            const date = new Date(event.date).toLocaleDateString('ru-RU');
            const ticketsSold = event.capacity - (event.ticketsAvailable || event.capacity);
            
            return `
                <tr>
                    <td>${event.title}</td>
                    <td>${date} ${event.time}</td>
                    <td>${event.venue}, ${event.city}</td>
                    <td>${event.price} тг.</td>
                    <td>${ticketsSold}/${event.capacity}</td>
                    <td>${event.createdBy?.name || 'Неизвестно'}</td>
                    <td>
                        <button class="btn-danger" onclick="admin.deleteEvent('${event._id}')">
                            <i class="fas fa-trash"></i> Удалить
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadTickets(page = 1) {
        try {
            const status = document.getElementById('ticketStatusFilter').value;
            const response = await fetch(`/api/admin/tickets?page=${page}&limit=${this.currentPage.limit}&status=${status}`, {
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки билетов');

            const data = await response.json();

            if (data.status === 'success') {
                this.displayTickets(data.tickets, data.totalPages, data.currentPage, data.total);
            }
        } catch (error) {
            console.error('Ошибка загрузки билетов:', error);
        }
    }

    displayTickets(tickets, totalPages, currentPage, total) {
        const tbody = document.getElementById('ticketsTableBody');
        
        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7">Билетов нет</td></tr>';
            return;
        }

        tbody.innerHTML = tickets.map(ticket => {
            const purchaseDate = new Date(ticket.purchaseDate).toLocaleDateString('ru-RU');
            const eventDate = ticket.event?.date ? new Date(ticket.event.date).toLocaleDateString('ru-RU') : 'N/A';
            
            return `
                <tr>
                    <td>${ticket.code}</td>
                    <td>${ticket.event?.title || 'N/A'} (${eventDate})</td>
                    <td>${ticket.user?.name || 'N/A'}<br><small>${ticket.user?.email || ''}</small></td>
                    <td>${ticket.price} тг.</td>
                    <td>
                        <span class="status-badge status-${ticket.status.toLowerCase()}">
                            ${ticket.status}
                        </span>
                    </td>
                    <td>${purchaseDate}</td>
                    <td>
                        <select onchange="admin.changeTicketStatus('${ticket._id}', this.value)">
                            <option value="Активен" ${ticket.status === 'Активен' ? 'selected' : ''}>Активен</option>
                            <option value="Использован" ${ticket.status === 'Использован' ? 'selected' : ''}>Использован</option>
                            <option value="Недействителен" ${ticket.status === 'Недействителен' ? 'selected' : ''}>Недействителен</option>
                        </select>
                    </td>
                </tr>
            `;
        }).join('');

        this.createPagination(totalPages, currentPage);
    }

    createPagination(totalPages, currentPage) {
        const pagination = document.getElementById('ticketsPagination');
        let html = '';

        for (let i = 1; i <= totalPages; i++) {
            html += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="admin.loadTickets(${i})">
                    ${i}
                </button>
            `;
        }

        pagination.innerHTML = html;
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });

            if (!response.ok) throw new Error('Ошибка загрузки пользователей');

            const data = await response.json();

            if (data.status === 'success') {
                this.displayUsers(data.users);
            }
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    }

    displayUsers(users) {
        const tbody = document.getElementById('usersTableBody');
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">Пользователей нет</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(user => {
            const registerDate = new Date(user.createdAt).toLocaleDateString('ru-RU');
            
            return `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.isAdmin ? 'Администратор' : 'Пользователь'}</td>
                    <td>${registerDate}</td>
                    <td>${user.ticketsCount || 0}</td>
                </tr>
            `;
        }).join('');
    }

    async deleteEvent(eventId) {
        if (!confirm('Вы уверены, что хотите удалить это мероприятие?')) return;

        try {
            const response = await fetch('/api/admin/events/deletion/:eventId', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${auth.token}`
                }
            });

            const data = await response.json();

            if (data.status === 'success') {
                alert('Мероприятие успешно удалено');
                this.loadEvents();
            } else {
                alert('Ошибка: ' + data.message);
            }
        } catch (error) {
            console.error('Ошибка удаления мероприятия:', error);
            alert('Ошибка при удалении мероприятия');
        }
    }

    async changeTicketStatus(ticketId, status) {
        try {
            const response = await fetch(`/api/admin/tickets/${ticketId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.token}`
                },
                body: JSON.stringify({ status })
            });

            const data = await response.json();

            if (data.status === 'success') {
                console.log('Статус билета обновлен');
            } else {
                alert('Ошибка: ' + data.message);
            }
        } catch (error) {
            console.error('Ошибка изменения статуса:', error);
            alert('Ошибка при изменении статуса');
        }
    }
}

// Глобальные функции
window.loadStats = function() {
    admin.loadStats();
};

window.loadTickets = function(page = 1) {
    admin.loadTickets(page);
};

// Инициализация админ панели
let admin;
document.addEventListener('DOMContentLoaded', function() {
    admin = new AdminPanel();
});
async function loadOverallTicketsCount() {
      try {
        const res = await fetch("/tickets-count");       // обращаемся к серверу
        const data = await res.json();          // получаем JSON
        document.getElementById("totalTickets").textContent = data.count; // вставляем число
      } catch (err) {
        document.getElementById("totalTickets").textContent = "Ошибка загрузки";
      }
    }
    async function loadActiveTicketsCount() {
      try {
        const res = await fetch("/active-tickets-count");       // обращаемся к серверу
        const data = await res.json();          // получаем JSON
        document.getElementById("activeTickets").textContent = data.count; // вставляем число
      } catch (err) {
        document.getElementById("activeTickets").textContent = "Ошибка загрузки";
      }
    }
    async function loadUsedTicketsCount() {
      try {
        const res = await fetch("/used-tickets-count");       // обращаемся к серверу
        const data = await res.json();          // получаем JSON
        document.getElementById("usedTickets").textContent = data.count; // вставляем число
      } catch (err) {
        document.getElementById("usedTickets").textContent = "Ошибка загрузки";
      }
    }

    async function loadTotalEventsCount() {
      try {
        const res = await fetch("/events-count");       // обращаемся к серверу
        const data = await res.json();          // получаем JSON
        document.getElementById("statEvents").textContent = data.count; // вставляем число
      } catch (err) {
        document.getElementById("statEvents").textContent = "Ошибка загрузки";
      }
    }

    document.getElementById("ticketSearch").addEventListener("keyup", function() {
  let filter = this.value.toLowerCase();
  let rows = document.querySelectorAll("#ticketsTableBody tr");

  rows.forEach(row => {
    let text = row.innerText.toLowerCase();
    row.style.display = text.includes(filter) ? "" : "none";
  });
});
    loadTotalEventsCount();
    loadUsedTicketsCount();
    loadOverallTicketsCount();
    loadActiveTicketsCount();