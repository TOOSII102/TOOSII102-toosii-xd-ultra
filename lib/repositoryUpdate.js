'use strict';

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFilePromise = promisify(execFile);
const DEFAULT_MAX_BUFFER = 1024 * 1024;

function clip(value, limit = 800) {
    const text = String(value || '').trim();
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function errorDetail(error) {
    return clip(error?.stderr || error?.stdout || error?.message || 'Unknown command failure.');
}

function parseAheadBehind(value) {
    const [aheadText = '0', behindText = '0'] = String(value || '').trim().split(/\s+/);
    const ahead = Number.parseInt(aheadText, 10);
    const behind = Number.parseInt(behindText, 10);
    return {
        ahead: Number.isInteger(ahead) ? ahead : 0,
        behind: Number.isInteger(behind) ? behind : 0
    };
}

function createProcessRunner(command, cwd) {
    return async (args) => {
        const result = await execFilePromise(command, args, {
            cwd,
            maxBuffer: DEFAULT_MAX_BUFFER,
            windowsHide: true
        });
        return { stdout: result.stdout || '', stderr: result.stderr || '' };
    };
}

/**
 * Safely update the checked-out tracking branch without using a shell or an
 * implicit merge. It never overwrites local edits and it only installs
 * dependencies when the lockfile/package manifest changed in the update.
 */
async function runRepositoryUpdate({
    cwd = path.resolve(__dirname, '..'),
    apply = true,
    runGit = createProcessRunner('git', cwd),
    runNpm = createProcessRunner('npm', cwd),
    existsSync = fs.existsSync
} = {}) {
    if (!existsSync(path.join(cwd, '.git'))) {
        return { status: 'not-repository' };
    }

    try {
        await runGit(['--version']);
    } catch (error) {
        return { status: 'git-unavailable', detail: errorDetail(error) };
    }

    let workingTree;
    try {
        ({ stdout: workingTree } = await runGit(['status', '--porcelain']));
    } catch (error) {
        return { status: 'git-error', step: 'inspect the working tree', detail: errorDetail(error) };
    }

    if (workingTree.trim()) {
        return { status: 'working-tree-dirty' };
    }

    let branch;
    try {
        ({ stdout: branch } = await runGit(['branch', '--show-current']));
        branch = branch.trim();
    } catch (error) {
        return { status: 'git-error', step: 'read the current branch', detail: errorDetail(error) };
    }

    if (!branch) {
        return { status: 'detached-head' };
    }

    let upstream;
    try {
        ({ stdout: upstream } = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']));
        upstream = upstream.trim();
    } catch (error) {
        return { status: 'no-upstream', branch };
    }

    let remote;
    try {
        ({ stdout: remote } = await runGit(['config', '--get', `branch.${branch}.remote`]));
        remote = remote.trim();
    } catch (error) {
        return { status: 'no-remote', branch, upstream };
    }

    if (!remote) {
        return { status: 'no-remote', branch, upstream };
    }

    try {
        await runGit(['fetch', '--prune', remote]);
    } catch (error) {
        return { status: 'fetch-failed', remote, detail: errorDetail(error) };
    }

    let counts;
    try {
        ({ stdout: counts } = await runGit(['rev-list', '--left-right', '--count', `HEAD...${upstream}`]));
    } catch (error) {
        return { status: 'git-error', step: 'compare with the upstream branch', detail: errorDetail(error) };
    }

    const { ahead, behind } = parseAheadBehind(counts);
    if (behind === 0) {
        return { status: 'up-to-date', branch, upstream, ahead, behind };
    }

    if (!apply) {
        return { status: 'update-available', branch, upstream, ahead, behind };
    }

    let before;
    try {
        ({ stdout: before } = await runGit(['rev-parse', '--short', 'HEAD']));
        before = before.trim();
        await runGit(['merge', '--ff-only', upstream]);
    } catch (error) {
        return { status: 'merge-failed', branch, upstream, detail: errorDetail(error) };
    }

    let after;
    let changedFiles;
    try {
        ({ stdout: after } = await runGit(['rev-parse', '--short', 'HEAD']));
        ({ stdout: changedFiles } = await runGit(['diff', '--name-only', before, 'HEAD', '--', 'package.json', 'package-lock.json', 'npm-shrinkwrap.json']));
        after = after.trim();
    } catch (error) {
        return { status: 'updated', branch, upstream, before, after: null, dependencyRefresh: 'not-checked' };
    }

    const packageChanged = Boolean(changedFiles.trim());
    if (!packageChanged) {
        return { status: 'updated', branch, upstream, before, after, dependencyRefresh: 'not-needed' };
    }

    const hasLockfile = existsSync(path.join(cwd, 'package-lock.json')) || existsSync(path.join(cwd, 'npm-shrinkwrap.json'));
    const npmArgs = hasLockfile
        ? ['ci', '--omit=dev', '--no-audit', '--no-fund']
        : ['install', '--omit=dev', '--no-audit', '--no-fund'];

    try {
        const { stdout } = await runNpm(npmArgs);
        return {
            status: 'updated',
            branch,
            upstream,
            before,
            after,
            dependencyRefresh: 'completed',
            dependencyOutput: clip(stdout, 500)
        };
    } catch (error) {
        return {
            status: 'updated-dependency-failed',
            branch,
            upstream,
            before,
            after,
            dependencyRefresh: 'failed',
            detail: errorDetail(error)
        };
    }
}

module.exports = { runRepositoryUpdate, createProcessRunner, parseAheadBehind, clip };
