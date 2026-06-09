class Auth {
  constructor() {
    this.token = null;
    this.user = null;
    this.init();
  }

  // Инициализация при загрузке
  init() {
    this.loadFromStorage();
    this.validateToken();
  }

  // Загрузка данных из localStorage
  loadFromStorage() {
    try {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      
      if (token) {
        this.token = token;
      }
      
      if (user) {
        this.user = JSON.parse(user);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных из localStorage:', error);
      this.clearUserData();
    }
  }

// Проверка токена
  async checkAuth() {
    if (!this.token) return { success: false };
    
    try {
      const response = await fetch('/api/me', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const data = await response.json();

      if (data.status === 'success') {
        this.user = data.user;
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true, user: data.user };
      } else {
        this.clearUserData();
        return { success: false };
      }
    } catch (error) {
      this.clearUserData();
      return { success: false };
    }
  }

  // Проверка валидности токена
  async validateToken() {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          this.user = data.user;
          localStorage.setItem('user', JSON.stringify(data.user));
          return true;
        }
      }
      
      // Если токен невалидный
      this.clearUserData();
      return false;
      
    } catch (error) {
      console.error('Ошибка проверки токена:', error);
      return false;
    }
  }

  // Проверка авторизации
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  // Проверка роли администратора
  isAdmin() {
    return this.isAuthenticated() && this.user.isAdmin === true;
  }

  // Сохранение данных пользователя
  setUserData(token, user) {
    try {
      this.token = token;
      this.user = user;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Schedule token validation
      setTimeout(() => this.validateToken(), 300000); // Check every 5 minutes
      
    } catch (error) {
      console.error('Ошибка сохранения данных:', error);
    }
  }

  // Очистка данных пользователя
  clearUserData() {
    this.token = null;
    this.user = null;
    
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Ошибка очистки localStorage:', error);
    }
  }

  // Регистрация
  async register(userData) {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (data.status === 'success') {
        this.setUserData(data.token, data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      return { success: false, message: 'Ошибка сети' };
    }
  }

  // Вход
  async login(email, password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.status === 'success') {
        this.setUserData(data.token, data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      return { success: false, message: 'Ошибка сети. Попробуйте позже.' };
    }
  }

  // Проверка валидности токена
async validateToken() {
  if (!this.token) {
    return false;
  }

  try {
    const response = await fetch('/api/me', { // <-- FIXED
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        this.user = data.user;
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
      }
    }
    this.clearUserData();
    return false;
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    return false;
  }
}

  // Выход
  logout() {
    this.clearUserData();
    return { success: true, message: 'Вы вышли из системы' };
  }


  // Получение заголовков авторизации
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`
    };
  }
}



// Создаем глобальный экземпляр Auth
const auth = new Auth();