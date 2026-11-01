const assert = require('assert');
const { buildSummaryCounts, buildSummary } = require('../src/summary');

const globalInformation = {
    scenarioNumber: 7,
    failedScenarioNumber: 2,
    undefinedScenarioNumber: 3,
    pendingScenarioNumber: 1,
    succeedScenarioNumber: 1,
    stepsNumber: 9,
    failedStepsNumber: 2,
    undefinedStepsNumber: 3,
    skippedStepsNumber: 1,
    pendingStepNumber: 1,
    succeedStepsNumber: 2
};

describe('summary', () => {
    describe('buildSummaryCounts', () => {
        it('should count scenarios and steps by status', () => {
            assert.deepStrictEqual(buildSummaryCounts(globalInformation), {
                scenarios: { failed: 2, undefined: 3, pending: 1, passed: 1 },
                steps: { failed: 2, undefined: 3, skipped: 1, pending: 1, passed: 2 }
            });
        });
    });

    describe('buildSummary', () => {
        it('should describe scenarios and steps', () => {
            const summary = buildSummary(globalInformation, buildSummaryCounts(globalInformation));
            assert.strictEqual(summary,
                '    7 Scenarios (2 failed, 3 undefined, 1 pending, 1 passed)\n'
                + '    9 Steps (2 failed, 3 undefined, 1 skipped, 1 pending, 2 passed)');
        });

        it('should not list the statuses without item', () => {
            const information = { ...globalInformation, scenarioNumber: 1, failedScenarioNumber: 0, undefinedScenarioNumber: 0, pendingScenarioNumber: 0 };
            const summary = buildSummary(information, buildSummaryCounts(information));
            assert.strictEqual(summary.split('\n')[0], '    1 Scenarios (1 passed)');
        });
    });
});
