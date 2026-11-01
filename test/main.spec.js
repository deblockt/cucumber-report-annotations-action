const assert = require('assert');
const path = require('path');
const { run } = require('../src/main');
const { fakeCore, fakeGithub, fakeGlob, fakeFs, jsonReport } = require('./fakes');

// default values of action.yml
const DEFAULT_INPUTS = {
    'access-token': 'the-token',
    'path': '**/cucumber-report.json',
    'name': 'Cucumber report',
    'check-status-on-error': 'failure',
    'check-status-on-undefined': 'success',
    'check-status-on-pending': 'success',
    'annotation-status-on-error': 'failure',
    'show-number-of-error-on-check-title': 'true',
    'show-global-summary-report': 'false',
    'number-of-test-error-to-fail-job': '-1',
    'ignore-no-report-found': 'false'
};

function fixture(name) {
    return path.join(__dirname, 'fixtures', 'reports', name);
}

async function runAction({ inputs = {}, reportFiles = [], contentByFile = {}, payload } = {}) {
    const allInputs = { ...DEFAULT_INPUTS, ...inputs };
    const core = fakeCore(allInputs);
    const github = fakeGithub({ payload });
    const glob = fakeGlob({ [allInputs.path]: reportFiles });
    await run({ core, github, glob, fs: fakeFs(contentByFile) });
    return { core, github };
}

function allSentAnnotations(github) {
    return [...github.createRequests, ...github.updateRequests]
        .map(request => request.output.annotations)
        .reduce((a, b) => a.concat(b), []);
}

