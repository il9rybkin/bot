import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";

const bot = new TelegramBot(process.env.BOT_TOKEN);

const STATES = {
  ASK_FEELING: "ASK_FEELING",
  ASK_MEDIA: "ASK_MEDIA",
  ASK_LOAD: "ASK_LOAD",
  ASK_NOTE1: "ASK_NOTE1",
  ASK_NOTE2: "ASK_NOTE2",
  ASK_NOTE3: "ASK_NOTE3",
};

const userData = {};

function setupHandlers() {
  bot.removeAllListeners(); // важно: не дублировать при каждом вызове

  bot.onText(/\/start/, (msg) => {
    const id = msg.from.id;
    userData[id] = {
      name: msg.from.first_name + (msg.from.last_name || ""),
      state: STATES.ASK_FEELING,
    };
    bot.sendMessage(id, "Привет! Как ты себя чувствуешь?");
  });

  bot.on("message", async (msg) => {
    const id = msg.from.id;
    const entry = userData[id];
    if (!entry || msg.text === "/start") return;

    const state = entry.state;

    switch (state) {
      case STATES.ASK_FEELING:
        entry.feeling = msg.text;
        entry.state = STATES.ASK_MEDIA;
        bot.sendMessage(id, "Загрузи фото/видео или напиши 'Пропустить'");
        break;

      case STATES.ASK_MEDIA:
        if (msg.photo || msg.video) {
          entry.media = msg.photo
            ? msg.photo[msg.photo.length - 1].file_id
            : msg.video.file_id;
        }
        entry.state = STATES.ASK_LOAD;
        bot.sendMessage(id, "Какой уровень нагрузки сегодня?");
        break;

      case STATES.ASK_LOAD:
        entry.load = msg.text;
        entry.state = STATES.ASK_NOTE1;
        bot.sendMessage(id, "Первый вопрос:");
        break;

      case STATES.ASK_NOTE1:
        entry.note1 = msg.text;
        entry.state = STATES.ASK_NOTE2;
        bot.sendMessage(id, "Второй вопрос:");
        break;

      case STATES.ASK_NOTE2:
        entry.note2 = msg.text;
        entry.state = STATES.ASK_NOTE3;
        bot.sendMessage(id, "Третий вопрос:");
        break;

      case STATES.ASK_NOTE3:
        entry.note3 = msg.text;
        const summary = `📝 Заметки от ${entry.name} (id: ${id}):\n` +
          `— Самочувствие: ${entry.feeling}\n` +
          `— Нагрузка: ${entry.load}\n` +
          `— В1: ${entry.note1}\n` +
          `— В2: ${entry.note2}\n` +
          `— В3: ${entry.note3}`;

        await bot.sendMessage(process.env.ADMIN_ID, summary);

        if (entry.media) {
          try {
            await bot.sendPhoto(process.env.ADMIN_ID, entry.media);
          } catch (err) {
            await bot.sendMessage(process.env.ADMIN_ID, `Ошибка при отправке медиа: ${err}`);
          }
        }

        bot.sendMessage(id, "Спасибо! Данные сохранены.");
        delete userData[id];
        break;
    }
  });
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    setupHandlers(); // регистрируем обработчики каждый раз
    try {
      await bot.processUpdate(req.body);
    } catch (err) {
      console.error("Error handling update", err);
    }
    return res.status(200).send("OK");
  }

  return res.status(200).send("Bot is alive.");
}
