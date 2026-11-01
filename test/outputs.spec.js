const assert = require('assert');
const { setOutputs } = require('../src/outputs');
const { fakeCore } = require('./fakes');

const counts = {
    scenarios: { failed: 2, undefined: 3, pending: 1, passed: 1 },
    steps: { failed: 4, undefined: 5, skipped: 6, pending: 7, passed: 8 }
};

function outputNames(reportName) {
    return [
        ...['failed', 'undefined', 'pending', 'passed'].map(type => `${reportName}_${type}_scenarios`),
        ...['failed', 'undefined', 'skipped', 'pending', 'passed'].map(type => `${reportName}_${type}_steps`)
    ];
}

describe('outputs', () => {
    it('should publish the scenario counts', () => {
        const core = fakeCore();
        setOutputs(core, '/workspace/cucumber-report.json', counts);
        assert.strictEqual(core.outputs['cucumber-report_failed_scenarios'], 2);
        assert.strictEqual(core.outputs['cucumber-report_undefined_scenarios'], 3);
        assert.strictEqual(core.outputs['cucumber-report_pending_scenarios'], 1);
        assert.strictEqual(core.outputs['cucumber-report_passed_scenarios'], 1);
    });

    it('should publish the step counts', () => {
        const core = fakeCore();
        setOutputs(core, '/workspace/cucumber-report.json', counts);
        assert.strictEqual(core.outputs['cucumber-report_failed_steps'], 4);
        assert.strictEqual(core.outputs['cucumber-report_undefined_steps'], 5);
        assert.strictEqual(core.outputs['cucumber-report_skipped_steps'], 6);
        assert.strictEqual(core.outputs['cucumber-report_pending_steps'], 7);
        assert.strictEqual(core.outputs['cucumber-report_passed_steps'], 8);
    });

    it('should name the outputs after the report file', () => {
        const core = fakeCore();
        setOutputs(core, '/workspace/cucumber-report.json', counts);
        assert.deepStrictEqual(Object.keys(core.outputs), outputNames('cucumber-report'));
    });

    // the end-to-end workflow reads cucumber-report-empty_failed_scenarios for both formats
    it('should remove the ndjson extension from the output name', () => {
        const core = fakeCore();
        setOutputs(core, '/workspace/cucumber-report.ndjson', counts);
        assert.deepStrictEqual(Object.keys(core.outputs), outputNames('cucumber-report'));
    });

    it('should replace all the spaces of the output name', () => {
        const core = fakeCore();
        setOutputs(core, '/workspace/my cucumber report.json', counts);
        assert.deepStrictEqual(Object.keys(core.outputs), outputNames('my_cucumber_report'));
    });
});
