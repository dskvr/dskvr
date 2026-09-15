const token = process.env.METRICS_TOKEN;
if (!token) throw new Error("METRICS_TOKEN is required");
const request = async (path, attempt = 0) => {
  const response = await fetch(`https://api.github.com${path}`, {headers: {accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "user-agent": "dskvr-profile-metrics", "x-github-api-version": "2022-11-28"}});
  if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < 2) { await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); return request(path, attempt + 1); }
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const repositories = async path => { const all = []; for (let page = 1;; page += 1) { const batch = await request(`${path}?type=owner&per_page=100&page=${page}`); all.push(...batch); if (batch.length < 100) return all.filter(repository => !repository.fork); } };
const commits = query => request(`/search/commits?q=${encodeURIComponent(query)}&per_page=1`);
const [personalRepositories, organizationRepositories, personalCommits, organizationCommits] = await Promise.all([repositories("/users/dskvr/repos"), repositories("/orgs/sandwichfarm/repos"), commits("author:dskvr user:dskvr"), commits("author:dskvr org:sandwichfarm")]);
const stats = {personal: {repos: personalRepositories.length, stars: personalRepositories.reduce((total, repository) => total + repository.stargazers_count, 0), commits: personalCommits.total_count}, organization: {repos: organizationRepositories.length, stars: organizationRepositories.reduce((total, repository) => total + repository.stargazers_count, 0), commits: organizationCommits.total_count}};
const total = {repos: stats.personal.repos + stats.organization.repos, stars: stats.personal.stars + stats.organization.stars, commits: stats.personal.commits + stats.organization.commits};
const format = value => new Intl.NumberFormat("en-US").format(value);
const stamp = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
process.stdout.write(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="192" role="img" aria-labelledby="title description">
<title id="title">dskvr and sandwichfarm public GitHub activity</title><desc id="description">${format(total.repos)} non-fork repositories, ${format(total.stars)} stars, and ${format(total.commits)} authored commits across dskvr and sandwichfarm.</desc>
<style>text{font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,sans-serif}.title{font-size:22px;font-weight:700;fill:#f0f6fc}.label{font-size:14px;fill:#8b949e}.value{font-size:30px;font-weight:700;fill:#58a6ff}.detail{font-size:13px;fill:#8b949e}.footer{font-size:11px;fill:#6e7681}</style><rect width="720" height="192" rx="12" fill="#0d1117"/>
<text class="title" x="28" y="38">dskvr + sandwichfarm</text><text class="label" x="28" y="61">public GitHub activity</text><line x1="28" y1="78" x2="692" y2="78" stroke="#30363d"/>
<text class="label" x="28" y="108">NON-FORK REPOSITORIES</text><text class="value" x="28" y="142">${format(total.repos)}</text><text class="label" x="278" y="108">STARS</text><text class="value" x="278" y="142">${format(total.stars)}</text><text class="label" x="448" y="108">AUTHORED COMMITS</text><text class="value" x="448" y="142">${format(total.commits)}</text>
<text class="detail" x="28" y="166">dskvr: ${format(stats.personal.repos)} repos · ${format(stats.personal.stars)} stars · ${format(stats.personal.commits)} commits</text><text class="detail" x="28" y="184">sandwichfarm: ${format(stats.organization.repos)} repos · ${format(stats.organization.stars)} stars · ${format(stats.organization.commits)} commits · ${stamp}</text></svg>\n`);
