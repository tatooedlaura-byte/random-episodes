/**
 * TV Show API Integration
 * Uses TVMaze API for show/episode data
 * Uses TMDB API for streaming availability (free, powered by JustWatch)
 */

// TMDB API key (free tier) - Get yours at https://www.themoviedb.org/settings/api
const TMDB_API_KEY = 'd3d28539474495cbde497609b69bad79';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Map TMDB provider IDs to our internal service IDs
// Full list: https://developer.themoviedb.org/reference/watch-providers-tv-list
const TMDB_PROVIDER_MAP = {
    8: 'netflix',        // Netflix
    15: 'hulu',          // Hulu
    384: 'hbo',          // Max (HBO)
    9: 'prime',          // Prime Video
    337: 'disney',       // Disney+
    350: 'apple',        // Apple TV+
    531: 'paramount',    // Paramount+
    386: 'peacock',      // Peacock
    37: 'showtime',      // Showtime
    43: 'starz',         // Starz
    526: 'amc',          // AMC+
    520: 'discovery',    // Discovery+
    2077: 'discovery',   // Discovery+ (alternate ID)
    73: 'tubi',          // Tubi
    300: 'pluto',        // Pluto TV
    283: 'crunchyroll',  // Crunchyroll
    1899: 'espn',        // ESPN+
};

const TV_API = {
    BASE_URL: 'https://api.tvmaze.com',

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
     * Get streaming availability from TMDB API (powered by JustWatch)
     * @param {string} showName - Show name to search for
     * @returns {Promise<Array>} Array of streaming service IDs
     */
    async getStreamingAvailability(showName) {
        try {
            // First, search TMDB for the show
            const searchResponse = await fetch(
                `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(showName)}`
            );

            if (!searchResponse.ok) {
                throw new Error('TMDB search failed');
            }

            const searchResults = await searchResponse.json();
            if (!searchResults.results || searchResults.results.length === 0) {
                console.log('Could not find show on TMDB:', showName);
                return [];
            }

            // Find best match (prefer exact match)
            const exactMatch = searchResults.results.find(
                r => r.name.toLowerCase() === showName.toLowerCase()
            );
            const tmdbId = exactMatch ? exactMatch.id : searchResults.results[0].id;

            // Get watch providers for the show
            const providersResponse = await fetch(
                `${TMDB_BASE_URL}/tv/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`
            );

            if (!providersResponse.ok) {
                throw new Error('Failed to fetch watch providers');
            }

            const providersData = await providersResponse.json();

            // Get US providers (flatrate = subscription, free = free with ads)
            const usProviders = providersData.results?.US;
            if (!usProviders) {
                return [];
            }

            const streamingServices = [];
            const seenServices = new Set();

            // Combine flatrate (subscription) and free providers
            const allProviders = [
                ...(usProviders.flatrate || []),
                ...(usProviders.free || [])
            ];

            for (const provider of allProviders) {
                const ourServiceId = TMDB_PROVIDER_MAP[provider.provider_id];
                if (ourServiceId && !seenServices.has(ourServiceId)) {
                    seenServices.add(ourServiceId);
                    streamingServices.push(ourServiceId);
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

            // Get streaming availability from TMDB
            const streamingServices = await this.getStreamingAvailability(show.name);

            return {
                id: show.id,
                name: show.name,
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
