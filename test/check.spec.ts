import * as assert from 'assert';
import { buildCheckTitle, computeCheckStatus, buildCheckRequests, shouldFailJob } from '../src/check';
import type { CheckRequestsParameters, CheckStatusInformation } from '../src/check';
import type { GitHubContext, Inputs } from '../src/types';
import { annotation } from './fakes';

const statusInputs: Pick<Inputs, 'checkStatusOnError' | 'checkStatusOnUndefined' | 'checkStatusOnPending'> = {
    checkStatusOnError: 'failure',
    checkStatusOnUndefined: 'neutral',
    checkStatusOnPending: 'neutral'
};

function information(overrides: Partial<CheckStatusInformation> = {}): CheckStatusInformation {
    return { failedScenarioNumber: 0, undefinedStepsNumber: 0, pendingStepNumber: 0, ...overrides };
}

describe('check', () => {
    describe('buildCheckTitle', () => {
        const inputs = { checkName: 'Cucumber', showNumberOfErrorOnCheckTitle: true };

        it('should show the number of errors', () => {
            assert.strictEqual(buildCheckTitle(information({ failedScenarioNumber: 2 }), inputs), 'Cucumber (2 errors)');
        });

        it('should use the singular for one error', () => {
            assert.strictEqual(buildCheckTitle(information({ failedScenarioNumber: 1 }), inputs), 'Cucumber (1 error)');
        });

        it('should only show the name without error', () => {
            assert.strictEqual(buildCheckTitle(information(), inputs), 'Cucumber');
        });

        it('should only show the name when the option is disabled', () => {
            const title = buildCheckTitle(information({ failedScenarioNumber: 2 }), { ...inputs, showNumberOfErrorOnCheckTitle: false });
            assert.strictEqual(title, 'Cucumber');
        });
    });

    describe('computeCheckStatus', () => {
        it('should use the error status when a scenario failed', () => {
            const status = computeCheckStatus(information({ failedScenarioNumber: 1, undefinedStepsNumber: 1 }), statusInputs);
            assert.strictEqual(status, 'failure');
        });

        it('should use the undefined status when a step is undefined', () => {
            const status = computeCheckStatus(information({ undefinedStepsNumber: 1, pendingStepNumber: 1 }), { ...statusInputs, checkStatusOnPending: 'failure' });
            assert.strictEqual(status, 'neutral');
        });

        it('should use the pending status when a step is pending', () => {
            const status = computeCheckStatus(information({ pendingStepNumber: 1 }), { ...statusInputs, checkStatusOnPending: 'failure' });
            assert.strictEqual(status, 'failure');
        });

        it('should look at undefined steps when errors are configured as success', () => {
            const status = computeCheckStatus(information({ failedScenarioNumber: 1, undefinedStepsNumber: 1 }), { ...statusInputs, checkStatusOnError: 'success' });
            assert.strictEqual(status, 'neutral');
        });

        it('should be a success without failed, undefined or pending step', () => {
            assert.strictEqual(computeCheckStatus(information(), statusInputs), 'success');
        });
    });

    describe('buildCheckRequests', () => {
        const context: GitHubContext = { serverUrl: 'https://github.com', repo: { owner: 'owner', repo: 'my-repo' }, sha: 'commit-sha', payload: {} };
        const inputs = { ...statusInputs, checkName: 'Cucumber', showNumberOfErrorOnCheckTitle: true };

        function requests(overrides: Partial<CheckRequestsParameters> = {}) {
            return buildCheckRequests({
                context,
                inputs,
                globalInformation: information({ failedScenarioNumber: 1 }),
                summary: 'the summary',
                annotations: [],
                ...overrides
            });
        }

        it('should create a completed check', () => {
            assert.deepStrictEqual(requests({ annotations: [annotation('annotation')] }), {
                create: {
                    owner: 'owner',
                    repo: 'my-repo',
                    name: 'Cucumber',
                    head_sha: 'commit-sha',
                    status: 'completed',
                    conclusion: 'failure',
                    output: {
                        title: 'Cucumber (1 error)',
                        summary: 'the summary',
                        annotations: [annotation('annotation')]
                    }
                },
                updates: []
            });
        });

        it('should use the head commit of the pull request', () => {
            const { create } = requests({ context: { ...context, payload: { pull_request: { head: { sha: 'pr-head-sha' } } } } });
            assert.strictEqual(create.head_sha, 'pr-head-sha');
        });

        it('should send the annotations by batch of 50', () => {
            const { create, updates } = requests({ annotations: Array.from({ length: 120 }, (_, index) => annotation(String(index))) });
            assert.strictEqual(create.output.annotations.length, 50);
            assert.deepStrictEqual(updates.map(update => update.output.annotations.length), [50, 20]);
            assert.deepStrictEqual([...create.output.annotations, ...updates.flatMap(update => update.output.annotations)], Array.from({ length: 120 }, (_, index) => annotation(String(index))));
        });

        it('should send the title and summary with each update', () => {
            const { updates } = requests({ annotations: Array.from({ length: 60 }, (_, index) => annotation(String(index))) });
            assert.deepStrictEqual({ ...updates[0], output: { ...updates[0].output, annotations: [] } }, {
                owner: 'owner',
                repo: 'my-repo',
                output: { title: 'Cucumber (1 error)', summary: 'the summary', annotations: [] }
            });
        });
    });

    describe('shouldFailJob', () => {
        it('should never fail the job with -1', () => {
            assert.strictEqual(shouldFailJob(100, { numberOfTestErrorToFailJob: -1 }), false);
        });

        it('should fail the job when the threshold is reached', () => {
            assert.strictEqual(shouldFailJob(2, { numberOfTestErrorToFailJob: 2 }), true);
        });

        it('should not fail the job under the threshold', () => {
            assert.strictEqual(shouldFailJob(1, { numberOfTestErrorToFailJob: 2 }), false);
        });
    });
});
