const API_URL = 'http://localhost:3000/api';

export const auth = {
    token: null,
    user: null,

    init() {
        this.token = localStorage.getItem('token');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    },

    isAuthenticated() {
        return !!this.token && !!this.user;
    },

    isAdmin() {
        return this.isAuthenticated() && this.user?.isAdmin === true;
    },

    getAuthHeaders() {
        return { 'Authorization': `Bearer ${this.token}` };
    },

    async login(email, password) {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.status === 'success') {
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.user));
        }
        return data;
    },

    async register(name, email, password) {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (data.status === 'success') {
            this.token = data.token;
            this.user = data.user;
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.user));
        }
        return data;
    },

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};