describe('main', () => {
    describe('without report', () => {
        it('should fail the action', async () => {
            const { core, github } = await runAction();
            assert.deepStrictEqual(core.failures, ['No file matching "**/cucumber-report.json" was found in the project.']);
            assert.strictEqual(github.createRequests.length, 0);
        });

        it('should not fail the action when ignore-no-report-found is set', async () => {
            const { core, github } = await runAction({ inputs: { 'ignore-no-report-found': 'true' } });
            assert.deepStrictEqual(core.failures, []);
            assert.strictEqual(github.createRequests.length, 0);
        });
    });

    for (const extension of ['json', 'ndjson']) {
        describe(`with the nominal ${extension} report`, () => {
            const reportFiles = [fixture(`nominal.${extension}`)];

            it('should create a check', async () => {
                const { github } = await runAction({ reportFiles });
                assert.deepStrictEqual(github.tokens, ['the-token']);
                assert.strictEqual(github.createRequests.length, 1);
                const request = github.createRequests[0];
                assert.strictEqual(request.owner, 'owner');
                assert.strictEqual(request.repo, 'my-repo');
                assert.strictEqual(request.name, 'Cucumber report');
                assert.strictEqual(request.head_sha, 'commit-sha');
                assert.strictEqual(request.status, 'completed');
                assert.strictEqual(request.conclusion, 'failure');
                assert.strictEqual(request.output.title, 'Cucumber report (2 errors)');
                assert.strictEqual(request.output.summary,
                    '    7 Scenarios (2 failed, 3 undefined, 1 pending, 1 passed)\n'
                    + '    9 Steps (2 failed, 3 undefined, 1 skipped, 1 pending, 2 passed)');
            });

            it('should use the head commit of the pull request', async () => {
                const { github } = await runAction({ reportFiles, payload: { pull_request: { head: { sha: 'pr-head-sha' } } } });
                assert.strictEqual(github.createRequests[0].head_sha, 'pr-head-sha');
            });

            it('should annotate the failed steps', async () => {
                const { github } = await runAction({ reportFiles });
                const titles = github.createRequests[0].output.annotations.map(annotation => annotation.title).sort();
                assert.deepStrictEqual(titles, ['Scenario KO Failed.', 'This scenario will fail because of background Failed.']);
            });

            it('should annotate the undefined and pending steps when their status is set', async () => {
                const { github } = await runAction({
                    reportFiles,
                    inputs: { 'annotation-status-on-undefined': 'warning', 'annotation-status-on-pending': 'notice' }
                });
                const levels = github.createRequests[0].output.annotations.map(annotation => annotation.annotation_level);
                assert.deepStrictEqual(levels, ['failure', 'failure', 'warning', 'warning', 'warning', 'notice']);
            });

            it('should write the job summary', async () => {
                const { core } = await runAction({ reportFiles });
                assert.deepStrictEqual(core.summaryHeadings, [{ text: 'Cucumber report (2 errors)', level: 4 }]);
            });

            it('should fail the job when the error threshold is reached', async () => {
                const { core } = await runAction({ reportFiles, inputs: { 'number-of-test-error-to-fail-job': '2' } });
                assert.deepStrictEqual(core.failures, ['2 test(s) in error']);
            });

            it('should not fail the job under the error threshold', async () => {
                const { core } = await runAction({ reportFiles, inputs: { 'number-of-test-error-to-fail-job': '3' } });
                assert.deepStrictEqual(core.failures, []);
            });

            it('should send the global summary report', async () => {
                const { github } = await runAction({ reportFiles, inputs: { 'show-global-summary-report': 'true' } });
                assert.strictEqual(github.updateRequests.length, 1);
                const request = github.updateRequests[0];
                assert.strictEqual(request.check_run_id, 42);
                assert.strictEqual(request.output.title, 'Cucumber report (2 errors)');
                const titles = request.output.annotations.map(annotation => annotation.title).sort();
                assert.deepStrictEqual(titles, ['Feature: Test file Report', 'Feature: Test with background Report']);
            });
        });
    }

    it('should publish the outputs of each report', async () => {
        const { core } = await runAction({ reportFiles: [fixture('nominal.json')] });
        assert.strictEqual(core.outputs['nominal_failed_scenarios'], 2);
        assert.strictEqual(core.outputs['nominal_passed_scenarios'], 1);
    });

    it('[bug 8] should not count undefined steps as errors to fail the job', async () => {
        const { core } = await runAction({
            reportFiles: [fixture('undefined-steps.json')],
            inputs: { 'annotation-status-on-undefined': 'warning', 'number-of-test-error-to-fail-job': '1' }
        });
        assert.deepStrictEqual(core.failures, []);
    });

    it('[bug 6] should send all the annotations, by batch of 50', async () => {
        const scenarios = Array.from({ length: 60 }, (_, index) => `Scenario ${index}`);
        const { github } = await runAction({
            reportFiles: ['/workspace/cucumber-report.json'],
            contentByFile: { '/workspace/cucumber-report.json': jsonReport([{ uri: 'a.feature', scenarios }]) }
        });
        for (const request of [...github.createRequests, ...github.updateRequests]) {
            assert.ok(request.output.annotations.length <= 50, `${request.output.annotations.length} annotations sent in one request`);
        }
        assert.strictEqual(allSentAnnotations(github).length, 60);
    });

    it('[bug 6] should send the global summary report by batch of 50', async () => {
        const features = Array.from({ length: 60 }, (_, index) => ({ uri: `feature-${index}.feature`, scenarios: ['Scenario'] }));
        const { github } = await runAction({
            reportFiles: ['/workspace/cucumber-report.json'],
            contentByFile: { '/workspace/cucumber-report.json': jsonReport(features) },
            inputs: { 'show-global-summary-report': 'true' }
        });
        for (const request of github.updateRequests) {
            assert.ok(request.output.annotations.length <= 50, `${request.output.annotations.length} annotations sent in one request`);
        }
        const featureAnnotations = allSentAnnotations(github).filter(annotation => annotation.title.startsWith('Feature:'));
        assert.strictEqual(featureAnnotations.length, 60);
    });

    it('[error handling] should fail the action when a report cannot be read', async () => {
        const { core } = await runAction({
            reportFiles: ['/workspace/cucumber-report.json'],
            contentByFile: { '/workspace/cucumber-report.json': 'not a json report' }
        });
        assert.strictEqual(core.failures.length, 1);
    });
});
