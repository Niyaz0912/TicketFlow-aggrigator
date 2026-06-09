// Создание мероприятия
app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Валидация обязательных полей
    if (!eventData.title || !eventData.description || !eventData.category || 
        !eventData.date || !eventData.time || !eventData.venue || 
        !eventData.address || !eventData.city || !eventData.capacity) {
      return res.status(400).json({
        status: 'error',
        message: 'Заполните все обязательные поля'
      });
    }
    
    // Валидация В ЗАВИСИМОСТИ ОТ ТИПА РАССАДКИ
    if (eventData.seatingType === 'zones') {
      // Проверяем ТОЛЬКО для зональной рассадки
      if (!eventData.zones || eventData.zones.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Добавьте хотя бы одну зону для зональной рассадки'
        });
      }
      
      // Проверяем каждую зону
      for (const zone of eventData.zones) {
        if (!zone.name || zone.price === undefined || zone.capacity === undefined) {
          return res.status(400).json({
            status: 'error',
            message: 'Заполните все поля для каждой зоны'
          });
        }
        
        if (zone.price < 0) {
          return res.status(400).json({
            status: 'error',
            message: `Цена в зоне "${zone.name}" не может быть отрицательной`
          });
        }
        
        if (zone.capacity < 1) {
          return res.status(400).json({
            status: 'error',
            message: `Вместимость в зоне "${zone.name}" должна быть положительной`
          });
        }
      }
      
      // НЕ ПРОВЕРЯЕМ freeSeating для зональной рассадки!
      
    } else if (eventData.seatingType === 'free') {
      // Проверяем ТОЛЬКО для свободной рассадки
      if (!eventData.freeSeating || eventData.freeSeating.price === undefined) {
        return res.status(400).json({
          status: 'error',
          message: 'Укажите цену для свободной рассадки'
        });
      }
      
      if (eventData.freeSeating.price < 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Цена не может быть отрицательной'
        });
      }
      
      // НЕ ПРОВЕРЯЕМ zones для свободной рассадки!
    }
    
    // Преобразование даты в объект Date
    eventData.date = new Date(eventData.date);
    
    // Проверка, что дата не в прошлом
    if (eventData.date < new Date()) {
      return res.status(400).json({
        status: 'error',
        message: 'Дата мероприятия не может быть в прошлом'
      });
    }
    
    // Генерируем уникальный eventId
    eventData.eventId = await generateEventId();
    
    const newEvent = await Event.create(eventData);
    await newEvent.populate('createdBy', 'name email');
    
    res.status(201).json({
      status: 'success',
      message: 'Мероприятие успешно создано',
      event: newEvent
    });

    console.log(`Создано новое мероприятие: ${newEvent.title} (ID: ${newEvent.eventId})`);

  } catch (error) {
    console.error('Ошибка при создании мероприятия:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        status: 'error',
        message: 'Ошибка валидации',
        errors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Мероприятие с таким ID уже существует'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: 'Ошибка сервера при создании мероприятия'
    });
  }
});