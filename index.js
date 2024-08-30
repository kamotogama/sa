const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const NodeCache = require('node-cache');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize cache with 30 minutes TTL
const cache = new NodeCache({ stdTTL: 1800 });

const newsSources = {
  en: [
    { url: 'https://www.bbc.com/news', selector: '.gs-c-promo-heading' },
    { url: 'https://www.theguardian.com/international', selector: '.fc-item__title' }
  ],
  ru: [
    { url: 'https://lenta.ru/', selector: '.card-mini__title' },
    { url: 'https://ria.ru/', selector: '.cell-list__item-title' }
  ],
  es: [
    { url: 'https://elpais.com/', selector: '.headline' },
    { url: 'https://www.elmundo.es/', selector: '.ue-c-cover-content__headline' }
  ],
  de: [
    { url: 'https://www.spiegel.de/', selector: '.c-teaser__title' },
    { url: 'https://www.faz.net/aktuell/', selector: '.tsr-Base_HeadlineText' }
  ],
  fr: [
    { url: 'https://www.lemonde.fr/', selector: '.article__title' },
    { url: 'https://www.lefigaro.fr/', selector: '.fig-profile__headline' }
  ],
  it: [
    { url: 'https://www.repubblica.it/', selector: '.entry-title' },
    { url: 'https://www.corriere.it/', selector: '.news-title' }
  ],
  ja: [
    { url: 'https://www3.nhk.or.jp/news/', selector: '.content--title' },
    { url: 'https://mainichi.jp/', selector: '.headline' }
  ],
  zh: [
    { url: 'https://news.sina.com.cn/', selector: '.news-item-title' },
    { url: 'https://www.zaobao.com/', selector: '.card-title' }
  ],
  nl: [
    { url: 'https://nos.nl/', selector: '.list-item__content-title' },
    { url: 'https://www.nu.nl/', selector: '.headline' }
  ],
  sv: [
    { url: 'https://www.svt.se/nyheter/', selector: '.nyh_teaser__heading' },
    { url: 'https://www.dn.se/', selector: '.teaser__title' }
  ]
};
const loadingMessages = {
  en: 'Loading...', ru: 'Загрузка...', es: 'Cargando...', de: 'Laden...',
  fr: 'Chargement...', it: 'Caricamento...', ja: '読み込み中...',
  zh: '加载中...', nl: 'Laden...', sv: 'Laddar...'
};

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

async function getNews() {
  const news = {};
  for (const [lang, sources] of Object.entries(newsSources)) {
    news[lang] = [];
    for (const source of sources) {
      const newsFromSource = await fetchNews(source);
      news[lang] = [...news[lang], ...newsFromSource];
    }
    news[lang] = news[lang].slice(0, 10);
  }
  return news;
}

app.get('/api/news', async (req, res) => {
  try {
    const news = await getNews();
    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'An error occurred while fetching news' });
  }
});

app.get('/', async (req, res) => {
  try {
    const news = await getNews();
    let newsHtml = '';
    
    for (const [lang, items] of Object.entries(news)) {
      newsHtml += `
        <div class="language-section" id="${lang}-news">
          <h2>${lang.toUpperCase()}</h2>
          <ul>
            ${items.length > 0 ? 
              items.map(item => `
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
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Global News Aggregator</title>
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
              fetch('/api/news')
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
                })
                .catch(error => console.error('Error updating news:', error));
            }
            
            // Update news display every 5 minutes
            setInterval(updateNewsDisplay, 300000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error rendering page:', error);
    res.status(500).send('An error occurred while rendering the page');
  }
});

module.exports = app;
