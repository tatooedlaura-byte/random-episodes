/**
 * Main Application - UI logic and event handlers
 *
 * This file handles all user interactions, DOM manipulation,
 * and coordinates between the data layer and helper functions.
 */

// ============================================
// STATE
// ============================================

// Current Couch Potato queue
let currentQueue = null;
let currentQueueIndex = 0;

// Currently selected show for detail modal
let selectedShowId = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeShowsList();
    initializeRandomPicker();
    initializeCouchPotato();
    initializeHistory();
    initializeModals();

    // Render initial state
    renderShowsList();
    renderHistory();
    loadCouchPotatoSettings();
});

// ============================================
// TAB NAVIGATION
// ============================================

function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.dataset.tab + '-tab';
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// ============================================
// SHOWS LIST
// ============================================

function initializeShowsList() {
    document.getElementById('add-show-btn').addEventListener('click', () => {
        openAddShowModal();
    });
}

function renderShowsList() {
    const container = document.getElementById('shows-list');
    const shows = getShows();

    if (shows.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No shows added yet.</p>
                <p>Click "+ Add Show" to get started!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = shows.map(show => {
        const progress = calculateShowProgress(show);
        return `
            <div class="show-card" data-show-id="${show.id}">
                <div class="show-info">
                    <h3 class="show-title">${escapeHtml(show.title)}</h3>
                    <span class="show-progress-text">${progress.watched}/${progress.total} episodes</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress.percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers to show cards
    container.querySelectorAll('.show-card').forEach(card => {
        card.addEventListener('click', () => {
            openShowDetailModal(card.dataset.showId);
        });
    });
}

// ============================================
// RANDOM EPISODE PICKER
// ============================================

function initializeRandomPicker() {
    document.getElementById('randomize-btn').addEventListener('click', handleRandomize);
}

function handleRandomize() {
    const shows = getShows();
    const result = pickRandomEpisode(shows);

    const pickedContainer = document.getElementById('picked-episode');
    const noEpisodesMsg = document.getElementById('no-episodes-msg');

    if (!result) {
        pickedContainer.classList.add('hidden');
        noEpisodesMsg.classList.remove('hidden');
        return;
    }

    noEpisodesMsg.classList.add('hidden');
    pickedContainer.classList.remove('hidden');

    const { show, episode } = result;
    pickedContainer.innerHTML = `
        <div class="picked-card">
            <h2 class="picked-show">${escapeHtml(show.title)}</h2>
            <div class="picked-details">
                <span class="episode-code">${formatEpisodeCode(episode.season, episode.episodeNumber)}</span>
                <span class="episode-title">${escapeHtml(episode.title)}</span>
                <span class="episode-runtime">${formatRuntime(episode.runtime)}</span>
            </div>
            <button class="btn btn-primary mark-watched-btn"
                    data-show-id="${show.id}"
                    data-episode-id="${episode.id}">
                Mark as Watched
            </button>
        </div>
    `;

    // Add click handler
    pickedContainer.querySelector('.mark-watched-btn').addEventListener('click', (e) => {
        const showId = e.target.dataset.showId;
        const episodeId = e.target.dataset.episodeId;
        setEpisodeWatched(showId, episodeId, true);
        renderShowsList();
        renderHistory();

        // Auto-randomize next episode
        handleRandomize();
    });
}

// ============================================
// COUCH POTATO MODE
// ============================================

function initializeCouchPotato() {
    // Duration buttons
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('custom-minutes').value = '';
            updateSettings({ couchPotatoDuration: parseInt(btn.dataset.minutes) });
        });
    });

    // Custom duration input
    document.getElementById('custom-minutes').addEventListener('change', (e) => {
        const value = parseInt(e.target.value);
        if (value && value >= 30) {
            document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
            updateSettings({ couchPotatoDuration: value });
        }
    });

    // Build queue button
    document.getElementById('build-queue-btn').addEventListener('click', handleBuildQueue);
    document.getElementById('rebuild-queue-btn').addEventListener('click', handleBuildQueue);

    // Start watching button
    document.getElementById('start-watching-btn').addEventListener('click', handleStartWatching);
}

function loadCouchPotatoSettings() {
    const settings = getSettings();
    const duration = settings.couchPotatoDuration || 360;

    // Set active button or custom value
    const matchingBtn = document.querySelector(`.duration-btn[data-minutes="${duration}"]`);
    if (matchingBtn) {
        document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
        matchingBtn.classList.add('active');
    } else {
        document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('custom-minutes').value = duration;
    }
}

function handleBuildQueue() {
    const settings = getSettings();
    const shows = getShows();

    if (!hasUnwatchedEpisodes(shows)) {
        alert('No unwatched episodes available!');
        return;
    }

    currentQueue = generateCouchPotatoQueue(settings.couchPotatoDuration);
    currentQueueIndex = 0;

    renderQueue();

    document.getElementById('binge-queue').classList.remove('hidden');
    document.getElementById('rebuild-queue-btn').classList.remove('hidden');
    document.getElementById('now-watching').classList.add('hidden');
}

function renderQueue() {
    if (!currentQueue || currentQueue.episodes.length === 0) {
        document.getElementById('queue-list').innerHTML = '<p>No episodes in queue.</p>';
        return;
    }

    const queueList = document.getElementById('queue-list');
    queueList.innerHTML = currentQueue.episodes.map((ep, index) => `
        <div class="queue-item ${ep.watched ? 'watched' : ''} ${index === currentQueueIndex ? 'current' : ''}">
            <div class="queue-item-info">
                <span class="queue-number">${index + 1}.</span>
                <div class="queue-details">
                    <span class="queue-show">${escapeHtml(ep.showTitle)}</span>
                    <span class="queue-episode">
                        ${formatEpisodeCode(ep.season, ep.episodeNumber)}
                        - ${escapeHtml(ep.episodeTitle)}
                    </span>
                </div>
            </div>
            <span class="queue-runtime">${formatRuntime(ep.runtime)}</span>
        </div>
    `).join('');

    // Update total runtime
    document.getElementById('total-runtime').textContent =
        `Total: ${formatRuntime(currentQueue.totalRuntime)} (Target: ${formatRuntime(currentQueue.targetRuntime)})`;
}

function handleStartWatching() {
    if (!currentQueue || currentQueue.episodes.length === 0) return;

    document.getElementById('binge-queue').classList.add('hidden');
    renderNowWatching();
}

function renderNowWatching() {
    if (!currentQueue || currentQueueIndex >= currentQueue.episodes.length) {
        // Queue complete
        document.getElementById('now-watching').innerHTML = `
            <div class="queue-complete">
                <h2>Queue Complete!</h2>
                <p>You've watched all episodes in your queue.</p>
                <button class="btn btn-primary" onclick="handleBuildQueue()">Build New Queue</button>
            </div>
        `;
        document.getElementById('now-watching').classList.remove('hidden');
        return;
    }

    const episode = currentQueue.episodes[currentQueueIndex];
    const remaining = currentQueue.episodes.slice(currentQueueIndex + 1);
    const remainingRuntime = remaining.reduce((sum, ep) => sum + ep.runtime, 0);

    document.getElementById('now-watching').innerHTML = `
        <div class="now-watching-card">
            <span class="now-label">Now Watching</span>
            <h2>${escapeHtml(episode.showTitle)}</h2>
            <div class="now-details">
                <span class="episode-code">${formatEpisodeCode(episode.season, episode.episodeNumber)}</span>
                <span class="episode-title">${escapeHtml(episode.episodeTitle)}</span>
                <span class="episode-runtime">${formatRuntime(episode.runtime)}</span>
            </div>
            <div class="now-actions">
                <button class="btn btn-primary" id="mark-queue-watched-btn">
                    Mark Watched & Next
                </button>
                <button class="btn btn-secondary" id="skip-episode-btn">
                    Skip
                </button>
            </div>
            <div class="queue-remaining">
                <span>${remaining.length} episodes remaining (${formatRuntime(remainingRuntime)})</span>
            </div>
        </div>
        <div class="up-next">
            <h3>Up Next</h3>
            ${remaining.slice(0, 3).map(ep => `
                <div class="up-next-item">
                    <span>${escapeHtml(ep.showTitle)} - ${formatEpisodeCode(ep.season, ep.episodeNumber)}</span>
                    <span>${formatRuntime(ep.runtime)}</span>
                </div>
            `).join('')}
            ${remaining.length > 3 ? `<p class="more-episodes">+${remaining.length - 3} more...</p>` : ''}
        </div>
    `;

    document.getElementById('now-watching').classList.remove('hidden');

    // Event handlers
    document.getElementById('mark-queue-watched-btn').addEventListener('click', () => {
        markCurrentQueueEpisodeWatched();
    });

    document.getElementById('skip-episode-btn').addEventListener('click', () => {
        currentQueueIndex++;
        renderNowWatching();
    });
}

function markCurrentQueueEpisodeWatched() {
    if (!currentQueue || currentQueueIndex >= currentQueue.episodes.length) return;

    const episode = currentQueue.episodes[currentQueueIndex];

    // Mark in actual storage
    setEpisodeWatched(episode.showId, episode.episodeId, true);

    // Mark in queue
    episode.watched = true;

    // Advance to next
    currentQueueIndex++;

    // Update UI
    renderShowsList();
    renderHistory();
    renderNowWatching();
}

// ============================================
// WATCH HISTORY
// ============================================

function initializeHistory() {
    document.getElementById('clear-history-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all watch history?')) {
            clearHistory();
            renderHistory();
        }
    });
}

function renderHistory() {
    const container = document.getElementById('history-list');
    const history = getHistory();

    if (history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No watch history yet.</p>
                <p>Mark episodes as watched to see them here.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map(entry => {
        const date = new Date(entry.watchedAt);
        const formattedDate = date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
        });
        const formattedTime = date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit'
        });

        return `
            <div class="history-item">
                <div class="history-info">
                    <span class="history-show">${escapeHtml(entry.showTitle)}</span>
                    <span class="history-episode">
                        ${formatEpisodeCode(entry.season, entry.episodeNumber)}
                        - ${escapeHtml(entry.episodeTitle)}
                    </span>
                </div>
                <div class="history-meta">
                    <span class="history-runtime">${formatRuntime(entry.runtime)}</span>
                    <span class="history-date">${formattedDate} at ${formattedTime}</span>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// MODALS
// ============================================

function initializeModals() {
    // Close buttons
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeAllModals();
        });
    });

    // Click outside to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeAllModals();
            }
        });
    });

    // Add show form
    document.getElementById('add-show-form').addEventListener('submit', handleAddShow);
    document.getElementById('add-episode-btn').addEventListener('click', addEpisodeInput);
    document.getElementById('quick-add-btn').addEventListener('click', handleQuickAdd);

    // Delete show button
    document.getElementById('delete-show-btn').addEventListener('click', handleDeleteShow);
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    selectedShowId = null;
}

