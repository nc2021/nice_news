const form = document.getElementById("search-form");
const queryInput = document.getElementById("query");
const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
}

function renderResults(items) {
  resultsEl.innerHTML = "";

  if (!items || items.length === 0) {
    resultsEl.innerHTML = "<li class=\"empty\">No results found.</li>";
    return;
  }

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "news-item";

    const titleLink = document.createElement("a");
    titleLink.href = item.link || "#";
    titleLink.textContent = item.title || "Untitled";
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [item.source, item.date].filter(Boolean).join(" • ");

    const snippet = document.createElement("p");
    snippet.className = "snippet";
    snippet.textContent = item.snippet || "";

    li.appendChild(titleLink);
    li.appendChild(meta);
    li.appendChild(snippet);
    resultsEl.appendChild(li);
  }
}

async function fetchNews(query) {
  setStatus("Loading...");
  try {
    const response = await fetch(`/api/news?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Request failed");
    }

    renderResults(data.items);
    setStatus(`Showing results for "${data.query}"`);
  } catch (error) {
    renderResults([]);
    setStatus(`Error: ${error.message}`);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  fetchNews(queryInput.value.trim() || "good news");
});

fetchNews("good news");
