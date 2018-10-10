#!/usr/bin/env node
const _ = require("lodash");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TOKEN;
const chatId = process.env.CHAT_ID;
const interval = process.env.INTERVAL || 10000;
const term = process.env.SEARCH_TERM || "ФАН";
const bot = new TelegramBot(token, { polling: true });

if (!token) {
  throw new Error("Не указан API токен бота");
}

if (!chatId) {
  throw new Error("Не указан chatId телеграм канала");
}

const parseSector = $ => el => {
  const name = $(el)
    .find(".col-sector")
    .text();
  const rawAmount = $(el)
    .find(".col-amount")
    .text();

  const amount = _.parseInt(_.trim(rawAmount), 10);
  return { name, amount };
};

const findSectorByName = async (text = "ФАН") => {
  const url = "https://metallica.kassir.ru/koncert/metallica";
  const html = await fetch(url).then(res => res.text());
  const $ = cheerio.load(html);
  const sectors = $(".table-price")
    .find("tr")
    .toArray()
    .map(parseSector($));
  const sector = _.find(sectors, ({ name }) =>
    _.includes(_.toLower(name), _.toLower(text))
  );
  return sector;
};

const sendMessageToTelegram = async message => {
  try {
    await bot.sendMessage(chatId, message);
  } catch (e) {
    console.error(e.message);
  }
};

let prevAmount = 0;
let fullSectorName = term;

const checkTickets = async () => {
  try {
    const sector = await findSectorByName(term);
    const amount = _.get(sector, "amount", 0);
    const name = _.get(sector, "name", term);

    const isNewBatch = prevAmount === 0 && amount !== prevAmount;
    const isRunOut = amount === 0 && amount !== prevAmount;
    const isHalfOfBatch = prevAmount / amount > 2;

    if (isNewBatch || isHalfOfBatch || isRunOut) {
      // Сохраним имя сектора целиком, чтобы красиво его показывать потом
      fullSectorName = name;
      prevAmount = amount;

      const message = amount
        ? `В наличии билеты в ${name}, осталось билетов: ${amount}.\nКупить: https://metallica.kassir.ru/koncert/metallica`
        : `Билеты в ${name} сейчас нет! :(`;
      await sendMessageToTelegram(message);

      console.log(
        `Обновилось количество в ${name}, осталось билетов: ${amount}`
      );
    } else {
      console.log("Количество билетов не обновилось.");
    }
  } catch (e) {
    console.log("Ошибка: ", e.message);
  }
};

// Matches "/echo [whatever]"
bot.onText(/\/ping/, msg => {
  const chatId = msg.chat.id;
  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, "pong");
});

checkTickets();
setInterval(checkTickets, interval);
