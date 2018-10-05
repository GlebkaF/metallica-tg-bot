const _ = require("lodash");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TOKEN;
const chatId = process.env.CHAT_ID;
const interval = process.env.INTERVAL || 10000;
const term = process.env.SEARCH_TERM || 'ФАН';
const bot = new TelegramBot(token, { polling: true });

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
  const sector = _.find(sectors, ({ name }) => _.includes(name, text));
  return sector;
};

const sendMessageToTelegram = async message => {
  try {
    await bot.sendMessage(chatId, message);
  } catch (e) {
    console.error(e.message);
  }
};

let prevAmount = 99999;

const checkTickets = async () => {
  try {
    const sector = await findSectorByName(term);
    const amount = _.get(sector, "amount", 0);
    const name = _.get(sector, "name", term);

    if (amount !== prevAmount) {
      const message = `Обновились билеты в ${name}, осталось билетов: ${amount}.\nКупить: https://metallica.kassir.ru/koncert/metallica`;
      sendMessageToTelegram(message);
    }

    prevAmount = amount;
  } catch (e) {
    console.log(e.message);
  }
};

// Matches "/echo [whatever]"
bot.onText(/\/ping/, (msg) => {
  const chatId = msg.chat.id;
  // send back the matched "whatever" to the chat
  bot.sendMessage(chatId, 'pong');
});

checkTickets();
setInterval(checkTickets, interval);
