import * as assert from 'assert';
import { loadCases } from './e2e/cases';

describe('end-to-end cases', () => {
    it('are consistent with action.yml and the test workflow', () => {
        const { cases, checks } = loadCases();

        assert.ok(cases.length > 0);
        assert.ok(checks.length >= cases.length);
    });

    it('fill the inputs not set by a case with the action.yml default values', () => {
        const { cases } = loadCases();
        const failedCase = cases.find(c => c.checkName === 'json: failed cucumber report');

        assert.deepStrictEqual(failedCase?.inputs, {
            'name': 'json: failed cucumber report',
            'path': '**/cucumber-report.json',
            'check-status-on-error': 'failure',
            'check-status-on-undefined': 'success',
            'check-status-on-pending': 'success',
            'annotation-status-on-error': 'failure',
            'annotation-status-on-undefined': '',
            'annotation-status-on-pending': '',
            'show-number-of-error-on-check-title': 'true',
            'show-global-summary-report': 'false',
            'number-of-test-error-to-fail-job': '-1',
            'max-number-of-annotations': '50',
            'ignore-no-report-found': 'false'
        });
    });
});
