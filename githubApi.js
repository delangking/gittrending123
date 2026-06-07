// githubApi.js
// This file provides GitHub API helpers for starring repositories and fetching README content.

const axios = require('axios');

const GITHUB_API_URL = 'https://api.github.com';

async function getReadme(owner, repo, token) {
  const headers = {
    Accept: 'application/vnd.github.v3.raw'
  };
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  const response = await axios.get(`${GITHUB_API_URL}/repos/${owner}/${repo}/readme`, { headers });
  return response.data;
}

async function starRepo(owner, repo, token) {
  const response = await axios.put(`${GITHUB_API_URL}/user/starred/${owner}/${repo}`, {}, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  return response.status === 204; // No content means success
}

module.exports = { getReadme, starRepo };