'use strict';

const assert = require('assert');
const { runRepositoryUpdate, parseAheadBehind } = require('../lib/repositoryUpdate');
const updateCommand = require('../commands/update');

function runner(responses, calls, label) {
    return async (args) => {
        calls.push({ label, args });
        const key = args.join(' ');
        const response = responses[key];
        if (response instanceof Error) throw response;
        if (typeof response === 'function') return response(args);
        if (response === undefined) throw new Error(`Unexpected ${label} command: ${key}`);
        return typeof response === 'string' ? { stdout: response, stderr: '' } : response;
    };
}

function gitBase({ counts = '0 0\n', status = '', before = 'aaaaaaa\n', after = 'bbbbbbb\n', diff = '' } = {}) {
    return {
        '--version': 'git version 2.43.0\n',
        'status --porcelain': status,
        'branch --show-current': 'main\n',
        'rev-parse --abbrev-ref --symbolic-full-name @{u}': 'origin/main\n',
        'config --get branch.main.remote': 'origin\n',
        'fetch --prune origin': '',
        'rev-list --left-right --count HEAD...origin/main': counts,
        'rev-parse --short HEAD': (() => {
            let reads = 0;
            return () => ({ stdout: ++reads === 1 ? before : after, stderr: '' });
        })(),
        'merge --ff-only origin/main': '',
        'diff --name-only aaaaaaa HEAD -- package.json package-lock.json npm-shrinkwrap.json': diff
    };
}

async function run() {
    assert.deepStrictEqual(parseAheadBehind('3 9\n'), { ahead: 3, behind: 9 });
    assert.deepStrictEqual(parseAheadBehind('unexpected'), { ahead: 0, behind: 0 });

    const dirtyCalls = [];
    const dirty = await runRepositoryUpdate({
        runGit: runner(gitBase({ status: ' M commands/update.js\n' }), dirtyCalls, 'git'),
        existsSync: () => true
    });
    assert.strictEqual(dirty.status, 'working-tree-dirty');
    assert.deepStrictEqual(dirtyCalls.map((call) => call.args.join(' ')), ['--version', 'status --porcelain']);

    const noUpstreamResponses = gitBase();
    noUpstreamResponses['rev-parse --abbrev-ref --symbolic-full-name @{u}'] = new Error('no upstream configured');
    const noUpstream = await runRepositoryUpdate({
        runGit: runner(noUpstreamResponses, [], 'git'),
        existsSync: () => true
    });
    assert.strictEqual(noUpstream.status, 'no-upstream');
    assert.strictEqual(noUpstream.branch, 'main');

    const checkCalls = [];
    const available = await runRepositoryUpdate({
        apply: false,
        runGit: runner(gitBase({ counts: '1 2\n' }), checkCalls, 'git'),
        existsSync: () => true
    });
    assert.deepStrictEqual(
        { status: available.status, ahead: available.ahead, behind: available.behind, upstream: available.upstream },
        { status: 'update-available', ahead: 1, behind: 2, upstream: 'origin/main' }
    );
    assert.ok(!checkCalls.some((call) => call.args[0] === 'merge'), 'check mode must not merge');

    const upToDate = await runRepositoryUpdate({
        apply: false,
        runGit: runner(gitBase({ counts: '2 0\n' }), [], 'git'),
        existsSync: () => true
    });
    assert.strictEqual(upToDate.status, 'up-to-date');
    assert.strictEqual(upToDate.ahead, 2);

    const applyCalls = [];
    const npmCalls = [];
    const updated = await runRepositoryUpdate({
        runGit: runner(gitBase({ counts: '0 2\n', diff: 'package-lock.json\n' }), applyCalls, 'git'),
        runNpm: runner({ 'ci --omit=dev --no-audit --no-fund': 'added 1 package\n' }, npmCalls, 'npm'),
        existsSync: (target) => target.endsWith('package-lock.json') || target.endsWith('.git')
    });
    assert.strictEqual(updated.status, 'updated');
    assert.strictEqual(updated.before, 'aaaaaaa');
    assert.strictEqual(updated.after, 'bbbbbbb');
    assert.strictEqual(updated.dependencyRefresh, 'completed');
    assert.ok(applyCalls.some((call) => call.args.join(' ') === 'merge --ff-only origin/main'));
    assert.deepStrictEqual(npmCalls.map((call) => call.args), [['ci', '--omit=dev', '--no-audit', '--no-fund']]);

    const failedMergeResponses = gitBase({ counts: '0 1\n' });
    failedMergeResponses['merge --ff-only origin/main'] = Object.assign(new Error('Not possible to fast-forward'), { stderr: 'Not possible to fast-forward\n' });
    const failedMerge = await runRepositoryUpdate({
        runGit: runner(failedMergeResponses, [], 'git'),
        existsSync: () => true
    });
    assert.strictEqual(failedMerge.status, 'merge-failed');

    assert.match(updateCommand.resultMessage({ status: 'not-repository' }), /no Git working tree/);
    assert.match(updateCommand.resultMessage({ status: 'not-repository' }), /github\.com\/TOOSII102\/TOOSII102-toosii-xd-ultra/);
    assert.match(updateCommand.resultMessage({ status: 'working-tree-dirty' }), /uncommitted changes/);
    assert.match(updateCommand.resultMessage({ status: 'update-available', upstream: 'origin/main', ahead: 0, behind: 1 }), /Run `\.update` to install it/);
    assert.match(updateCommand.resultMessage({ status: 'updated', before: 'aaaaaaa', after: 'bbbbbbb', upstream: 'origin/main', dependencyRefresh: 'not-needed' }), /Restart the bot through its deployment manager/);

    console.log('Update command tests passed: safe status checks, fast-forward updates, dependency refresh, and failure handling verified.');
}

run().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
