class Notifications {
  constructor() {
    this.container = document.getElementById('notificationContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notificationContainer';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }
  }

  show(type, title, message, duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    
    notification.innerHTML = `
      <i class="fas ${icon} notification-icon"></i>
      <div class="notification-content">
        <div class="notification-title">${title}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    this.container.appendChild(notification);
    
    // Анимация появления
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Закрытие по кнопке
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      this.close(notification);
    });
    
    // Автозакрытие
    if (duration > 0) {
      setTimeout(() => {
        this.close(notification);
      }, duration);
    }
    
    return notification;
  }

  close(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  info(title, message, duration) {
    return this.show('info', title, message, duration);
  }

  success(title, message, duration) {
    return this.show('success', title, message, duration);
  }

  error(title, message, duration) {
    return this.show('error', title, message, duration);
  }

  warning(title, message, duration) {
    return this.show('warning', title, message, duration);
  }
}

// Создаем экземпляр Notifications
const notifications = new Notifications();