import * as assert from 'assert';
import * as path from 'path';
import { run } from '../src/main';
import { fakeCore, fakeGithub, fakeGlob, fakeFs, jsonReport } from './fakes';
import type { FakeGitHub } from './fakes';
import type { GitHubContext } from '../src/types';

interface ActionRun {
    inputs?: Record<string, string>;
    reportFiles?: string[];
    contentByFile?: Record<string, string>;
    payload?: GitHubContext['payload'];
    featureFiles?: string[];
}

// default values of action.yml
const DEFAULT_INPUTS: Record<string, string> = {
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
    'ignore-no-report-found': 'false',
    'max-number-of-annotations': '50',
    'job-summary-content': 'counts,steps'
};

function fixture(name: string): string {
    return path.join(__dirname, 'fixtures', 'reports', name);
}

async function runAction({ inputs = {}, reportFiles = [], contentByFile = {}, payload, featureFiles = [] }: ActionRun = {}) {
    const allInputs = { ...DEFAULT_INPUTS, ...inputs };
    const core = fakeCore(allInputs);
    const github = fakeGithub({ payload });
    const glob = fakeGlob({ [allInputs.path]: reportFiles, '**/*.feature': featureFiles });
    await run({ core, github, glob, fs: fakeFs(contentByFile), workspace: '/workspace' });
    return { core, github };
}

