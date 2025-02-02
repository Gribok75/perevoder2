const TelegramBot = require('node-telegram-bot-api');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const fetch = require('node-fetch'); // Убедитесь, что библиотека установлена: npm install node-fetch@2
const { translate }  = require('@vitalets/google-translate-api');
const ADMIN_ID = '5357772119';// Ваш Telegram ID (замените на свой ID)
const path = require('path');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Укажите токен вашего бота
const BOT_TOKEN = '7876197423:AAF2qZxEIFw3X9DHPlN8THrP1XkeWqkrTRY';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Список доступных языков
const SUPPORTED_LANGUAGES = ['rus', 'eng', 'deu', 'fra']; // Русский, Английский, Немецкий, Французский

bot.onText(/\/start|\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Привет! Я бот для распознавания текста с изображений. Отправь мне изображение, и я переведу его в текст!\n\n` +
      `Поддерживаемые языки:\nРусский (rus)\nАнглийский(eng)\nНемецкий (deu)\nФранцузский (fra).\n`
  );
});

// Язык по умолчанию
let selectedLanguage = 'rus+eng';

// Обработка команды смены языка
bot.onText(/\/lang (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const lang = match[1].trim().toLowerCase();

  // Проверяем, указаны ли поддерживаемые языки
  const isValid = lang.split('+').every((l) => SUPPORTED_LANGUAGES.includes(l));
  if (isValid) {
    selectedLanguage = lang;
    bot.sendMessage(chatId, `Язык(и) для распознавания текста установлен(ы): ${selectedLanguage}`);
  } else {
    bot.sendMessage(
      chatId,
      `Неправильный выбор языка. Поддерживаемые языки: ${SUPPORTED_LANGUAGES.join(', ')}`
    );
  }
});

// Обработчик изображений
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  // Получаем наибольшее изображение из массива
  const photo = msg.photo[msg.photo.length - 1];

  try {
    // Получаем путь к файлу на серверах Telegram
    const file = await bot.getFile(photo.file_id);
    const filePath = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

    // Определяем расширение файла
    const extension = file.file_path.split('.').pop();
    const tempFileName = `temp_image_${Date.now()}.${extension}`;

    // Скачиваем изображение
    const response = await fetch(filePath);
    const fileStream = fs.createWriteStream(tempFileName);

    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on('error', reject);
      fileStream.on('finish', resolve);
    });

    // Распознаем текст с изображения
    const { data: { text } } = await Tesseract.recognize(tempFileName, selectedLanguage); // Используем выбранный язык

    // Отправляем распознанный текст
    if (text.trim()) {
      bot.sendMessage(chatId, `Распознанный текст:\n\n${text}`);
    } else {
      bot.sendMessage(chatId, 'Не удалось распознать текст. Попробуйте другое изображение.');
    }

    // Удаляем временный файл
    fs.unlinkSync(tempFileName);
  } catch (err) {
    bot.sendMessage(chatId, `Произошла ошибка: ${err.message}`);
  }
});

//Переводчик для переводера
bot.onText(/\/translate/, async (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,"Отпавте текст который хотите перевести.").then(() =>{
    bot.once('message',async (response) => {
      const userText = response.text;
      try{
      const result = await translate(userText,{ to: 'ru'});
        bot.sendMessage(chatId, `Перевод:\n ${result.text}`);
    } catch (err){
      bot.sendMessage(chatId,`При переводе возникла ошибка, повторите попытку позже;)`);
      console.error(err);
    }
    });
  });
});

// Путь к файлу users.json
const USERS_FILE = path.join(__dirname, 'users.json');

// Хранилище пользователей
let users = [];

// Функция для загрузки пользователей из файла
const loadUsersFromFile = () => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      console.log('Файл users.json найден, загружаем данные...');
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      users = JSON.parse(data);
    } else {
      console.log('Файл users.json не найден, создаем новый...');
      fs.writeFileSync(USERS_FILE, JSON.stringify([])); // Создаем пустой файл
      users = [];
    }
  } catch (err) {
    console.error('Ошибка при загрузке файла users.json:', err);
    users = [];
  }
};



// Функция для сохранения пользователей в файл
const saveUsersToFile = () => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    console.log('Пользователи успешно сохранены.');
  } catch (err) {
    console.error('Ошибка при сохранении файла users.json:', err);
  }
};

// Загружаем пользователей при запуске
loadUsersFromFile();

// Обработчик всех сообщений
bot.on('message', (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || 'Имя пользователя';


  // Если пользователя нет в списке, добавляем
  if (!users.some((user) => user.id === userId)){
    users.push({id: userId, name: username});
    saveUsersToFile();
  }
});

// Команда /infoAdmin
bot.onText(/\/info_admin/, (msg) => {
  const chatId = msg.chat.id;

  // Проверяем, является ли отправитель администратором
  if (msg.from.id.toString() === ADMIN_ID) {
    const userList = users.map((user, index) => `${index + 1}. ID: ${user.id}, Имя: ${user.name}`).join('\n')

    bot.sendMessage(chatId, `Общее количество пользователей: ${users.length}\n\nСписок пользователей:\n${userList}`);
  } else {
    bot.sendMessage(chatId, 'У вас нет доступа к этой информации.');
  }
});

const chance = 0.0001;

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    // Генерируем случайное число от 0 до 1
    const randomValue = Math.random();
    // Если случайное число меньше 0.0001, отправляем сообщение
    if (randomValue < chance) {
        bot.sendMessage(chatId, 'нет иди нахуй!');
    }
});

bot.onText(/\/pubertat/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Тебе ещё рано;)');
});

// Обработчик текстовых сообщений
bot.on('message', (msg) => {
  if(msg.text){
    if(msg.text.startsWith('/translate')){
      return;
    }
    if(msg.text.startsWith(msg.text)){
      return;
    }
  }
  if (!msg.photo) {
    bot.sendMessage(
      msg.chat.id,
      'Отправь мне изображение, чтобы я мог распознать текст!'
    );
  }
});