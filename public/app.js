const form = document.getElementById("search-form");
const modeSelect = document.getElementById("mode");
const queryInput = document.getElementById("query");
const refreshButton = document.getElementById("refresh");
const resultsEl = document.getElementById("results");
const historyEl = document.getElementById("history");
const statusEl = document.getElementById("status");

function setStatus(message, state = "info") {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function renderResults(items) {
  resultsEl.innerHTML = "";

  if (!items || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No results found.";
    resultsEl.appendChild(empty);
    return;
  }

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "news-card";

    const header = document.createElement("div");
    header.className = "card-header";

    const titleLink = document.createElement("a");
    titleLink.href = item.link || "#";
    titleLink.textContent = item.title || "Untitled";
    titleLink.target = "_blank";
    titleLink.rel = "noopener noreferrer";

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = [item.source, item.date].filter(Boolean).join(" • ");

    header.appendChild(titleLink);
    header.appendChild(meta);

    const snippet = document.createElement("p");
    snippet.className = "snippet";
    snippet.textContent = item.snippet || "";

    card.appendChild(header);
    card.appendChild(snippet);

    if (item.thumbnail) {
      const thumb = document.createElement("img");
      thumb.className = "thumbnail";
      thumb.src = item.thumbnail;
      thumb.alt = item.title ? `${item.title} thumbnail` : "News thumbnail";
      card.appendChild(thumb);
    }

    resultsEl.appendChild(card);
  }
}

function renderHistory(history) {
  historyEl.innerHTML = "";

  if (!history || history.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No recent searches yet.";
    historyEl.appendChild(li);
    return;
  }

  for (const entry of history) {
    const li = document.createElement("li");
    const createdAt = document.createElement("span");
    createdAt.className = "history-date";
    createdAt.textContent = entry.created_at;

    const query = document.createElement("span");
    query.className = "history-query";
    query.textContent = entry.query;

    li.appendChild(createdAt);
    li.appendChild(document.createTextNode(" — "));
    li.appendChild(query);
    historyEl.appendChild(li);
  }
}

async function fetchHistory(limit = 20) {
  try {
    const response = await fetch(`/api/history?limit=${encodeURIComponent(limit)}`);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Unable to load history");
    }

    renderHistory(data.history);
  } catch (error) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = `History unavailable: ${error.message}`;
    historyEl.innerHTML = "";
    historyEl.appendChild(li);
  }
}

async function fetchNews() {
  const mode = modeSelect.value || "good";
  const query = (queryInput.value || "").trim();
  const params = new URLSearchParams({ mode });
  if (query) {
    params.set("q", query);
  }

  setStatus("Loading stories...", "loading");
  refreshButton.disabled = true;

  try {
    const response = await fetch(`/api/news?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Request failed");
    }

    renderResults(data.items);
    setStatus(
      `Showing ${data.items?.length ?? 0} stories for "${data.query}" (mode: ${data.mode})`,
      "success",
    );
    fetchHistory();
  } catch (error) {
    renderResults([]);
    setStatus(`Error: ${error.message}`, "error");
  } finally {
    refreshButton.disabled = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  fetchNews();
});

fetchNews();
