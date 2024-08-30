const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
  console.log(`Fetching news from ${url}`);
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    const news = [];

    $('a').each((i, element) => {
      const title = $(element).text().trim();
      const link = $(element).attr('href');
      if (title && link && title.length > 20 && !link.includes('#') && news.length < 5) {
        news.push({ title, link: link.startsWith('http') ? link : url + link });
      }
    });

    console.log(`Found ${news.length} news items from ${url}`);
    return news.slice(0, 5);
  } catch (error) {
    console.error(`Error fetching news from ${url}:`, error.message);
    return [];
  }
}

async function updateAllNews() {
  const allNews = {};

  for (const [lang, url] of Object.entries(newsSources)) {
    allNews[lang] = await fetchNews(url);
  }

  return allNews;
}

let cachedNews = {};
let lastUpdateTime = 0;

app.get('/news', async (req, res) => {
  const currentTime = Date.now();
  if (currentTime - lastUpdateTime > 5 * 60 * 1000) {
    console.log('Updating news cache...');
    cachedNews = await updateAllNews();
    lastUpdateTime = currentTime;
    console.log('News cache updated');
  }

  res.json(cachedNews);
});

app.get('/', async (req, res) => {
  const news = await updateAllNews();
  
  let newsHtml = '';
  for (const [lang, items] of Object.entries(news)) {
    newsHtml += `
      <div class="language-section">
        <h2>${lang.toUpperCase()}</h2>
        <ul>
          ${items.map(item => `
            <li><a href="${item.link}" target="_blank">${item.title}</a></li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  res.send(`
    <html>
      <head>
        <title>News Parser</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #333;
          }
          .language-section {
            margin-bottom: 30px;
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 5px;
          }
          h2 {
            color: #666;
          }
          ul {
            list-style-type: none;
            padding: 0;
          }
          li {
            margin-bottom: 10px;
          }
          a {
            color: #0066cc;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <h1>News Parser</h1>
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
