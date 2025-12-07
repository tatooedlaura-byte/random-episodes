/**
 * Data Layer - Handles all localStorage operations and data models
 *
 * Data Structure:
 * - shows: Array of show objects
 * - history: Array of watched episode entries with timestamps
 * - settings: User preferences (couch potato duration, etc.)
 */

// ============================================
// STORAGE KEYS
// ============================================
const STORAGE_KEYS = {
    SHOWS: 'randomEpisodePicker_shows',
    HISTORY: 'randomEpisodePicker_history',
    SETTINGS: 'randomEpisodePicker_settings'
};

// ============================================
// DEFAULT DATA
// ============================================
const DEFAULT_SETTINGS = {
    couchPotatoDuration: 360 // Default 6 hours in minutes
};

// ============================================
// DATA ACCESS FUNCTIONS
// ============================================

/**
 * Get all shows from localStorage
 * @returns {Array} Array of show objects
 */
function getShows() {
    const data = localStorage.getItem(STORAGE_KEYS.SHOWS);
    return data ? JSON.parse(data) : [];
}

/**
 * Save shows array to localStorage
 * @param {Array} shows - Array of show objects
 */
function saveShows(shows) {
    localStorage.setItem(STORAGE_KEYS.SHOWS, JSON.stringify(shows));
}

/**
 * Get a single show by ID
 * @param {string} showId - The show's unique ID
 * @returns {Object|null} The show object or null if not found
 */
function getShowById(showId) {
    const shows = getShows();
    return shows.find(show => show.id === showId) || null;
}

/**
 * Add a new show
 * @param {Object} show - Show object with title and episodes
 * @returns {Object} The created show with generated ID
 */
function addShow(show) {
    const shows = getShows();
    const newShow = {
        id: generateId(),
        title: show.title,
        episodes: show.episodes.map((ep, index) => ({
            id: generateId(),
            season: ep.season,
            episodeNumber: ep.episodeNumber,
            title: ep.title || `Episode ${ep.episodeNumber}`,
            runtime: ep.runtime,
            watched: false,
            order: index // Preserves the intended watch order
        })),
        createdAt: new Date().toISOString()
    };
    shows.push(newShow);
    saveShows(shows);
    return newShow;
}

/**
 * Update a show
 * @param {string} showId - The show's ID
 * @param {Object} updates - Partial show object with updates
 */
function updateShow(showId, updates) {
    const shows = getShows();
    const index = shows.findIndex(show => show.id === showId);
    if (index !== -1) {
        shows[index] = { ...shows[index], ...updates };
        saveShows(shows);
    }
}

/**
 * Delete a show
 * @param {string} showId - The show's ID to delete
 */
function deleteShow(showId) {
    const shows = getShows();
    const filtered = shows.filter(show => show.id !== showId);
    saveShows(filtered);
}

/**
 * Mark an episode as watched/unwatched
 * @param {string} showId - The show's ID
 * @param {string} episodeId - The episode's ID
 * @param {boolean} watched - Watched status
 */
function setEpisodeWatched(showId, episodeId, watched) {
    const shows = getShows();
    const show = shows.find(s => s.id === showId);
    if (show) {
        const episode = show.episodes.find(ep => ep.id === episodeId);
        if (episode) {
            episode.watched = watched;
            saveShows(shows);

            // Add to history if marking as watched
            if (watched) {
                addToHistory(show, episode);
            }
        }
    }
}

// ============================================
// HISTORY FUNCTIONS
// ============================================

/**
 * Get watch history
 * @returns {Array} Array of history entries (newest first)
 */
function getHistory() {
    const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return data ? JSON.parse(data) : [];
}

/**
 * Add an episode to watch history
 * @param {Object} show - The show object
 * @param {Object} episode - The episode object
 */
function addToHistory(show, episode) {
    const history = getHistory();
    history.unshift({
        id: generateId(),
        showId: show.id,
        showTitle: show.title,
        episodeId: episode.id,
        season: episode.season,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title,
        runtime: episode.runtime,
        watchedAt: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
}

/**
 * Clear all watch history
 */
function clearHistory() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================

/**
 * Get user settings
 * @returns {Object} Settings object
 */
function getSettings() {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : { ...DEFAULT_SETTINGS };
}

/**
 * Update settings
 * @param {Object} updates - Partial settings object
 */
function updateSettings(updates) {
    const settings = getSettings();
    const newSettings = { ...settings, ...updates };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format runtime in minutes to human readable string
 * @param {number} minutes - Runtime in minutes
 * @returns {string} Formatted string (e.g., "2h 30m")
 */
function formatRuntime(minutes) {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format episode code (e.g., "S01E05")
 * @param {number} season - Season number
 * @param {number} episode - Episode number
 * @returns {string} Formatted episode code
 */
function formatEpisodeCode(season, episode) {
    const s = String(season).padStart(2, '0');
    const e = String(episode).padStart(2, '0');
    return `S${s}E${e}`;
}