// ============================================
// ADD SHOW MODAL
// ============================================

function openAddShowModal() {
    document.getElementById('add-show-modal').classList.remove('hidden');
    document.getElementById('show-title').value = '';
    document.getElementById('episodes-input').innerHTML = '';
    document.getElementById('num-seasons').value = '';
    document.getElementById('eps-per-season').value = '';
    document.getElementById('runtime').value = '';

    // Add one initial episode input
    addEpisodeInput();
}

function addEpisodeInput() {
    const container = document.getElementById('episodes-input');
    const index = container.children.length;

    const episodeDiv = document.createElement('div');
    episodeDiv.className = 'episode-input-row';
    episodeDiv.innerHTML = `
        <input type="number" placeholder="S" min="1" class="ep-season" required>
        <input type="number" placeholder="E" min="1" class="ep-number" required>
        <input type="text" placeholder="Title (optional)" class="ep-title">
        <input type="number" placeholder="Min" min="1" class="ep-runtime" required>
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(episodeDiv);
}

function handleQuickAdd() {
    const numSeasons = parseInt(document.getElementById('num-seasons').value);
    const epsPerSeason = parseInt(document.getElementById('eps-per-season').value);
    const runtime = parseInt(document.getElementById('runtime').value);

    if (!numSeasons || !epsPerSeason || !runtime) {
        alert('Please fill in all quick add fields');
        return;
    }

    const container = document.getElementById('episodes-input');
    container.innerHTML = '';

    for (let s = 1; s <= numSeasons; s++) {
        for (let e = 1; e <= epsPerSeason; e++) {
            const episodeDiv = document.createElement('div');
            episodeDiv.className = 'episode-input-row';
            episodeDiv.innerHTML = `
                <input type="number" placeholder="S" min="1" class="ep-season" value="${s}" required>
                <input type="number" placeholder="E" min="1" class="ep-number" value="${e}" required>
                <input type="text" placeholder="Title (optional)" class="ep-title" value="Episode ${e}">
                <input type="number" placeholder="Min" min="1" class="ep-runtime" value="${runtime}" required>
                <button type="button" class="btn-remove" onclick="this.parentElement.remove()">&times;</button>
            `;
            container.appendChild(episodeDiv);
        }
    }
}

function handleAddShow(e) {
    e.preventDefault();

    const title = document.getElementById('show-title').value.trim();
    if (!title) {
        alert('Please enter a show title');
        return;
    }

    const episodeRows = document.querySelectorAll('.episode-input-row');
    const episodes = [];

    episodeRows.forEach(row => {
        const season = parseInt(row.querySelector('.ep-season').value);
        const episodeNumber = parseInt(row.querySelector('.ep-number').value);
        const epTitle = row.querySelector('.ep-title').value.trim() || `Episode ${episodeNumber}`;
        const runtime = parseInt(row.querySelector('.ep-runtime').value);

        if (season && episodeNumber && runtime) {
            episodes.push({ season, episodeNumber, title: epTitle, runtime });
        }
    });

    if (episodes.length === 0) {
        alert('Please add at least one episode');
        return;
    }

    addShow({ title, episodes });
    closeAllModals();
    renderShowsList();
}

// ============================================
// SHOW DETAIL MODAL
// ============================================

function openShowDetailModal(showId) {
    selectedShowId = showId;
    const show = getShowById(showId);

    if (!show) return;

    document.getElementById('modal-show-title').textContent = show.title;
    renderEpisodeList(show);
    document.getElementById('show-detail-modal').classList.remove('hidden');
}

function renderEpisodeList(show) {
    const container = document.getElementById('episode-list');

    // Group by season
    const seasons = {};
    show.episodes.forEach(ep => {
        if (!seasons[ep.season]) {
            seasons[ep.season] = [];
        }
        seasons[ep.season].push(ep);
    });

    let html = '';
    Object.keys(seasons).sort((a, b) => a - b).forEach(season => {
        const eps = seasons[season].sort((a, b) => a.episodeNumber - b.episodeNumber);

        html += `<div class="season-group">
            <h3 class="season-header">Season ${season}</h3>
            ${eps.map(ep => `
                <label class="episode-row ${ep.watched ? 'watched' : ''}">
                    <input type="checkbox"
                           ${ep.watched ? 'checked' : ''}
                           data-episode-id="${ep.id}"
                           onchange="handleEpisodeToggle('${show.id}', '${ep.id}', this.checked)">
                    <span class="ep-code">${formatEpisodeCode(ep.season, ep.episodeNumber)}</span>
                    <span class="ep-name">${escapeHtml(ep.title)}</span>
                    <span class="ep-time">${formatRuntime(ep.runtime)}</span>
                </label>
            `).join('')}
        </div>`;
    });

    container.innerHTML = html;
}

function handleEpisodeToggle(showId, episodeId, watched) {
    setEpisodeWatched(showId, episodeId, watched);

    // Re-render the episode list to update styles
    const show = getShowById(showId);
    if (show) {
        renderEpisodeList(show);
    }

    // Update shows list in background
    renderShowsList();
    renderHistory();
}

function handleDeleteShow() {
    if (!selectedShowId) return;

    if (confirm('Are you sure you want to delete this show? This cannot be undone.')) {
        deleteShow(selectedShowId);
        closeAllModals();
        renderShowsList();
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
