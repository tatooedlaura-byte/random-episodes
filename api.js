/**
 * TV Show API Integration
 * Uses TVMaze API (free, no API key required)
 * https://www.tvmaze.com/api
 */

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

            // Extract network/streaming info
            const networkInfo = this.extractStreamingInfo(show);

            return {
                id: show.id,
                name: show.name,
                runtime: show.runtime || show.averageRuntime || 30,
                totalEpisodes: episodes.length,
                totalSeasons: Object.keys(seasons).length,
                seasons: seasons,
                network: networkInfo.network,
                webChannel: networkInfo.webChannel,
                streamingServices: networkInfo.streamingServices,
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
    },

    /**
     * Extract and normalize streaming/network information from TVMaze show data
     * @param {Object} show - TVMaze show object
     * @returns {Object} Normalized streaming info
     */
    extractStreamingInfo(show) {
        const result = {
            network: null,
            webChannel: null,
            streamingServices: []
        };

        // Get traditional network (ABC, NBC, AMC, etc.)
        if (show.network) {
            result.network = show.network.name;

            // Map network to streaming service ID
            const networkMapping = this.mapNetworkToService(show.network.name);
            if (networkMapping) {
                result.streamingServices.push(networkMapping);
            }
        }

        // Get web/streaming channel (Netflix, Hulu, etc.)
        if (show.webChannel) {
            result.webChannel = show.webChannel.name;

            // Map web channel to streaming service ID
            const webMapping = this.mapWebChannelToService(show.webChannel.name);
            if (webMapping) {
                result.streamingServices.push(webMapping);
            }
        }

        return result;
    },

    /**
     * Map traditional TV network names to our streaming service IDs
     */
    mapNetworkToService(networkName) {
        const networkMap = {
            // Broadcast networks
            'ABC': 'network',
            'NBC': 'peacock',
            'CBS': 'paramount',
            'FOX': 'network',
            'The CW': 'network',
            // Cable networks
            'AMC': 'amc',
            'FX': 'hulu',
            'HBO': 'hbo',
            'Showtime': 'showtime',
            'Starz': 'starz',
            'USA Network': 'peacock',
            'Syfy': 'peacock',
            'Bravo': 'peacock',
            'Comedy Central': 'paramount',
            'MTV': 'paramount',
            'Nickelodeon': 'paramount',
            'ESPN': 'espn',
            'Discovery Channel': 'discovery',
            'TLC': 'discovery',
            'HGTV': 'discovery',
            'Food Network': 'discovery',
            'History': 'network',
            'A&E': 'network',
            'Lifetime': 'network',
            'TNT': 'hbo',
            'TBS': 'hbo',
            'Cartoon Network': 'hbo',
            'Adult Swim': 'hbo'
        };

        // Check for partial matches
        const lowerName = networkName.toLowerCase();
        for (const [key, value] of Object.entries(networkMap)) {
            if (lowerName.includes(key.toLowerCase())) {
                return value;
            }
        }

        return 'cable'; // Default for unknown cable networks
    },

    /**
     * Map web channel/streaming platform names to our service IDs
     */
    mapWebChannelToService(channelName) {
        const webMap = {
            'Netflix': 'netflix',
            'Hulu': 'hulu',
            'Amazon Prime Video': 'prime',
            'Prime Video': 'prime',
            'Amazon': 'prime',
            'Disney+': 'disney',
            'HBO Max': 'hbo',
            'Max': 'hbo',
            'Peacock': 'peacock',
            'Paramount+': 'paramount',
            'Apple TV+': 'apple',
            'Apple TV': 'apple',
            'Showtime': 'showtime',
            'Starz': 'starz',
            'AMC+': 'amc',
            'Discovery+': 'discovery',
            'ESPN+': 'espn',
            'Tubi': 'tubi',
            'Pluto TV': 'pluto',
            'Crunchyroll': 'crunchyroll',
            'Funimation': 'crunchyroll'
        };

        const lowerName = channelName.toLowerCase();
        for (const [key, value] of Object.entries(webMap)) {
            if (lowerName.includes(key.toLowerCase())) {
                return value;
            }
        }

        return null;
    }
};
