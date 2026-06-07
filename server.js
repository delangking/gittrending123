// filepath: /github-trending-app/github-trending-app/backend/server.js
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { scrapeTrending, getTrendingRepos } = require('./scraper');
const { starRepo, getReadme } = require('./githubApi');
const path = require('path');
const ejs= require('ejs');
const { url } = require('inspector');
const { urlencoded } = require('body-parser');
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Set views directory
app.use(express.static(path.join(__dirname, 'public')));

 app.use(urlencoded({ extended: true }));

const PORT = 3000;
let trendingRepos = []; // In-memory DB

app.use(cors());
app.use(express.json());

// Initial scrape on server start (global trending)
scrapeTrending();

// Daily cron job at midnight (refresh global trending)
cron.schedule('0 0 * * *', () => {
  console.log('🔄 Running daily GitHub scrape...');
  scrapeTrending();
});
app.get("/", (req, res) => {
  res.render('app.ejs');
})
// API endpoint to get data
app.get('/repos', async (req, res) => {
  const language = req.query.language;
  const since = req.query.since || 'daily';
  if (language) {
    try {
      const repos = await scrapeTrending(language, since);
      res.json(repos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    try {
      const repos = await scrapeTrending('', since);
      res.json(repos);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
});

// API endpoint to star a repository
app.post('/star', async (req, res) => {
  const { repo, owner, token } = req.body;
  try {
    const result = await starRepo(owner, repo, token);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to get README content
app.get('/readme', async (req, res) => {
  const { owner, repo } = req.query;
  try {
    const readme = await getReadme(owner, repo); // no token
    res.json({ readme });
  } catch (err) {
    res.json({ readme: null });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// <!-- Add this in your <head> or before your closing </body> tag -->
