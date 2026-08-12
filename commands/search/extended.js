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

function command(name, aliases, description, execute) {
    return { name, aliases, description, category: 'search', execute };
}

module.exports = [
    command('country', ['countryinfo'], 'Look up public country information.', async (sock, msg, args, ctx) => {
        try {
            const value = query(args, `${ctx.prefix}country <country name>`);
            const result = await fetchJson(`https://restcountries.com/v3.1/name/${encodeURIComponent(value)}?fullText=true`);
            const country = Array.isArray(result) ? result[0] : null;
            if (!country) return reply(sock, msg, ctx, `No country named "${value}" was found.`);
            const languages = Object.values(country.languages || {}).join(', ') || 'Not listed';
            return reply(sock, msg, ctx, `Country: ${country.name?.common || value}\nCapital: ${(country.capital || ['Not listed']).join(', ')}\nRegion: ${country.region || 'Not listed'}\nPopulation: ${(country.population || 0).toLocaleString()}\nLanguages: ${languages}`);
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
