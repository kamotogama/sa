const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

const NEWS_FILE = '../news.json';

const newsSources = {
  en: 'https://www.bbc.com/news',
  ru: 'https://lenta.ru/',
  es: 'https://elpais.com/',
  de: 'https://www.spiegel.de/',
  fr: 'https://www.lemonde.fr/',
  it: 'https://www.repubblica.it/',
  ja: 'https://www3.nhk.or.jp/news/',
  zh: 'https://news.sina.com.cn/',
  nl: 'https://nos.nl/',
  sv: 'https://www.svt.se/nyheter/'
};

async function fetchNews(url) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    const news = [];

    $('a').each((i, element) => {
      const title = $(element).text().trim();
      const link = $(element).attr('href');
      if (title && link && title.length > 20 && !link.includes('#') && news.length < 5) {
        news.push({ title, link: link.startsWith('http') ? link : url + link });
      }
    });

    return news.slice(0, 5);
  } catch (error) {
    console.error(`Error fetching news from ${url}:`, error);
    return [];
  }
}

async function updateNews() {
  const allNews = {};

  for (const [lang, url] of Object.entries(newsSources)) {
    allNews[lang] = await fetchNews(url);
  }

  fs.writeFileSync(NEWS_FILE, JSON.stringify(allNews, null, 2));
  console.log('News updated successfully');
}

// Запускаем парсер сразу и затем каждые 5 минут
updateNews();
setInterval(updateNews, 5 * 60 * 1000);