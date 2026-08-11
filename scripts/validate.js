'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function findJavaScriptFiles(directory) {
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...findJavaScriptFiles(fullPath));
        else if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
    }
    return files;
}

const files = [
    path.join(root, 'index.js'),
    path.join(root, 'config.js'),
    ...findJavaScriptFiles(path.join(root, 'commands')),
    ...findJavaScriptFiles(path.join(root, 'lib')),
    ...findJavaScriptFiles(path.join(root, 'middleware')),
    ...findJavaScriptFiles(path.join(root, 'scripts'))
];

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

const ignoredPaths = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/);
for (const requiredRule of ['.env', 'session/']) {
    if (!ignoredPaths.includes(requiredRule)) {
        throw new Error(`.gitignore must include ${requiredRule}`);
    }
}

console.log(`Validated ${files.length} JavaScript files and credential-safe setup files.`);
