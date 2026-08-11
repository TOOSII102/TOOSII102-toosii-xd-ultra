'use strict';

const fs = require('fs');
const path = require('path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

function findCommandFiles(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...findCommandFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files.sort();
}

function normalizeCommand(command, sourceFile) {
    if (!command || typeof command !== 'object' || typeof command.name !== 'string' || typeof command.execute !== 'function') {
        console.warn(`[Commands] Skipping "${sourceFile}" — expected { name, execute }.`);
        return null;
    }

    const name = command.name.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(name)) {
        console.warn(`[Commands] Skipping "${sourceFile}" — invalid command name "${command.name}".`);
        return null;
    }

    const aliases = Array.isArray(command.aliases)
        ? [...new Set(command.aliases.filter((alias) => typeof alias === 'string')
            .map((alias) => alias.trim().toLowerCase())
            .filter((alias) => /^[a-z0-9][a-z0-9_-]{0,31}$/.test(alias) && alias !== name))]
        : [];

    return {
        ...command,
        name,
        aliases,
        category: typeof command.category === 'string' && command.category.trim() ? command.category.trim().toLowerCase() : 'utility'
    };
}

function loadCommands() {
    const commands = new Map();
    const catalog = [];

    if (!fs.existsSync(COMMANDS_DIR)) {
        fs.mkdirSync(COMMANDS_DIR, { recursive: true });
        Object.defineProperty(commands, 'catalog', { value: catalog });
        return commands;
    }

    for (const fullPath of findCommandFiles(COMMANDS_DIR)) {
        const relativePath = path.relative(COMMANDS_DIR, fullPath);
        try {
            delete require.cache[require.resolve(fullPath)];
            const exported = require(fullPath);
            const definitions = Array.isArray(exported) ? exported : [exported];

            for (const definition of definitions) {
                const command = normalizeCommand(definition, relativePath);
                if (!command) continue;
                if (commands.has(command.name)) {
                    console.warn(`[Commands] Skipping duplicate command "${command.name}" from "${relativePath}".`);
                    continue;
                }

                commands.set(command.name, command);
                for (const alias of command.aliases) {
                    if (commands.has(alias)) {
                        console.warn(`[Commands] Skipping duplicate alias "${alias}" from "${relativePath}".`);
                    } else {
                        commands.set(alias, command);
                    }
                }
                catalog.push(command);
                console.log(`[Commands] Loaded: ${command.category}/${command.name}`);
            }
        } catch (error) {
            console.error(`[Commands] Failed to load "${relativePath}":`, error.message);
        }
    }

    Object.defineProperty(commands, 'catalog', { value: catalog });
    return commands;
}

module.exports = { loadCommands, COMMANDS_DIR, findCommandFiles };
