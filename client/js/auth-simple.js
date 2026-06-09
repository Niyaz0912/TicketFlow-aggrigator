// Простая система аутентификации для страницы сканирования
class AuthSimple {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user')) || null;
    }

    isAuthenticated() {
        return !!this.token;
    }

    isAdmin() {
        return this.user && this.user.isAdmin;
    }

    async checkAdmin() {
        if (!this.isAuthenticated()) {
            return false;
        }

        try {
            const response = await fetch('/api/check-admin', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            return data.status === 'success' && data.isAdmin;
        } catch (error) {
            console.error('Ошибка проверки прав:', error);
            return false;
        }
    }

    async checkOrganizer() {
        if (!this.isAuthenticated()) {
            return false;
        }

        try {
            const response = await fetch('/api/events/my', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            return data.status === 'success' && data.events && data.events.length > 0;
        } catch (error) {
            console.error('Ошибка проверки мероприятий:', error);
            return false;
        }
    }
}

// Создаем глобальный экземпляр
const authSimple = new AuthSimple();