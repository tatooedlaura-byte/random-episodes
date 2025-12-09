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
    couchPotatoDuration: 360, // Default 6 hours in minutes
    streamingServices: [], // User's streaming services
    customServices: [] // User-defined streaming services (e.g., Plex, local drives)
};

// ============================================
// AVAILABLE STREAMING SERVICES
// ============================================
const STREAMING_SERVICES = [
    { id: 'netflix', name: 'Netflix', color: '#E50914' },
    { id: 'hulu', name: 'Hulu', color: '#1CE783' },
    { id: 'prime', name: 'Prime Video', color: '#00A8E1' },
    { id: 'disney', name: 'Disney+', color: '#113CCF' },
    { id: 'hbo', name: 'Max (HBO)', color: '#5822B4' },
    { id: 'peacock', name: 'Peacock', color: '#000000' },
    { id: 'paramount', name: 'Paramount+', color: '#0064FF' },
    { id: 'apple', name: 'Apple TV+', color: '#555555' },
    { id: 'showtime', name: 'Showtime', color: '#FF0000' },
    { id: 'starz', name: 'Starz', color: '#000000' },
    { id: 'amc', name: 'AMC+', color: '#1E88E5' },
    { id: 'discovery', name: 'Discovery+', color: '#0033A0' },
    { id: 'espn', name: 'ESPN+', color: '#FF4747' },
    { id: 'tubi', name: 'Tubi', color: '#FA382F' },
    { id: 'pluto', name: 'Pluto TV', color: '#000000' },
    { id: 'crunchyroll', name: 'Crunchyroll', color: '#F47521' },
    { id: 'network', name: 'Network TV', color: '#666666' },
    { id: 'cable', name: 'Cable TV', color: '#666666' }
];

/**
 * Get all streaming services (built-in + custom)
 * @returns {Array} Combined array of all services
 */
function getAllStreamingServices() {
    const settings = getSettings();
    const customServices = settings.customServices || [];
    return [...STREAMING_SERVICES, ...customServices];
}

/**
 * Add a custom streaming service
 * @param {string} name - Service name (e.g., "Plex", "My NAS")
 * @param {string} color - Hex color for the badge
 * @returns {Object} The created service
 */
function addCustomService(name, color = '#8B5CF6') {
    const settings = getSettings();
    const customServices = settings.customServices || [];

    const newService = {
        id: 'custom_' + generateId(),
        name: name,
        color: color,
        isCustom: true
    };

    customServices.push(newService);
    updateSettings({ customServices });

    return newService;
}

/**
 * Delete a custom streaming service
 * @param {string} serviceId - The service ID to delete
 */
function deleteCustomService(serviceId) {
    const settings = getSettings();
    const customServices = (settings.customServices || []).filter(s => s.id !== serviceId);
    updateSettings({ customServices });

    // Also remove from user's selected services
    const selectedServices = (settings.streamingServices || []).filter(id => id !== serviceId);
    updateSettings({ streamingServices: selectedServices });
}

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
        network: show.network || null, // Original network (e.g., "AMC")
        webChannel: show.webChannel || null, // Streaming platform (e.g., "Netflix")
        streamingServices: show.streamingServices || [], // Where it's available to stream
        streamingLinks: show.streamingLinks || {}, // Deep links to streaming services
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
// BACKUP & RESTORE FUNCTIONS
// ============================================

/**
 * Export all app data to a JSON object
 * @returns {Object} All app data
 */
function exportAllData() {
    return {
        version: 1, // For future compatibility
        exportedAt: new Date().toISOString(),
        shows: getShows(),
        history: getHistory(),
        settings: getSettings()
    };
}

/**
 * Import app data from a JSON object
 * @param {Object} data - Previously exported data
 * @param {boolean} merge - If true, merge with existing data; if false, replace
 * @returns {Object} Result with success status and message
 */
function importAllData(data, merge = false) {
    try {
        // Validate data structure
        if (!data || typeof data !== 'object') {
            return { success: false, message: 'Invalid data format' };
        }

        // Check for required fields
        if (!data.shows && !data.history && !data.settings) {
            return { success: false, message: 'No valid data found in file' };
        }

        if (merge) {
            // Merge mode: add to existing data
            if (data.shows && Array.isArray(data.shows)) {
                const existingShows = getShows();
                const existingTitles = existingShows.map(s => s.title.toLowerCase());

                // Only add shows that don't already exist (by title)
                const newShows = data.shows.filter(s =>
                    !existingTitles.includes(s.title.toLowerCase())
                );

                saveShows([...existingShows, ...newShows]);
            }

            if (data.history && Array.isArray(data.history)) {
                const existingHistory = getHistory();
                // Prepend new history, avoiding duplicates by ID
                const existingIds = existingHistory.map(h => h.id);
                const newHistory = data.history.filter(h => !existingIds.includes(h.id));
                localStorage.setItem(STORAGE_KEYS.HISTORY,
                    JSON.stringify([...newHistory, ...existingHistory])
                );
            }

            if (data.settings) {
                const existingSettings = getSettings();
                updateSettings({ ...existingSettings, ...data.settings });
            }
        } else {
            // Replace mode: overwrite existing data
            if (data.shows && Array.isArray(data.shows)) {
                saveShows(data.shows);
            }

            if (data.history && Array.isArray(data.history)) {
                localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(data.history));
            }

            if (data.settings) {
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
            }
        }

        return {
            success: true,
            message: merge ? 'Data merged successfully' : 'Data imported successfully'
        };
    } catch (error) {
        console.error('Import error:', error);
        return { success: false, message: 'Failed to import data: ' + error.message };
    }
}

/**
 * Download data as a JSON file
 */
function downloadBackup() {
    const data = exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    const filename = `random-episode-picker-backup-${date}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
