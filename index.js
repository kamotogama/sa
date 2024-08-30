const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 3000;
const cache = new NodeCache({ stdTTL: 1800 }); // 30 минут

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

async function fetchNewsWithRetry(source, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(source.url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      const $ = cheerio.load(response.data);
      const news = [];

      $(source.selector).each((i, element) => {
        const title = $(element).text().trim();
        const link = $(element).attr('href') || $(element).find('a').attr('href');
        if (title && link && news.length < 5) {
          news.push({ 
            title, 
            link: link.startsWith('http') ? link : new URL(link, source.url).href,
            source: new URL(source.url).hostname
          });
        }
      });

      console.log(`Found ${news.length} news items from ${source.url}`);
      return news.slice(0, 5);
    } catch (error) {
      console.error(`Attempt ${i + 1} failed for ${source.url}: ${error.message}`);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

async function updateAllNews() {
  const allNews = {};

  for (const [lang, sources] of Object.entries(newsSources)) {
    allNews[lang] = [];
    for (const source of sources) {
      try {
        const newsFromSource = await fetchNewsWithRetry(source);
        allNews[lang] = allNews[lang].concat(newsFromSource);
      } catch (error) {
        console.error(`Failed to fetch news from ${source.url} after multiple attempts`);
      }
    }
    allNews[lang] = allNews[lang].slice(0, 15); // Ограничиваем до 15 новостей на язык
  }

  return allNews;
}

async function getNews() {
  let news = cache.get('news');
  if (!news) {
    console.log('Updating news cache...');
    news = await updateAllNews();
    cache.set('news', news);
    console.log('News cache updated');
  }
  return news;
}

// Обновление новостей каждые 30 минут
setInterval(async () => {
  console.log('Scheduled news update...');
  const news = await updateAllNews();
  cache.set('news', news);
  console.log('Scheduled news update completed');
}, 30 * 60 * 1000);

app.get('/news', async (req, res) => {
  const news = await getNews();
  res.json(news);
});

app.get('/', async (req, res) => {
  const news = await getNews();
  
  let newsHtml = '';
  for (const [lang, items] of Object.entries(news)) {
    newsHtml += `
      <div class="language-section">
        <h2>${lang.toUpperCase()}</h2>
        <ul>
          ${items.map(item => `
            <li>
              <a href="${item.link}" target="_blank">${item.title}</a>
              <span class="source">(${item.source})</span>
            </li>
          `).join('')}
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
            transition: background-color 0.3s ease;
          }
          li:hover {
            background-color: #e0e6e8;
          }
          a {
            color: #2980b9;
            text-decoration: none;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
          .source {
            color: #7f8c8d;
            font-size: 0.8em;
            margin-left: 5px;
          }
          @media (max-width: 600px) {
            body {
              padding: 10px;
            }
            .language-section {
              padding: 10px;
            }
          }
        </style>
      </head>
      <body>
        <h1>Global News Aggregator</h1>
        <div id="news-content">
          ${newsHtml}
        </div>
      </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`News parser listening at http://localhost:${port}`);
});
