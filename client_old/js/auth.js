class Auth {
  constructor() {
    this.token = null;
    this.user = null;
    this.init();
  }

  init() {
    this.loadFromStorage();
    this.validateToken();
  }

  loadFromStorage() {
    try {
      const token = localStorage.getItem('token');
      const user = localStorage.getItem('user');
      if (token) this.token = token;
      if (user) this.user = JSON.parse(user);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      this.clearUserData();
    }
  }

  async checkAuth() {
    if (!this.token) return { success: false };
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
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

  async validateToken() {
    if (!this.token) return false;
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
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

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  isAdmin() {
    return this.isAuthenticated() && this.user?.isAdmin === true;
  }

  setUserData(token, user) {
    try {
      this.token = token;
      this.user = user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setTimeout(() => this.validateToken(), 300000);
    } catch (error) {
      console.error('Ошибка сохранения данных:', error);
    }
  }

  clearUserData() {
    this.token = null;
    this.user = null;
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Ошибка очистки:', error);
    }
  }

  async register(userData) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      if (data.status === 'success') {
        this.setUserData(data.token, data.user);
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message };
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      return { success: false, message: 'Ошибка сети' };
    }
  }

  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.status === 'success') {
        this.setUserData(data.token, data.user);
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message };
    } catch (error) {
      return { success: false, message: 'Ошибка сети' };
    }
  }

  logout() {
    this.clearUserData();
    return { success: true, message: 'Вы вышли' };
  }

  getAuthHeaders() {
    return { 'Authorization': `Bearer ${this.token}` };
  }
}

const auth = new Auth();