function allSentAnnotations(github: FakeGitHub) {
    return [...github.createRequests, ...github.updateRequests]
        .map(request => request.output.annotations)
        .flat();
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

            it('should detail the failed steps in the job summary', async () => {
                const { core } = await runAction({ reportFiles });
                const jobSummary = core.summaryRaws.join('');
                assert.match(jobSummary, /^\n    7 Scenarios \(2 failed, 3 undefined, 1 pending, 1 passed\)\n/);
                assert.match(jobSummary, /##### Steps in error/);
                assert.match(jobSummary, /<b>Scenario KO<\/b> failed<\/summary>/);
                assert.match(jobSummary, /<b>This scenario will fail because of background<\/b> failed<\/summary>/);
                assert.doesNotMatch(jobSummary, /##### Features/);
            });

            it('should add the report of each feature to the job summary when the features section is set', async () => {
                const { core } = await runAction({ reportFiles, inputs: { 'job-summary-content': 'counts,steps,features' } });
                const jobSummary = core.summaryRaws.join('');
                assert.match(jobSummary, /##### Features/);
                assert.match(jobSummary, /Feature: <b>Test file<\/b>/);
                assert.match(jobSummary, /Feature: <b>Test with background<\/b>/);
            });

            it('should not add the report of each feature to the job summary when only show-global-summary-report is set', async () => {
                const { core } = await runAction({ reportFiles, inputs: { 'show-global-summary-report': 'true' } });
                assert.doesNotMatch(core.summaryRaws.join(''), /##### Features/);
            });

            it('should not write the job summary without section', async () => {
                const { core } = await runAction({ reportFiles, inputs: { 'job-summary-content': '' } });
                assert.deepStrictEqual(core.summaryHeadings, []);
                assert.deepStrictEqual(core.summaryRaws, []);
            });

            it('should fail the job when the error threshold is reached', async () => {
                const { core } = await runAction({ reportFiles, inputs: { 'number-of-test-error-to-fail-job': '2' } });
                assert.deepStrictEqual(core.failures, ['2 test(s) in error']);
            });

            it('should not fail the job under the error threshold', async () => {
                const { core } = await runAction({ reportFiles, inputs: { 'number-of-test-error-to-fail-job': '3' } });
                assert.deepStrictEqual(core.failures, []);
            });

            it('should send the global summary report after the step annotations', async () => {
                const { github } = await runAction({ reportFiles, inputs: { 'show-global-summary-report': 'true' } });
                const titles = allSentAnnotations(github).map(annotation => annotation.title);
                assert.deepStrictEqual(titles.slice(2).sort(), ['Feature: Test file Report', 'Feature: Test with background Report']);
                assert.ok(titles.slice(0, 2).every(title => title.endsWith(' Failed.')));
            });
        });
    }

    it('should publish the outputs of each report', async () => {
        const { core } = await runAction({ reportFiles: [fixture('nominal.json')] });
        assert.strictEqual(core.outputs['nominal_failed_scenarios'], 2);
        assert.strictEqual(core.outputs['nominal_passed_scenarios'], 1);
    });

    // the end-to-end workflow fails the job on pending steps annotated as failure
    it('should count the undefined steps annotations as errors to fail the job', async () => {
        const { core } = await runAction({
            reportFiles: [fixture('undefined-steps.json')],
            inputs: { 'annotation-status-on-undefined': 'warning', 'number-of-test-error-to-fail-job': '1' }
        });
        assert.deepStrictEqual(core.failures, ['1 test(s) in error']);
    });

    it('should not count the undefined steps without annotation to fail the job', async () => {
        const { core } = await runAction({
            reportFiles: [fixture('undefined-steps.json')],
            inputs: { 'number-of-test-error-to-fail-job': '1' }
        });
        assert.deepStrictEqual(core.failures, []);
    });

    describe('with more than 50 annotations', () => {
        function failingReport(scenarioNumber: number, file = '/workspace/cucumber-report.json') {
            const scenarios = Array.from({ length: scenarioNumber }, (_, index) => `Scenario ${index}`);
            return { reportFiles: [file], contentByFile: { [file]: jsonReport([{ uri: 'a.feature', scenarios }]) } };
        }

        it('should send the next annotations with check updates', async () => {
            const { github } = await runAction({ ...failingReport(120), inputs: { 'max-number-of-annotations': '200' } });
            assert.strictEqual(github.createRequests[0].output.annotations.length, 50);
            assert.deepStrictEqual(github.updateRequests.map(request => request.check_run_id), [42, 42]);
            assert.strictEqual(new Set(allSentAnnotations(github).map(annotation => annotation.title)).size, 120);
        });

        it('should not send more annotations than the maximum', async () => {
            const { github } = await runAction(failingReport(60));
            assert.strictEqual(allSentAnnotations(github).length, 50);
            assert.match(github.createRequests[0].output.summary, /10 annotation\(s\) not sent/);
        });

        it('should share the maximum between the reports', async () => {
            const report1 = failingReport(30, '/workspace/report-1.json');
            const report2 = failingReport(30, '/workspace/report-2.json');
            const { github } = await runAction({
                reportFiles: [...report1.reportFiles, ...report2.reportFiles],
                contentByFile: { ...report1.contentByFile, ...report2.contentByFile }
            });
            assert.deepStrictEqual(github.createRequests.map(request => request.output.annotations.length), [30, 20]);
        });

        it('should fail the job with all the errors, even the ones not sent', async () => {
            const { core } = await runAction({ ...failingReport(60), inputs: { 'number-of-test-error-to-fail-job': '55' } });
            assert.deepStrictEqual(core.failures, ['60 test(s) in error']);
        });
    });

    it('should link the steps of the job summary to the feature file at the checked commit', async () => {
        const { core } = await runAction({
            reportFiles: ['/workspace/cucumber-report.json'],
            contentByFile: { '/workspace/cucumber-report.json': jsonReport([{ uri: 'classpath:features/my feature.feature', scenarios: ['Scenario KO'] }]) },
            featureFiles: ['/workspace/src/test/resources/features/my feature.feature'],
            payload: { pull_request: { head: { sha: 'pr-head-sha' } } }
        });
        assert.match(core.summaryRaws.join(''),
            /<a href="https:\/\/github\.com\/owner\/my-repo\/blob\/pr-head-sha\/src\/test\/resources\/features\/my%20feature\.feature#L2">src\/test\/resources\/features\/my feature\.feature#L2<\/a>/);
    });

    it('should fail the action with an unknown job summary section', async () => {
        const { core, github } = await runAction({ reportFiles: [fixture('nominal.json')], inputs: { 'job-summary-content': 'counts,errors' } });
        assert.deepStrictEqual(core.failures, ['Unknown job-summary-content section(s): errors. The possible values are: counts, steps, features.']);
        assert.strictEqual(github.createRequests.length, 0);
    });

    it('should fail the action when a report cannot be read', async () => {
        const { core } = await runAction({
            reportFiles: ['/workspace/cucumber-report.json'],
            contentByFile: { '/workspace/cucumber-report.json': 'not a json report' }
        });
        assert.strictEqual(core.failures.length, 1);
        assert.match(core.failures[0], /^Unable to publish the cucumber report \/workspace\/cucumber-report.json: .*is not valid JSON/);
    });
});
