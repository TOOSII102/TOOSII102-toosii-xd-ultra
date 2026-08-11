'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceDirectories = ['commands', 'lib', 'middleware'];
const files = ['index.js', 'config.js'];

for (const directory of sourceDirectories) {
    const absoluteDirectory = path.join(root, directory);
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(path.join(directory, entry.name));
        }
    }
}

for (const file of files) {
    execFileSync(process.execPath, ['--check', file], {
        cwd: root,
        stdio: 'inherit'
    });
}

const envTemplate = path.join(root, '.env.example');
if (!fs.existsSync(envTemplate)) {
    throw new Error('Missing .env.example. Create a credential-free setup template.');
}

const ignoredPaths = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
for (const requiredRule of ['.env', 'session/']) {
    if (!ignoredPaths.split(/\r?\n/).includes(requiredRule)) {
        throw new Error(`.gitignore must include ${requiredRule}`);
    }
}

console.log(`Validated ${files.length} JavaScript files and credential-safe setup files.`);
