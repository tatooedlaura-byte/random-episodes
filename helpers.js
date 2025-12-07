/**
 * Helper Functions - Core randomizer logic and utility functions
 *
 * These functions are modular and shared between single-episode mode
 * and Couch Potato Mode to ensure consistent behavior.
 */

// ============================================
// CORE RANDOMIZER FUNCTIONS
// ============================================

/**
 * Get the next unwatched episode for a show
 * Returns the first unwatched episode in order (by season, then episode number)
 *
 * @param {Object} show - Show object with episodes array
 * @returns {Object|null} The next unwatched episode or null if all watched
 */
function getNextUnwatchedEpisode(show) {
    if (!show || !show.episodes || show.episodes.length === 0) {
        return null;
    }

    // Sort episodes by season, then by episode number to get proper order
    const sortedEpisodes = [...show.episodes].sort((a, b) => {
        if (a.season !== b.season) {
            return a.season - b.season;
        }
        return a.episodeNumber - b.episodeNumber;
    });

    // Find the first unwatched episode
    return sortedEpisodes.find(ep => !ep.watched) || null;
}

/**
 * Pick a random show that has unwatched episodes
 *
 * @param {Array} shows - Array of show objects
 * @returns {Object|null} A random show with unwatched episodes, or null if none available
 */
function pickRandomShowWithUnwatchedEpisodes(shows) {
    if (!shows || shows.length === 0) {
        return null;
    }

    // Filter to only shows that have at least one unwatched episode
    const showsWithUnwatched = shows.filter(show => {
        return show.episodes && show.episodes.some(ep => !ep.watched);
    });

    if (showsWithUnwatched.length === 0) {
        return null;
    }

    // Pick a random show from the filtered list
    const randomIndex = Math.floor(Math.random() * showsWithUnwatched.length);
    return showsWithUnwatched[randomIndex];
}

/**
 * Pick a random episode using the combined logic:
 * 1. Pick a random show with unwatched episodes
 * 2. Get the next unwatched episode from that show
 *
 * @param {Array} shows - Array of show objects
 * @returns {Object|null} Object with { show, episode } or null if none available
 */
function pickRandomEpisode(shows) {
    const show = pickRandomShowWithUnwatchedEpisodes(shows);
    if (!show) {
        return null;
    }

    const episode = getNextUnwatchedEpisode(show);
    if (!episode) {
        return null;
    }

    return { show, episode };
}

/**
 * Generate a Couch Potato Mode queue
 * Builds a watch queue by repeatedly picking random shows and their next episodes
 * until the target duration is reached
 *
 * @param {number} minutesGoal - Target duration in minutes
 * @param {Array} shows - Array of show objects (optional, will fetch from storage if not provided)
 * @returns {Object} Queue object with episodes array and total runtime
 */
function generateCouchPotatoQueue(minutesGoal, shows = null) {
    // Get shows if not provided
    const allShows = shows || getShows();

    // Create a deep copy so we can track "virtual" watched status
    // without modifying the actual data
    const showsCopy = JSON.parse(JSON.stringify(allShows));

    const queue = [];
    let totalRuntime = 0;

    // Keep adding episodes until we reach or exceed the goal
    // or until there are no more unwatched episodes
    while (totalRuntime < minutesGoal) {
        const result = pickRandomEpisode(showsCopy);

        if (!result) {
            // No more unwatched episodes available
            break;
        }

        const { show, episode } = result;

        // Add to queue
        queue.push({
            showId: show.id,
            showTitle: show.title,
            episodeId: episode.id,
            season: episode.season,
            episodeNumber: episode.episodeNumber,
            episodeTitle: episode.title,
            runtime: episode.runtime,
            watched: false // Track if watched during this session
        });

        totalRuntime += episode.runtime;

        // Mark as watched in our copy so we don't pick it again
        const showInCopy = showsCopy.find(s => s.id === show.id);
        if (showInCopy) {
            const epInCopy = showInCopy.episodes.find(e => e.id === episode.id);
            if (epInCopy) {
                epInCopy.watched = true;
            }
        }
    }

    return {
        episodes: queue,
        totalRuntime: totalRuntime,
        targetRuntime: minutesGoal
    };
}

// ============================================
// PROGRESS CALCULATION HELPERS
// ============================================

/**
 * Calculate progress for a show
 *
 * @param {Object} show - Show object with episodes array
 * @returns {Object} Progress object with watched, total, and percentage
 */
function calculateShowProgress(show) {
    if (!show || !show.episodes || show.episodes.length === 0) {
        return { watched: 0, total: 0, percentage: 0 };
    }

    const total = show.episodes.length;
    const watched = show.episodes.filter(ep => ep.watched).length;
    const percentage = Math.round((watched / total) * 100);

    return { watched, total, percentage };
}

/**
 * Calculate total runtime of unwatched episodes for a show
 *
 * @param {Object} show - Show object
 * @returns {number} Total unwatched runtime in minutes
 */
function getUnwatchedRuntime(show) {
    if (!show || !show.episodes) return 0;

    return show.episodes
        .filter(ep => !ep.watched)
        .reduce((sum, ep) => sum + (ep.runtime || 0), 0);
}

/**
 * Calculate total runtime of all unwatched episodes across all shows
 *
 * @param {Array} shows - Array of shows
 * @returns {number} Total unwatched runtime in minutes
 */
function getTotalUnwatchedRuntime(shows) {
    if (!shows) return 0;
    return shows.reduce((sum, show) => sum + getUnwatchedRuntime(show), 0);
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Check if there are any unwatched episodes available
 *
 * @param {Array} shows - Array of show objects
 * @returns {boolean} True if at least one unwatched episode exists
 */
function hasUnwatchedEpisodes(shows) {
    if (!shows || shows.length === 0) return false;

    return shows.some(show =>
        show.episodes && show.episodes.some(ep => !ep.watched)
    );
}

/**
 * Validate episode data
 *
 * @param {Object} episode - Episode object to validate
 * @returns {Object} Object with isValid boolean and errors array
 */
function validateEpisode(episode) {
    const errors = [];

    if (!episode.season || episode.season < 1) {
        errors.push('Season must be a positive number');
    }
    if (!episode.episodeNumber || episode.episodeNumber < 1) {
        errors.push('Episode number must be a positive number');
    }
    if (!episode.runtime || episode.runtime < 1) {
        errors.push('Runtime must be a positive number');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}
