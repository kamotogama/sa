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
    cachedNews = await updateAllNews();
    lastUpdateTime = currentTime;
  }

  res.json(cachedNews);
});
app.get('/', (req, res) => {
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
        <div id="news-content"></div>
        <script>
          fetch('/news')
            .then(response => response.json())
            .then(data => {
              const newsContent = document.getElementById('news-content');
              for (const [lang, news] of Object.entries(data)) {
                const section = document.createElement('div');
                section.className = 'language-section';
                const h2 = document.createElement('h2');
                h2.textContent = lang.toUpperCase();
                section.appendChild(h2);
                const ul = document.createElement('ul');
                news.forEach(item => {
                  const li = document.createElement('li');
                  const a = document.createElement('a');
                  a.href = item.link;
                  a.target = '_blank';
                  a.textContent = item.title;
                  li.appendChild(a);
                  ul.appendChild(li);
                });
                section.appendChild(ul);
                newsContent.appendChild(section);
              }
            });
        </script>
      </body>
    </html>
  `);
});
app.listen(port, () => {
  console.log(`News parser listening at http://localhost:${port}`);
});
