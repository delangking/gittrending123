const axios = require('axios');
const cheerio = require('cheerio');

let trendingRepos = [];

async function scrapeTrending(language = '', since = 'daily') {
  const url = `https://github.com/trending/${encodeURIComponent(language)}?since=${since}`;
  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const $ = cheerio.load(data);
    const repos = [];
    $('article.Box-row').each((_, el) => {
      const title = $(el).find('.h3 > a').text().trim();
      const [author, repo] = title.split('/').map(s => s.trim());
      let stars = $(el).find("a[href*='/stargazers']").text().trim().replace(/,/g, '');
      const lang = $(el).find('[itemprop="programmingLanguage"]').text().trim();
      if (author && repo) {
        repos.push({ author, repo, stars, language: lang });
      }
    });
    // Only cache if global trending and since is 'daily'
    if (!language && since === 'daily') trendingRepos = repos;
    return repos;
  } catch (err) {
    console.error('❌ Scraping error:', err.message);
    return [];
  }
}

function getTrendingRepos() {
  return trendingRepos;
}

module.exports = { scrapeTrending, getTrendingRepos };