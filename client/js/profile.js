// Основной класс для управления профилем
class ProfileManager {
    constructor() {
        this.auth = null;
        this.userData = null;
        this.init();
    }

    async init() {
        // Инициализируем auth
        if (typeof Auth !== 'undefined') {
            this.auth = new Auth();
        } else {
            // Fallback
            this.auth = {
                isAuthenticated: () => !!localStorage.getItem('token'),
                token: localStorage.getItem('token'),
                user: JSON.parse(localStorage.getItem('user') || '{}'),
                logout: () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/';
                }
            };
        }

        await this.checkAuth();
        this.setupEventListeners();
        await this.loadUserData();
        await this.loadUserStats();
        this.setupTabs();
    }

    async checkAuth() {
        const authRequired = document.getElementById('authRequired');
        const profileContent = document.getElementById('profileContent');

        if (!this.auth.isAuthenticated()) {
            authRequired.style.display = 'block';
            profileContent.style.display = 'none';
            return false;
        }

        authRequired.style.display = 'none';
        profileContent.style.display = 'block';
        return true;
    }

    setupEventListeners() {
        // Обработчики форм
        document.getElementById('personalForm')?.addEventListener('submit', (e) => this.handlePersonalSubmit(e));
        document.getElementById('passwordForm')?.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
        document.getElementById('addressForm')?.addEventListener('submit', (e) => this.handleAddressSubmit(e));

        // Навигация
        const backBtn = document.querySelector('nav a[onclick*="back"]');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.history.back();
            });
        }
    }

    setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Деактивируем все кнопки и контенты
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // Активируем текущие
                button.classList.add('active');
                document.getElementById(`tab-${tabId}`).classList.add('active');
            });
        });
    }

    async loadUserData() {
        try {
            const response = await fetch('/api/user/profile', {
                headers: {
                    'Authorization': `Bearer ${this.auth.token}`
                }
            });

            if (response.status === 401) {
                this.showAlert('Сессия истекла. Пожалуйста, войдите снова.', 'error');
                setTimeout(() => this.auth.logout(), 2000);
                return;
            }

            if (!response.ok) {
                throw new Error('Ошибка загрузки данных профиля');
            }

            const data = await response.json();
            
            if (data.status === 'success') {
                this.userData = data.user;
                this.populateForms();
                this.updateAvatar();
            }
        } catch (error) {
            console.error('Ошибка загрузки данных пользователя:', error);
            this.showAlert('Не удалось загрузить данные профиля', 'error');
        }
    }

    async loadUserStats() {
        try {
            const response = await fetch('/api/user/stats', {
                headers: {
                    'Authorization': `Bearer ${this.auth.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    this.updateStats(data.stats);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    populateForms() {
        if (!this.userData) return;

        // Заполняем форму личных данных
        const nameParts = this.userData.name?.split(' ') || [];
        document.getElementById('firstName').value = nameParts[0] || '';
        document.getElementById('lastName').value = nameParts.slice(1).join(' ') || '';
        document.getElementById('email').value = this.userData.email || '';
        document.getElementById('phone').value = this.userData.phone || '';

        // Заполняем форму адреса
        if (this.userData.address) {
            document.getElementById('country').value = this.userData.address.country || 'Россия';
            document.getElementById('city').value = this.userData.address.city || '';
            document.getElementById('street').value = this.userData.address.street || '';
            document.getElementById('postalCode').value = this.userData.address.postalCode || '';
            document.getElementById('apartment').value = this.userData.address.apartment || '';
        }
    }

    updateAvatar() {
        const avatar = document.getElementById('userAvatar');
        if (avatar && this.userData?.name) {
            avatar.textContent = this.userData.name.charAt(0).toUpperCase();
        }
    }

    updateStats(stats) {
        document.getElementById('ticketsCount').textContent = stats.ticketsCount || 0;
        document.getElementById('eventsCount').textContent = stats.eventsCount || 0;
        document.getElementById('spentAmount').textContent = `${stats.totalSpent || 0} ₽`;
    }

    async handlePersonalSubmit(e) {
        e.preventDefault();
        
        const formData = {
            name: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`.trim(),
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value
        };

        await this.updateProfile(formData, 'personal');
    }

    async handlePasswordSubmit(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            this.showAlert('Новые пароли не совпадают', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showAlert('Пароль должен содержать минимум 6 символов', 'error');
            return;
        }

        const formData = {
            currentPassword,
            newPassword
        };

        await this.updateProfile(formData, 'password');
    }

    async handleAddressSubmit(e) {
        e.preventDefault();
        
        const formData = {
            address: {
                country: document.getElementById('country').value,
                city: document.getElementById('city').value,
                street: document.getElementById('street').value,
                postalCode: document.getElementById('postalCode').value,
                apartment: document.getElementById('apartment').value
            }
        };

        await this.updateProfile(formData, 'address');
    }

    async updateProfile(data, type) {
        try {
            const response = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.token}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.showAlert(this.getSuccessMessage(type), 'success');
                
                // Обновляем данные пользователя
                if (result.user) {
                    this.userData = { ...this.userData, ...result.user };
                    localStorage.setItem('user', JSON.stringify(result.user));
                    
                    if (type === 'personal') {
                        this.updateAvatar();
                    }
                    
                    // Очищаем форму пароля
                    if (type === 'password') {
                        document.getElementById('passwordForm').reset();
                    }
                }
            } else {
                this.showAlert(result.message || 'Ошибка обновления', 'error');
            }
        } catch (error) {
            console.error('Ошибка обновления профиля:', error);
            this.showAlert('Ошибка соединения с сервером', 'error');
        }
    }

    getSuccessMessage(type) {
        const messages = {
            personal: 'Личные данные успешно обновлены',
            password: 'Пароль успешно изменен',
            address: 'Адрес успешно сохранен'
        };
        return messages[type] || 'Данные успешно обновлены';
    }

    showAlert(message, type) {
        const alertDiv = type === 'success' ? 
            document.getElementById('alertSuccess') : 
            document.getElementById('alertError');
        
        alertDiv.textContent = message;
        alertDiv.style.display = 'block';
        
        // Скрываем через 5 секунд
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
}

// Глобальные функции
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function showDeleteConfirm() {
    document.getElementById('deleteModal').style.display = 'flex';
}

function hideDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

async function deleteAccount() {
    try {
        const response = await fetch('/api/user/profile', {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        
        if (data.status === 'success') {
            alert('Аккаунт успешно удален');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/';
        } else {
            alert('Ошибка: ' + data.message);
        }
    } catch (error) {
        console.error('Ошибка удаления аккаунта:', error);
        alert('Ошибка удаления аккаунта');
    }
}

// Инициализация
let profileManager;
document.addEventListener('DOMContentLoaded', () => {
    profileManager = new ProfileManager();
});