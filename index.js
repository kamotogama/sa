const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const newsSources = {
  en: [
    { url: 'https://www.bbc.com/news', selector: '.gs-c-promo-heading' },
    { url: 'https://www.theguardian.com/international', selector: '.fc-item__title' },
    { url: 'https://www.nytimes.com/', selector: '.story-wrapper' }
  ],
  ru: [
    { url: 'https://lenta.ru/', selector: '.card-mini__title' },
    { url: 'https://www.rbc.ru/', selector: '.news-feed__item' },
    { url: 'https://ria.ru/', selector: '.cell-list__item-title' }
  ],
  es: [
    { url: 'https://elpais.com/', selector: '.headline' },
    { url: 'https://www.elmundo.es/', selector: '.ue-c-cover-content__headline' },
    { url: 'https://www.abc.es/', selector: '.titular' }
  ],
  de: [
    { url: 'https://www.spiegel.de/', selector: '.c-teaser__title' },
    { url: 'https://www.faz.net/aktuell/', selector: '.tsr-Base_ContentWrap' },
    { url: 'https://www.sueddeutsche.de/', selector: '.sz-teaser__title' }
  ],
  fr: [
    { url: 'https://www.lemonde.fr/', selector: '.article__title' },
    { url: 'https://www.lefigaro.fr/', selector: '.fig-profile__headline' },
    { url: 'https://www.liberation.fr/', selector: '.teaser-title' }
  ],
  it: [
    { url: 'https://www.repubblica.it/', selector: '.entry-title' },
    { url: 'https://www.corriere.it/', selector: '.title-news' },
    { url: 'https://www.lastampa.it/', selector: '.entry-title' }
  ],
  ja: [
    { url: 'https://www3.nhk.or.jp/news/', selector: '.content--title' },
    { url: 'https://mainichi.jp/', selector: '.headline' },
    { url: 'https://www.asahi.com/', selector: '.c-list-title' }
  ],
  zh: [
    { url: 'https://news.sina.com.cn/', selector: '.news-item-title' },
    { url: 'https://www.163.com/', selector: '.news_title' },
    { url: 'https://www.qq.com/', selector: '.text' }
  ],
  nl: [
    { url: 'https://nos.nl/', selector: '.list-item__content-title' },
    { url: 'https://www.nu.nl/', selector: '.articleheader__title' },
    { url: 'https://www.telegraaf.nl/', selector: '.ArticleTitle' }
  ],
  sv: [
    { url: 'https://www.svt.se/nyheter/', selector: '.nyh_teaser__heading' },
    { url: 'https://www.dn.se/', selector: '.teaser__title' },
    { url: 'https://www.aftonbladet.se/', selector: '.abh1' }
  ]
};
const loadingMessages = {
  en: 'Loading...',
  ru: 'Загрузка...',
  es: 'Cargando...',
  de: 'Laden...',
  fr: 'Chargement...',
  it: 'Caricamento...',
  ja: '読み込み中...',
  zh: '加载中...',
  nl: 'Laden...',
  sv: 'Laddar...'
};

let cachedNews = {};
let isUpdating = false;

async function fetchNews(source) {
  try {
    const response = await axios.get(source.url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const news = [];

    $(source.selector).each((i, element) => {
      if (news.length < 5) {
        const title = $(element).text().trim();
        const link = $(element).attr('href') || $(element).find('a').attr('href');
        if (title && link) {
          news.push({ 
            title, 
            link: link.startsWith('http') ? link : new URL(link, source.url).href,
            source: new URL(source.url).hostname
          });
        }
      }
    });

    return news;
  } catch (error) {
    console.error(`Error fetching news from ${source.url}:`, error.message);
    return [];
  }
}

async function updateNews() {
  if (isUpdating) return;
  isUpdating = true;

  for (let sourceIndex = 0; sourceIndex < 3; sourceIndex++) {
    for (const [lang, sources] of Object.entries(newsSources)) {
      if (sourceIndex < sources.length) {
        const source = sources[sourceIndex];
        const newsFromSource = await fetchNews(source);
        if (!cachedNews[lang]) {
          cachedNews[lang] = [];
        }
        cachedNews[lang] = [...cachedNews[lang], ...newsFromSource].slice(0, 15);
      }
    }
  }

  isUpdating = false;
  setTimeout(updateNews, 30 * 60 * 1000); // Обновление каждые 30 минут
}

// Запускаем первое обновление новостей
updateNews();

app.get('/news', (req, res) => {
  res.json(cachedNews);
});

app.get('/', (req, res) => {
  let newsHtml = '';
  for (const [lang, items] of Object.entries(newsSources)) {
    const news = cachedNews[lang] || [];
    newsHtml += `
      <div class="language-section" id="${lang}-news">
        <h2>${lang.toUpperCase()}</h2>
        <ul>
          ${news.length > 0 ? 
            news.map(item => `
              <li>
                <a href="${item.link}" target="_blank">${item.title}</a>
                <span class="source">(${item.source})</span>
              </li>
            `).join('') : 
            `<li>${loadingMessages[lang] || 'Loading...'}</li>`
          }
        </ul>
      </div>
    `;
  }

  res.send(`
    <html>
      <head>
        <title>News Parser</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          h1 {
            color: #2c3e50;
            text-align: center;
          }
          .language-section {
            background-color: #fff;
            margin-bottom: 30px;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          h2 {
            color: #3498db;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
          }
          ul {
            list-style-type: none;
            padding: 0;
          }
          li {
            margin-bottom: 15px;
            padding: 10px;
            background-color: #ecf0f1;
            border-radius: 3px;
          }
          a {
            color: #2980b9;
            text-decoration: none;
            font-weight: bold;
          }
          .source {
            color: #7f8c8d;
            font-size: 0.8em;
            margin-left: 5px;
          }
        </style>
      </head>
      <body>
        <h1>Global News Aggregator</h1>
        <div id="news-content">
          ${newsHtml}
        </div>
        <script>
          function updateNewsDisplay() {
            fetch('/news')
              .then(response => response.json())
              .then(data => {
                for (const [lang, news] of Object.entries(data)) {
                  const newsSection = document.getElementById(lang + '-news');
                  if (newsSection) {
                    const newsList = newsSection.querySelector('ul');
                    newsList.innerHTML = news.map(item => `
                      <li>
                        <a href="${item.link}" target="_blank">${item.title}</a>
                        <span class="source">(${item.source})</span>
                      </li>
                    `).join('');
                  }
                }
              });
          }
          
          // Обновляем отображение новостей каждые 10 секунд
          setInterval(updateNewsDisplay, 10000);
        </script>
      </body>
    </html>
  `);
});

module.exports = app;
