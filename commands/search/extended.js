'use strict';

const MAX_QUERY_LENGTH = 80;

function reply(sock, msg, ctx, text) {
    return sock.sendMessage(ctx.from, { text }, { quoted: msg });
}

function query(args, usage) {
    const value = args.join(' ').trim();
    if (!value) throw new Error(`Usage: ${usage}`);
    if (value.length > MAX_QUERY_LENGTH) throw new Error(`Search terms are limited to ${MAX_QUERY_LENGTH} characters.`);
    return value;
}

async function fetchJson(url) {
    const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'TOOSII-XD-ULTRA' }, signal: AbortSignal.timeout(8000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Service returned status ${response.status}.`);
    return response.json();
}

function serviceError(error) {
    return error?.name === 'TimeoutError' ? 'request timed out.' : error.message;
}

// restcountries v1-v4 were shut down and v5 requires a paid API key, so country
// lookups use the World Bank country API, which stays keyless and CORS-open.
const WORLD_BANK_BASE = 'https://api.worldbank.org/v2';
let countryCache = null;

async function loadCountries() {
    if (countryCache) return countryCache;
    const payload = await fetchJson(`${WORLD_BANK_BASE}/country?format=json&per_page=400`);
    const rows = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
    // Aggregates (regions, income groups) carry an empty capitalCity; drop them.
    countryCache = rows.filter((row) => row?.capitalCity && row.capitalCity.trim());
    return countryCache;
}

function matchCountry(rows, value) {
    const needle = value.trim().toLowerCase();
    return rows.find((row) => row.name.toLowerCase() === needle)
        || rows.find((row) => row.iso2Code.toLowerCase() === needle)
        || rows.find((row) => row.id.toLowerCase() === needle)
        || rows.find((row) => row.name.toLowerCase().includes(needle))
        || null;
}

async function fetchPopulation(iso3) {
    try {
        const payload = await fetchJson(`${WORLD_BANK_BASE}/country/${encodeURIComponent(iso3)}/indicator/SP.POP.TOTL?format=json&per_page=1&mrnev=1`);
        const entry = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1][0] : null;
        return entry && typeof entry.value === 'number' ? { value: entry.value, year: entry.date } : null;
    } catch {
        return null;
    }
}

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'search', execute };
}

module.exports = [
    command('country', ['countryinfo'], 'Look up public country information.', async (sock, msg, args, ctx) => {
        try {
            const value = query(args, `${ctx.prefix}country <country name>`);
            const rows = await loadCountries();
            const country = matchCountry(rows, value);
            if (!country) return reply(sock, msg, ctx, `No country named "${value}" was found.`);
            const population = await fetchPopulation(country.id);
            const populationLine = population
                ? `${population.value.toLocaleString()} (${population.year})`
                : 'Not listed';
            return reply(sock, msg, ctx, `Country: ${country.name}\nCapital: ${country.capitalCity || 'Not listed'}\nRegion: ${(country.region?.value || 'Not listed').trim()}\nIncome level: ${(country.incomeLevel?.value || 'Not listed').trim()}\nPopulation: ${populationLine}\nCode: ${country.iso2Code} / ${country.id}`);
        } catch (error) { return reply(sock, msg, ctx, `Country lookup failed: ${serviceError(error)}`); }
    }),
    command('github', ['ghuser'], 'Look up a public GitHub user profile.', async (sock, msg, args, ctx) => {
        try {
            const username = query(args, `${ctx.prefix}github <username>`);
            if (!/^[A-Za-z0-9-]{1,39}$/.test(username)) throw new Error('GitHub usernames contain only letters, numbers, and hyphens.');
            const profile = await fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
            if (!profile) return reply(sock, msg, ctx, `No GitHub user named "${username}" was found.`);
            return reply(sock, msg, ctx, `GitHub: ${profile.login}\nName: ${profile.name || 'Not listed'}\nPublic repos: ${profile.public_repos ?? 'Not listed'}\nFollowers: ${profile.followers ?? 'Not listed'}\nProfile: ${profile.html_url || `https://github.com/${profile.login}`}`);
        } catch (error) { return reply(sock, msg, ctx, `GitHub lookup failed: ${serviceError(error)}`); }
    }),
    command('ghrepo', ['githubrepo'], 'Look up a public GitHub repository.', async (sock, msg, args, ctx) => {
        try {
            const value = query(args, `${ctx.prefix}ghrepo <owner/repository>`);
            if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(value)) throw new Error('Use owner/repository.');
            const repository = await fetchJson(`https://api.github.com/repos/${value}`);
            if (!repository) return reply(sock, msg, ctx, `No public repository named "${value}" was found.`);
            return reply(sock, msg, ctx, `Repository: ${repository.full_name}\nDescription: ${repository.description || 'Not listed'}\nStars: ${repository.stargazers_count ?? 0}\nLanguage: ${repository.language || 'Not listed'}\nURL: ${repository.html_url}`);
        } catch (error) { return reply(sock, msg, ctx, `Repository lookup failed: ${serviceError(error)}`); }
    }),
    command('recipe', ['mealsearch'], 'Search a public recipe database.', async (sock, msg, args, ctx) => {
        try {
            const value = query(args, `${ctx.prefix}recipe <meal name>`);
            const result = await fetchJson(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(value)}`);
            const meal = result?.meals?.[0];
            if (!meal) return reply(sock, msg, ctx, `No recipe named "${value}" was found.`);
            const instructions = String(meal.strInstructions || '').replace(/\s+/g, ' ').trim();
            return reply(sock, msg, ctx, `Recipe: ${meal.strMeal}\nCategory: ${meal.strCategory || 'Not listed'}\nArea: ${meal.strArea || 'Not listed'}\nInstructions: ${instructions.slice(0, 700)}${instructions.length > 700 ? '...' : ''}`);
        } catch (error) { return reply(sock, msg, ctx, `Recipe lookup failed: ${serviceError(error)}`); }
    })
];
