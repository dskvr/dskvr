const token = process.env.METRICS_TOKEN;
if (!token) throw new Error("METRICS_TOKEN is required");

const sources = [
  { name: "dskvr", repositoryPath: "/users/dskvr/repos", commits: "author:dskvr user:dskvr" },
  { name: "sandwichfarm", repositoryPath: "/orgs/sandwichfarm/repos", commits: "author:dskvr org:sandwichfarm" },
  { name: "napplet", repositoryPath: "/orgs/napplet/repos", commits: "author:dskvr org:napplet" },
  { name: "kehto", repositoryPath: "/orgs/kehto/repos", commits: "author:dskvr org:kehto" },
];

// These forks are maintained as successor projects and belong in the totals.
const maintainedForks = new Set(["sandwichfarm/nsyte"]);

const request = async (path, attempt = 0) => {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "dskvr-profile-metrics",
      "x-github-api-version": "2022-11-28",
    },
  });
  if ([502, 503, 504].includes(response.status) && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    return request(path, attempt + 1);
  }
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};

const repositories = async (path) => {
  const all = [];
  for (let page = 1;; page += 1) {
    const batch = await request(`${path}?type=owner&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) {
      return all.filter((repository) =>
        !repository.fork || maintainedForks.has(repository.full_name)
      );
    }
  }
};

const stats = await Promise.all(sources.map(async (source) => {
  const [ownedRepositories, authoredCommits] = await Promise.all([
    repositories(source.repositoryPath),
    request(`/search/commits?q=${encodeURIComponent(source.commits)}&per_page=1`),
  ]);
  return {
    name: source.name,
    repos: ownedRepositories.length,
    stars: ownedRepositories.reduce(
      (total, repository) => total + repository.stargazers_count,
      0,
    ),
    commits: authoredCommits.total_count,
  };
}));

const total = stats.reduce((sum, source) => ({
  repos: sum.repos + source.repos,
  stars: sum.stars + source.stars,
  commits: sum.commits + source.commits,
}), { repos: 0, stars: 0, commits: 0 });
const format = (value) => new Intl.NumberFormat("en-US").format(value);
const stamp = new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
const detailRows = stats.map((source, index) =>
  `<text class="detail" x="28" y="${166 + index * 18}">${source.name}: ${format(source.repos)} repos · ${format(source.stars)} stars · ${format(source.commits)} commits</text>`
).join("\n");

process.stdout.write(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="246" role="img" aria-labelledby="title description">
<title id="title">dskvr and dskvr's organizations public GitHub activity</title><desc id="description">${format(total.repos)} repositories, ${format(total.stars)} stars, and ${format(total.commits)} authored commits across dskvr, sandwichfarm, napplet, and kehto. Maintained successor forks are included.</desc>
<style>text{font-family:-apple-system,BlinkMacSystemFont,&quot;Segoe UI&quot;,sans-serif}.title{font-size:22px;font-weight:700;fill:#f0f6fc}.label{font-size:14px;fill:#8b949e}.value{font-size:30px;font-weight:700;fill:#58a6ff}.detail{font-size:13px;fill:#8b949e}.footer{font-size:11px;fill:#6e7681}</style><rect width="720" height="246" rx="12" fill="#0d1117"/>
<text class="title" x="28" y="38">dskvr + dskvr's orgs</text><text class="label" x="28" y="61">public GitHub activity · maintained successor forks included</text><line x1="28" y1="78" x2="692" y2="78" stroke="#30363d"/>
<text class="label" x="28" y="108">REPOSITORIES</text><text class="value" x="28" y="142">${format(total.repos)}</text><text class="label" x="278" y="108">STARS</text><text class="value" x="278" y="142">${format(total.stars)}</text><text class="label" x="448" y="108">AUTHORED COMMITS</text><text class="value" x="448" y="142">${format(total.commits)}</text>
${detailRows}<text class="footer" x="692" y="238" text-anchor="end">${stamp}</text></svg>\n`);
