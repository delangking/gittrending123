// Entry point for frontend app

// Wait for DOM to load before running scripts
document.addEventListener('DOMContentLoaded', () => {
  let repos = [];
  let langChartInstance = null;
  let growthChartInstance = null;
  let currentChartType = 'bar';
  let chartLabels = [];
  let chartData = [];
  let chartStarsData = [];
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');

  async function fetchRepos(language = '', since = 'daily') {
    document.getElementById('repo-loader').style.display = 'block';
    document.getElementById('repo-list').style.display = 'none';

    let url = 'http://localhost:3000/repos';
    const params = [];
    if (language) params.push(`language=${encodeURIComponent(language)}`);
    if (since) params.push(`since=${encodeURIComponent(since)}`);
    if (params.length) url += '?' + params.join('&');
    const res = await fetch('/repos');
    repos = await res.json();

    document.getElementById('repo-loader').style.display = 'none';
    document.getElementById('repo-list').style.display = '';
    renderRepos();
    renderLanguageChart(repos);
    renderGrowthChart(repos);
    renderContributors(repos);
    renderContribHeatmap();
    renderIssuePRChart();
  }

  async function toggleStar(owner, repo, isStarred, token) {
    token = token || getStoredToken();
    if (!token) return; // Should not happen
    const method = isStarred ? 'DELETE' : 'PUT';
    const res = await fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
      method,
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3.star+json'
      }
    });
    if (res.ok) {
      showStarSuccess(repo); // repo is the repo name or repo.repo
      // Optionally update UI
    } else {
      alert('Failed. Check your token.');
      // Optionally clear stored token if unauthorized
      if (res.status === 401) setStoredToken('');
    }
  }

  function renderRepos() {
    const list = document.getElementById('repo-list');
    list.innerHTML = '';
    repos.forEach(repo => {
      const isBookmarked = bookmarks.some(b => b.repo === repo.repo && b.author === repo.author);
      const li = document.createElement('li');
      li.innerHTML = `
        <span>Repo Author:${repo.author} &nbsp Repo: ${repo.repo}</span>
        <span> <i class="fa-solid fa-star" style="color: #FFD43B;"></i>stars : ${repo.stars}</span>
        <span class="repo-actions" style="display:inline-flex;gap:8px;margin-left:12px;">
          <button class="preview-btn">Preview</button>
          <button 
            class="bookmark-btn" 
            style="background:${isBookmarked ? '#2ecc71' : '#0366d6'};color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;"
          >
            ${isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </button>
          <button class="star-btn">⭐ Star</button>
        </span>
      `;

      // Preview button
      const previewBtn = li.querySelector('.preview-btn');
      previewBtn.addEventListener('click', function() {
        showReadme(repo.author, repo.repo);
      });

      // Bookmark button
      const bookmarkBtn = li.querySelector('.bookmark-btn');
      if (isBookmarked) {
        bookmarkBtn.addEventListener('click', function() {
          removeBookmark(repo);
        });
      } else {
        bookmarkBtn.addEventListener('click', function() {
          addBookmark(repo, bookmarkBtn);
        });
      }

      // Star button
      const starBtn = li.querySelector('.star-btn');
      starBtn.addEventListener('click', function() {
        let token = getStoredToken();
        if (!token) {
          showTokenModal((enteredToken) => {
            setStoredToken(enteredToken);
            toggleStar(repo.author, repo.repo, false, enteredToken);
          });
        } else {
          toggleStar(repo.author, repo.repo, false, token);
        }
      });

      list.appendChild(li);
    });
  }

  async function starRepo(author, repo) {
    const token = document.getElementById('token').value.trim();
    if (!token) {
      alert('Please provide a GitHub API token.');
      return;
    }
    const res = await fetch('/star', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ owner, repo, token })
});
    if (res.ok) {
      alert(`Successfully starred ${repo}`);
    } else {
      alert('Failed to star the repository. Please check your token and try again.');
    }
  }

  async function showReadme(owner, repo) {
    const modal = document.getElementById('readme-modal');
    const modalContent = document.getElementById('readme-modal-content');
    const content = document.getElementById('readme-content');
    content.textContent = 'Loading...';
    modal.style.display = 'flex';
    // Animate in
    setTimeout(() => {
      modalContent.style.transform = 'scale(1)';
      modalContent.style.opacity = '1';
    }, 10);

    try {
      const res = await fetch(`/readme?owner=${owner}&repo=${repo}`);
      const data = await res.json();
      if (data.readme) {
        let truncated = data.readme.length > 5000;
        let html = marked.parse(data.readme.substring(0, 5000));
        html = html.replace(/<img\s+[^>]*src="([^":]+)"/g, (match, src) => {
          if (/^(https?:|data:)/.test(src)) return match;
          const branch = 'master';
          const abs = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${src.replace(/^\.?\//, '')}`;
          return match.replace(src, abs);
        });
        html = html.replace(
          /<img /g,
          '<img style="max-width:100%;height:auto;display:block;margin:12px auto;box-shadow:0 2px 12px rgba(0,0,0,0.07);border-radius:8px;" '
        );
        // Add a clear, styled truncated message
        if (truncated) {
          html += `<div style="margin-top:24px;padding:12px 0 0 0;border-top:1px solid #eee;text-align:center;color:#888;font-size:1rem;">
            <strong>Preview truncated.</strong> <br>
            <span style="font-size:0.95em;">Open on <a href="https://github.com/${owner}/${repo}" target="_blank" rel="noopener">GitHub</a> to see the full README.</span>
          </div>`;
        }

        content.innerHTML = html;
      } else {
        content.textContent = 'No README found.';
      }
    } catch (e) {
      content.textContent = 'Failed to load README.';
    }
  }

  function addBookmark(repo, btn) {
    btn.textContent = 'Loading...';
    btn.disabled = true;
    btn.style.background = '#888'; // Optional: show loading color

    setTimeout(() => { // Simulate async, remove if not needed
      if (!bookmarks.some(b => b.repo === repo.repo && b.author === repo.author)) {
        bookmarks.push(repo);
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
        // Update button to "Bookmarked"
        btn.textContent = 'Bookmarked';
        btn.style.background = '#2ecc71';
        btn.disabled = true;
      } else {
        btn.textContent = 'Bookmarked';
        btn.style.background = '#2ecc71';
        btn.disabled = true;
      }
    }, 500); // Simulate loading delay
  }

  function removeBookmark(repo) {
    bookmarks = bookmarks.filter(b => !(b.repo === repo.repo && b.author === repo.author));
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    renderRepos();
  }

  document.getElementById('chart-type').addEventListener('change', function() {
    currentChartType = this.value;
    console.log('Chart type changed to:', currentChartType);
    renderLanguageChart(repos, currentChartType);
  });

  function renderLanguageChart(reposData, overrideType = null) {
    document.getElementById('langChart-loader').style.display = 'block';
    document.getElementById('langChart').style.display = 'none';

    // Defer heavy work so loader can show
    setTimeout(() => {
      // Count languages and stars
      const langCounts = {};
      const langStars = {};
      reposData.forEach(repo => {
        const lang = repo.language || 'Unknown';
        langCounts[lang] = (langCounts[lang] || 0) + 1;
        langStars[lang] = (langStars[lang] || 0) + Number(repo.stars || 0);
      });

      // Top 7 languages by repo count
      const sortedLangs = Object.entries(langCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

      chartLabels = sortedLangs.map(([lang]) => lang);
      chartData = sortedLangs.map(([_, count]) => count);
      chartStarsData = chartLabels.map(lang => langStars[lang]);

      // Stats
      const totalRepos = reposData.length;
      const mostPopularLang = chartLabels[0];
      const mostPopularLangCount = chartData[0];
      const mostStarredLang = chartLabels[chartStarsData.indexOf(Math.max(...chartStarsData))];

      document.getElementById('lang-stats').innerHTML = `
        <strong>Total repos:</strong> ${totalRepos} &nbsp;|&nbsp;
        <strong>Most popular language:</strong> ${mostPopularLang} (${mostPopularLangCount}) &nbsp;|&nbsp;
        <strong>Most starred language:</strong> ${mostStarredLang}
      `;

      // Use override chart type if given
      const typeToUse = overrideType || currentChartType;

      // Destroy and recreate the chart
      if (langChartInstance) {
        langChartInstance.destroy();
        langChartInstance = null;
        // Clear the canvas to ensure Chart.js can redraw
        const ctx = document.getElementById('langChart').getContext('2d');
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      createLanguageChart(chartLabels, chartData, chartStarsData, typeToUse);
      document.getElementById('langChart-loader').style.display = 'none';
      document.getElementById('langChart').style.display = '';
    }, 0); // Use 0ms to yield to the browser
  }


  function createLanguageChart(labels, data, starsData, chartType) {
    const ctx = document.getElementById('langChart').getContext('2d');
    const datasets = chartType === 'bar'
      ? [
          {
            label: 'Repos',
            data,
            backgroundColor: [
              '#36a2eb', '#ff6384', '#ffcd56', '#4bc0c0', '#9966ff', '#ff9f40', '#2ecc71'
            ],
          },
          {
            label: 'Stars',
            data: starsData,
            backgroundColor: 'rgba(255,99,132,0.2)',
            borderColor: 'rgba(255,99,132,1)',
            type: 'line',
            yAxisID: 'y1'
          }
        ]
      : [
          {
            label: 'Repos',
            data,
            backgroundColor: [
              '#36a2eb', '#ff6384', '#ffcd56', '#4bc0c0', '#9966ff', '#ff9f40', '#2ecc71'
            ],
          }
        ];

    langChartInstance = new Chart(ctx, {
      type: chartType,
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: chartType !== 'bar' },
          tooltip: { enabled: true },
          title: {
            display: true,
            text: chartType === 'bar' ? 'Top Languages (Bar + Stars Line)' : 'Top Languages Share'
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'xy',
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true
              },
              mode: 'xy',
            }
          }
        },
        scales: chartType === 'bar' ? {
          x: { title: { display: true, text: 'Language' } },
          y: { title: { display: true, text: 'Repositories' }, beginAtZero: true },
          y1: {
            position: 'right',
            title: { display: true, text: 'Stars' },
            beginAtZero: true,
            grid: { drawOnChartArea: false }
          }
        } : {}
      }
    });
  }

  function updateLanguageChart(labels, data, starsData, chartType) {
    langChartInstance.config.type = chartType;
    langChartInstance.data.labels = labels;
    langChartInstance.data.datasets = [
      {
        label: 'Repos',
        data,
        backgroundColor: [
          '#36a2eb', '#ff6384', '#ffcd56', '#4bc0c0', '#9966ff', '#ff9f40', '#2ecc71'
        ],
      },
      ...(chartType === 'bar' ? [{
        label: 'Stars',
        data: starsData,
        backgroundColor: 'rgba(255,99,132,0.2)',
        borderColor: 'rgba(255,99,132,1)',
        type: 'line',
        yAxisID: 'y1'
      }] : [])
    ];
    langChartInstance.options.plugins.legend.display = chartType !== 'bar';
    langChartInstance.options.plugins.title.text = chartType === 'bar' ? 'Top Languages (Bar + Stars Line)' : 'Top Languages Share';
    langChartInstance.options.scales = chartType === 'bar' ? {
      x: { title: { display: true, text: 'Language' } },
      y: { title: { display: true, text: 'Repositories' }, beginAtZero: true },
      y1: {
        position: 'right',
        title: { display: true, text: 'Stars' },
        beginAtZero: true,
        grid: { drawOnChartArea: false }
      }
    } : {};
    langChartInstance.update();
  }

  document.getElementById('close-modal').onclick = () => {
    const modal = document.getElementById('readme-modal');
    const modalContent = document.getElementById('readme-modal-content');
    // Animate out
    modalContent.style.transform = 'scale(0.85)';
    modalContent.style.opacity = '0';
    setTimeout(() => {
      modal.style.display = 'none';
    }, 250);
  };

  document.getElementById('search').oninput = function() {
  renderRepos();
  renderLanguageChart(repos);
};
document.getElementById('author-filter').oninput = function() {
  renderRepos();
  renderLanguageChart(repos);
};
document.getElementById('sort-by').onchange = function() {
  renderRepos();
  renderLanguageChart(repos);
};
  document.getElementById('language').onchange = () => {
    fetchRepos(
      document.getElementById('language').value,
      document.getElementById('date-range').value
    );
  };
  document.getElementById('date-range').onchange = () => {
    fetchRepos(
      document.getElementById('language').value,
      document.getElementById('date-range').value
    );
  };
  // document.getElementById('sort-by').onchange = renderRepos;
  // document.getElementById('author-filter').oninput = renderRepos;
  // Initial fetch (global trending, today)
  fetchRepos();

  i18next.init({
    lng: 'en',
    resources: {
      en: { translation: { "Trending Repositories": "Trending Repositories", "Language Popularity": "Language Popularity" } },
      es: { translation: { "Trending Repositories": "Repositorios de Tendencia", "Language Popularity": "Popularidad de Lenguajes" } }
      // Add more translations here
    }
  }, function() {
    updateTexts();
  });

  function updateTexts() {
    document.querySelector('h1').textContent = i18next.t('Trending Repositories');
    document.querySelector('.dashboard h2').textContent = i18next.t('Language Popularity');
    // Add more UI elements as needed
  }

  document.getElementById('lang-switch').onchange = function(e) {
    i18next.changeLanguage(e.target.value, updateTexts);
  };

  function renderGrowthChart(repos) {
    document.getElementById('growthChart-loader').style.display = 'block';
    document.getElementById('growthChart').style.display = 'none';

    setTimeout(() => {
      // Simulate time-series data for the last 7 days
      const labels = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(d.toISOString().slice(0, 10));
      }

      // For each repo, create two datasets: one for stars, one for forks
      const datasets = [];
      repos.slice(0, 3).forEach(repo => {
        // Simulate stars growth
        let baseStars = Number(repo.stars || 0) - Math.floor(Math.random() * 20);
        const starsData = Array.from({length: 7}, () => baseStars += Math.floor(Math.random() * 5));
        datasets.push({
          label: `${repo.repo} (${repo.author}) - Stars`,
          data: starsData,
          fill: false,
          borderColor: '#' + Math.floor(Math.random()*16777215).toString(16),
          tension: 0.3
        });

        // Simulate forks growth
        let baseForks = Number(repo.forks || 0) - Math.floor(Math.random() * 10);
        const forksData = Array.from({length: 7}, () => baseForks += Math.floor(Math.random() * 2));
        datasets.push({
          label: `${repo.repo} (${repo.author}) - Forks`,
          data: forksData,
          fill: false,
          borderDash: [5, 5],
          borderColor: '#' + Math.floor(Math.random()*16777215).toString(16),
          tension: 0.3
        });
      });

      if (growthChartInstance) {
        growthChartInstance.destroy();
      }
      const ctx = document.getElementById('growthChart').getContext('2d');
      growthChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          plugins: {
            title: { display: true, text: `Repo Stars & Forks Growth (Simulated)` }
          }
        }
      });
      document.getElementById('growthChart-loader').style.display = 'none';
      document.getElementById('growthChart').style.display = '';
    }, 0);
  }

  // Dropdown handler
  document.getElementById('growth-metric').addEventListener('change', function() {
    renderGrowthChart(repos, this.value);
  });

  function renderContributors(repos) {
    // Simulate top contributors for the first repo
    const repo = repos[0];
    const contributors = [
      { name: 'alice', commits: 42 },
      { name: 'bob', commits: 37 },
      { name: 'carol', commits: 29 }
    ];
    document.getElementById('contrib-list').innerHTML =
      `<b>${repo.repo}:</b> ` +
      contributors.map(c => `${c.name} (${c.commits} commits)`).join(', ');
  }

  function renderContribHeatmap() {
  // Simulate 30 days of commit activity
  const days = Array.from({length: 30}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
  const commits = days.map(() => Math.floor(Math.random() * 5));

  Plotly.newPlot('contrib-heatmap', [{
    x: days,
    y: ['Commits'],
    z: [commits],
    type: 'heatmap',
    colorscale: 'YlGnBu'
  }], {
    title: 'Commit Frequency (Simulated)',
    yaxis: { automargin: true }
  });
}

  function renderIssuePRChart() {
  // Simulate data
  const labels = ['Open Issues', 'Closed Issues', 'Open PRs', 'Closed PRs'];
  const values = [12, 34, 7, 28];

  Plotly.newPlot('issue-pr-chart', [{
    x: labels,
    y: values,
    type: 'bar',
    marker: { color: ['#e74c3c', '#2ecc71', '#3498db', '#9b59b6'] }
  }], {
    title: 'Issues & PRs (Simulated)'
  });
}

  // renderLanguageChart(repos);
  // renderGrowthChart(repos, 'stars');
  // renderContributors(repos);
  // renderContribHeatmap();
  // renderIssuePRChart();
});

