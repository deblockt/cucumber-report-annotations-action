import * as assert from 'assert';
import { buildJobSummary, collectJobSummaryContent, MAX_JOB_SUMMARY_STEPS, parseJobSummarySections } from '../src/jobSummary';
import { EMPTY_GLOBAL_INFO } from '../src/types';
import type { JobSummarySection, ReportResult, StepData } from '../src/types';

const inputs = {
    annotationStatusOnError: 'failure',
    annotationStatusOnUndefined: '',
    annotationStatusOnPending: '',
    jobSummaryContent: ['steps'] as JobSummarySection[]
};

const COUNTS = '    1 Scenarios (1 failed)\n    1 Steps (1 failed)';

function step(title: string, overrides: Partial<StepData> = {}): StepData {
    return { file: 'features/a.feature', line: 3, title, step: 'a failing step', error: 'boom', ...overrides };
}

function reportResult(overrides: Partial<ReportResult> = {}): ReportResult {
    return {
        listAllScenarioByFile: [],
        globalInformation: EMPTY_GLOBAL_INFO,
        failedSteps: [],
        undefinedSteps: [],
        pendingSteps: [],
        ...overrides
    };
}

const resolvePath = async (file: string) => file.startsWith('unknown') ? undefined : 'src/test/' + file;
const fileUrl = (path: string, line?: number) => `https://github.com/owner/repo/blob/sha/${path}${line ? `#L${line}` : ''}`;

async function details(result: ReportResult, overrides: Partial<typeof inputs> = {}): Promise<string> {
    return buildJobSummary(await collectJobSummaryContent(result, { ...inputs, ...overrides }, COUNTS, resolvePath), fileUrl);
}

describe('jobSummary', () => {
    describe('parseJobSummarySections', () => {
        it('should read a comma separated list of sections', () => {
            assert.deepStrictEqual(parseJobSummarySections(' counts, steps ,features'), ['counts', 'steps', 'features']);
        });

        it('should read an empty value as no section', () => {
            assert.deepStrictEqual(parseJobSummarySections(''), []);
        });

        it('should reject an unknown section', () => {
            assert.throws(() => parseJobSummarySections('counts,errors'),
                /^Error: Unknown job-summary-content section\(s\): errors\. The possible values are: counts, steps, features\.$/);
        });
    });

    it('should be empty without step in error', async () => {
        assert.strictEqual(await details(reportResult()), '');
    });

    it('should be empty without section', async () => {
        assert.strictEqual(await details(reportResult({ failedSteps: [step('Scenario KO')] }), { jobSummaryContent: [] }), '');
    });

    it('should contain the counts when the counts section is set', async () => {
        assert.strictEqual(await details(reportResult(), { jobSummaryContent: ['counts'] }), COUNTS);
    });

    it('should separate the sections', async () => {
        const summary = await details(reportResult({ failedSteps: [step('Scenario KO')] }), { jobSummaryContent: ['counts', 'steps'] });
        assert.ok(summary.startsWith(COUNTS + '\n\n##### Steps in error\n\n'));
    });

    it('should not detail the steps without the steps section', async () => {
        assert.strictEqual(await details(reportResult({ failedSteps: [step('Scenario KO')] }), { jobSummaryContent: ['counts'] }), COUNTS);
    });

    it('should detail a failed step with a link to the feature file', async () => {
        const summary = await details(reportResult({ failedSteps: [step('Scenario KO')] }));
        assert.strictEqual(summary,
            '##### Steps in error\n\n'
            + '<details><summary><b>Scenario KO</b> failed on <a href="https://github.com/owner/repo/blob/sha/src/test/features/a.feature#L3">src/test/features/a.feature#L3</a></summary>\n\n'
            + 'Step: <code>a failing step</code>\n<pre>boom</pre>\n\n'
            + '</details>');
    });

    it('should not link a feature file that is not found in the repository', async () => {
        const summary = await details(reportResult({ failedSteps: [step('Scenario KO', { file: 'unknown.feature' })] }));
        assert.match(summary, /failed on <code>unknown\.feature#L3<\/code>/);
    });

    it('should escape the html of the report', async () => {
        const summary = await details(reportResult({ failedSteps: [step('<script>', { error: 'expected <a> & "b"' })] }));
        assert.match(summary, /<b>&lt;script&gt;<\/b>/);
        assert.match(summary, /<pre>expected &lt;a&gt; &amp; &quot;b&quot;<\/pre>/);
    });

    it('should detail the undefined and pending steps only when their annotation status is set', async () => {
        const result = reportResult({ undefinedSteps: [step('Undefined scenario')], pendingSteps: [step('Pending scenario')] });
        assert.strictEqual(await details(result), '');
        const summary = await details(result, { annotationStatusOnUndefined: 'warning', annotationStatusOnPending: 'notice' });
        assert.match(summary, /<b>Undefined scenario<\/b> undefined on /);
        assert.match(summary, /<b>Pending scenario<\/b> pending on /);
    });

    it('should limit the number of detailed steps', async () => {
        const failedSteps = Array.from({ length: MAX_JOB_SUMMARY_STEPS + 3 }, (_, index) => step(`Scenario ${index}`));
        const summary = await details(reportResult({ failedSteps }));
        assert.strictEqual(summary.match(/<details>/g)?.length, MAX_JOB_SUMMARY_STEPS);
        assert.match(summary, /3 other step\(s\) not shown: only the first 100 steps are detailed\.$/);
    });

    it('should add the report of each feature when the features section is set', async () => {
        const result = reportResult({
            listAllScenarioByFile: [{
                file: 'features/a.feature',
                name: 'Feature A',
                scenarios: [{ name: 'OK', status: 'success' }, { name: 'KO', status: 'failed' }]
            }]
        });
        assert.strictEqual(await details(result), '');
        assert.strictEqual(await details(result, { jobSummaryContent: ['features'] }),
            '##### Features\n\n'
            + '<details><summary>Feature: <b>Feature A</b> (<a href="https://github.com/owner/repo/blob/sha/src/test/features/a.feature">src/test/features/a.feature</a>)</summary>\n\n'
            + '<ul><li>✅ Scenario: OK</li><li>❌ Scenario: KO</li></ul>\n\n'
            + '</details>');
    });
});
