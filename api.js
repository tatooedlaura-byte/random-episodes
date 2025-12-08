/**
 * TV Show API Integration
 * Uses TVMaze API for show/episode data
 * Uses WatchMode API for real streaming availability
 */

// WatchMode API key
const WATCHMODE_API_KEY = 'KcfQmPYFnR68GNF0xWxfu6Wz5qtJzN5BnQMHSfRw';

// Map WatchMode source IDs to our internal service IDs
const WATCHMODE_SOURCE_MAP = {
    203: 'netflix',      // Netflix
    157: 'hulu',         // Hulu
    387: 'hbo',          // Max (HBO)
    26: 'prime',         // Prime Video
    372: 'disney',       // Disney+
    371: 'apple',        // Apple TV+
    444: 'paramount',    // Paramount+
    389: 'peacock',      // Peacock Premium
    388: 'peacock',      // Peacock (free)
    368: 'showtime',     // Showtime
    232: 'starz',        // Starz
    78: 'amc',           // AMC+
    403: 'discovery',    // Discovery+
    390: 'espn',         // ESPN+
    73: 'tubi',          // Tubi
    300: 'pluto',        // Pluto TV
    283: 'crunchyroll',  // Crunchyroll
};

const TV_API = {
    BASE_URL: 'https://api.tvmaze.com',
    WATCHMODE_URL: 'https://api.watchmode.com/v1',

    /**
     * Search for TV shows by name
     * @param {string} query - Search term
     * @returns {Promise<Array>} Array of show results
     */
    async searchShows(query) {
        try {
            const response = await fetch(
                `${this.BASE_URL}/search/shows?q=${encodeURIComponent(query)}`
            );

            if (!response.ok) {
                throw new Error('Search failed');
            }

            const results = await response.json();

            // Transform results to simpler format
            return results.map(item => ({
                id: item.show.id,
                imdbId: item.show.externals?.imdb || null,
                name: item.show.name,
                premiered: item.show.premiered ? item.show.premiered.split('-')[0] : null,
                status: item.show.status,
                runtime: item.show.runtime || item.show.averageRuntime || 30,
                genres: item.show.genres || [],
                image: item.show.image ? item.show.image.medium : null,
                summary: item.show.summary ? item.show.summary.replace(/<[^>]*>/g, '') : null
            }));
        } catch (error) {
            console.error('Error searching shows:', error);
            throw error;
        }
    },

    /**
     * Get all episodes for a show
     * @param {number} showId - TVMaze show ID
     * @returns {Promise<Array>} Array of episodes
     */
    async getEpisodes(showId) {
        try {
            const response = await fetch(
                `${this.BASE_URL}/shows/${showId}/episodes`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch episodes');
            }

            const episodes = await response.json();

            // Transform to our format
            return episodes.map(ep => ({
                season: ep.season,
                episodeNumber: ep.number,
                title: ep.name || `Episode ${ep.number}`,
                runtime: ep.runtime || 30 // Default to 30 min if not specified
            }));
        } catch (error) {
            console.error('Error fetching episodes:', error);
            throw error;
        }
    },

    /**
     * Get streaming availability from WatchMode API
     * @param {string} imdbId - IMDB ID of the show
     * @param {string} showName - Show name (fallback for search)
     * @returns {Promise<Array>} Array of streaming service IDs
     */
    async getStreamingAvailability(imdbId, showName) {
        try {
            let titleId = null;

            // First, try to get WatchMode title ID from IMDB ID
            if (imdbId) {
                const searchResponse = await fetch(
                    `${this.WATCHMODE_URL}/search/?apiKey=${WATCHMODE_API_KEY}&search_field=imdb_id&search_value=${imdbId}`
                );

                if (searchResponse.ok) {
                    const searchResults = await searchResponse.json();
                    if (searchResults.title_results && searchResults.title_results.length > 0) {
                        titleId = searchResults.title_results[0].id;
                    }
                }
            }

            // If no IMDB ID or not found, search by name
            if (!titleId && showName) {
                const searchResponse = await fetch(
                    `${this.WATCHMODE_URL}/search/?apiKey=${WATCHMODE_API_KEY}&search_field=name&search_value=${encodeURIComponent(showName)}&types=tv`
                );

                if (searchResponse.ok) {
                    const searchResults = await searchResponse.json();
                    if (searchResults.title_results && searchResults.title_results.length > 0) {
                        // Try to find exact match first
                        const exactMatch = searchResults.title_results.find(
                            r => r.name.toLowerCase() === showName.toLowerCase()
                        );
                        titleId = exactMatch ? exactMatch.id : searchResults.title_results[0].id;
                    }
                }
            }

            if (!titleId) {
                console.log('Could not find WatchMode title ID for:', showName);
                return [];
            }

            // Get streaming sources for the title
            const sourcesResponse = await fetch(
                `${this.WATCHMODE_URL}/title/${titleId}/sources/?apiKey=${WATCHMODE_API_KEY}&regions=US`
            );

            if (!sourcesResponse.ok) {
                throw new Error('Failed to fetch streaming sources');
            }

            const sources = await sourcesResponse.json();

            // Filter to subscription services and map to our IDs
            const streamingServices = [];
            const seenServices = new Set();

            for (const source of sources) {
                // Only include subscription/free streaming (not rent/buy)
                if (source.type === 'sub' || source.type === 'free') {
                    const ourServiceId = WATCHMODE_SOURCE_MAP[source.source_id];
                    if (ourServiceId && !seenServices.has(ourServiceId)) {
                        seenServices.add(ourServiceId);
                        streamingServices.push(ourServiceId);
                    }
                }
            }

            return streamingServices;
        } catch (error) {
            console.error('Error fetching streaming availability:', error);
            return []; // Return empty array on error, don't break the flow
        }
    },

    /**
     * Get show details including episode count per season
     * @param {number} showId - TVMaze show ID
     * @returns {Promise<Object>} Show details with seasons info
     */
    async getShowDetails(showId) {
        try {
            const [showResponse, episodesResponse] = await Promise.all([
                fetch(`${this.BASE_URL}/shows/${showId}`),
                fetch(`${this.BASE_URL}/shows/${showId}/episodes`)
            ]);

            if (!showResponse.ok || !episodesResponse.ok) {
                throw new Error('Failed to fetch show details');
            }

            const show = await showResponse.json();
            const episodes = await episodesResponse.json();

            // Group episodes by season
            const seasons = {};
            episodes.forEach(ep => {
                if (!seasons[ep.season]) {
                    seasons[ep.season] = [];
                }
                seasons[ep.season].push(ep);
            });

            // Get IMDB ID for WatchMode lookup
            const imdbId = show.externals?.imdb || null;

            // Get real streaming availability from WatchMode
            const streamingServices = await this.getStreamingAvailability(imdbId, show.name);

            return {
                id: show.id,
                name: show.name,
                imdbId: imdbId,
                runtime: show.runtime || show.averageRuntime || 30,
                totalEpisodes: episodes.length,
                totalSeasons: Object.keys(seasons).length,
                seasons: seasons,
                network: show.network?.name || null,
                webChannel: show.webChannel?.name || null,
                streamingServices: streamingServices,
                episodes: episodes.map(ep => ({
                    season: ep.season,
                    episodeNumber: ep.number,
                    title: ep.name || `Episode ${ep.number}`,
                    runtime: ep.runtime || show.runtime || show.averageRuntime || 30
                }))
            };
        } catch (error) {
            console.error('Error fetching show details:', error);
            throw error;
        }
    }
};