function getStoredToken() {
  return localStorage.getItem('github_token') || '';
}
function setStoredToken(token) {
  localStorage.setItem('github_token', token);
}

function showTokenModal(onSubmit) {
  const modal = document.getElementById('token-modal');
  const input = document.getElementById('token-input');
  const cancelBtn = document.getElementById('token-cancel');
  const submitBtn = document.getElementById('token-submit');
  input.value = '';
  modal.style.display = 'flex';
  input.focus();

  function cleanup() {
    modal.style.display = 'none';
    submitBtn.removeEventListener('click', submitHandler);
    cancelBtn.removeEventListener('click', cancelHandler);
  }
  function submitHandler() {
    if (input.value.trim()) {
      cleanup();
      onSubmit(input.value.trim());
    }
  }
  function cancelHandler() {
    cleanup();
  }
  submitBtn.addEventListener('click', submitHandler);
  cancelBtn.addEventListener('click', cancelHandler);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') submitHandler();
    if (e.key === 'Escape') cancelHandler();
  });
}

function showStarSuccess(repoName) {
  const modal = document.getElementById('star-success-modal');
  const msg = document.getElementById('star-success-message');
  msg.textContent = `⭐ Star given to "${repoName}" successfully!`;
  modal.style.display = 'flex';
  setTimeout(() => {
    modal.style.display = 'none';
  }, 2000);
}

// Plotly.newPlot('chartDiv', data, layout, {
//   displayModeBar: true,
//   editable: false, // disables editing
//   scrollZoom: true // enables zoom with scroll
// });