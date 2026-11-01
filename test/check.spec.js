const assert = require('assert');
const { buildCheckTitle, computeCheckStatus, buildCheckRequest, shouldFailJob } = require('../src/check');

const statusInputs = {
    checkStatusOnError: 'failure',
    checkStatusOnUndefined: 'neutral',
    checkStatusOnPending: 'neutral'
};

function information(overrides) {
    return { failedScenarioNumber: 0, undefinedStepsNumber: 0, pendingStepNumber: 0, ...overrides };
}

describe('check', () => {
    describe('buildCheckTitle', () => {
        const inputs = { checkName: 'Cucumber', showNumberOfErrorOnCheckTitle: 'true' };

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
            const title = buildCheckTitle(information({ failedScenarioNumber: 2 }), { ...inputs, showNumberOfErrorOnCheckTitle: 'false' });
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

    describe('buildCheckRequest', () => {
        const context = { repo: { owner: 'owner', repo: 'my-repo' }, sha: 'commit-sha', payload: {} };
        const inputs = { ...statusInputs, checkName: 'Cucumber', showNumberOfErrorOnCheckTitle: 'true' };

        it('should build a completed check', () => {
            const request = buildCheckRequest({
                context,
                inputs,
                globalInformation: information({ failedScenarioNumber: 1 }),
                summary: 'the summary',
                annotations: ['annotation']
            });
            assert.deepStrictEqual(request, {
                owner: 'owner',
                repo: 'my-repo',
                name: 'Cucumber',
                head_sha: 'commit-sha',
                status: 'completed',
                conclusion: 'failure',
                output: {
                    title: 'Cucumber (1 error)',
                    summary: 'the summary',
                    annotations: ['annotation']
                }
            });
        });

        it('should use the head commit of the pull request', () => {
            const request = buildCheckRequest({
                context: { ...context, payload: { pull_request: { head: { sha: 'pr-head-sha' } } } },
                inputs,
                globalInformation: information(),
                summary: '',
                annotations: []
            });
            assert.strictEqual(request.head_sha, 'pr-head-sha');
        });
    });

    describe('shouldFailJob', () => {
        it('should never fail the job with -1', () => {
            assert.strictEqual(shouldFailJob(100, { numberOfTestErrorToFailJob: '-1' }), false);
        });

        it('should fail the job when the threshold is reached', () => {
            assert.strictEqual(shouldFailJob(2, { numberOfTestErrorToFailJob: '2' }), true);
        });

        it('should not fail the job under the threshold', () => {
            assert.strictEqual(shouldFailJob(1, { numberOfTestErrorToFailJob: '2' }), false);
        });
    });
});
