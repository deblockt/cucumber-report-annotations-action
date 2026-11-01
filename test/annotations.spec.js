const assert = require('assert');
const { buildAnnotations } = require('../src/annotations');

const reportResult = {
    failedSteps: [{ file: 'a.feature', line: 3, title: 'Scenario KO', step: 'a failing step', error: 'boom' }],
    undefinedSteps: [{ file: 'a.feature', line: 7, title: 'Scenario undefined', step: 'an undefined step' }],
    pendingSteps: [{ file: 'b.feature', line: 2, title: 'Scenario pending', step: 'a pending step' }],
    listAllScenarioByFile: [{
        file: 'a.feature',
        name: 'Feature A',
        scenarios: [
            { name: 'Scenario OK', status: 'success' },
            { name: 'Scenario KO', status: 'failed' },
            { name: 'Scenario pending', status: 'pending' },
            { name: 'Scenario undefined', status: 'undefined' }
        ]
    }]
};

const allAnnotationsInputs = {
    annotationStatusOnError: 'failure',
    annotationStatusOnUndefined: 'warning',
    annotationStatusOnPending: 'notice',
    showGlobalSummaryReport: 'true'
};

const resolvePath = async file => 'features/' + file;

function titles(annotations) {
    return annotations.map(annotation => annotation.title);
}

describe('annotations', () => {
    describe('buildAnnotations', () => {
        it('should annotate the failed steps', async () => {
            const { annotations } = await buildAnnotations(reportResult, { annotationStatusOnError: 'failure' }, 50, resolvePath);
            assert.deepStrictEqual(annotations, [{
                path: 'features/a.feature',
                start_line: 3,
                end_line: 3,
                start_column: 0,
                end_column: 0,
                annotation_level: 'failure',
                title: 'Scenario KO Failed.',
                message: 'Scenario: Scenario KO\nStep: a failing step\nError: \nboom'
            }]);
        });

        it('should annotate undefined and pending steps when their status is set', async () => {
            const { annotations } = await buildAnnotations(reportResult, { ...allAnnotationsInputs, showGlobalSummaryReport: 'false' }, 50, resolvePath);
            assert.deepStrictEqual(
                annotations.map(({ path, start_line, annotation_level, title }) => ({ path, start_line, annotation_level, title })),
                [
                    { path: 'features/a.feature', start_line: 3, annotation_level: 'failure', title: 'Scenario KO Failed.' },
                    { path: 'features/a.feature', start_line: 7, annotation_level: 'warning', title: 'Scenario undefined Undefined.' },
                    { path: 'features/b.feature', start_line: 2, annotation_level: 'notice', title: 'Scenario pending Pending.' }
                ]
            );
        });

        it('should keep the report path when the file is not found', async () => {
            const { annotations } = await buildAnnotations(reportResult, { annotationStatusOnError: 'failure' }, 50, async () => undefined);
            assert.strictEqual(annotations[0].path, 'a.feature');
        });

        it('should use the line 0 when the step has no line', async () => {
            const report = { ...reportResult, failedSteps: [{ ...reportResult.failedSteps[0], line: undefined }] };
            const { annotations } = await buildAnnotations(report, { annotationStatusOnError: 'failure' }, 50, resolvePath);
            assert.strictEqual(annotations[0].start_line, 0);
            assert.strictEqual(annotations[0].end_line, 0);
        });

        it('should list the scenarios of each feature after the steps for the global summary report', async () => {
            const { annotations } = await buildAnnotations(reportResult, { annotationStatusOnError: 'failure', showGlobalSummaryReport: 'true' }, 50, resolvePath);
            assert.deepStrictEqual(annotations[1], {
                path: 'features/a.feature',
                start_line: 0,
                end_line: 0,
                start_column: 0,
                end_column: 0,
                annotation_level: 'notice',
                title: 'Feature: Feature A Report',
                message: '✅ Scenario: Scenario OK\n❌ Scenario: Scenario KO\n⌛ Scenario: Scenario pending\n- Scenario: Scenario undefined'
            });
        });

        it('should count the annotated steps as errors', async () => {
            const { errorNumber } = await buildAnnotations(reportResult, allAnnotationsInputs, 1, resolvePath);
            assert.strictEqual(errorNumber, 3);
        });

        describe('with a maximum number of annotations', () => {
            it('should keep the step annotations first', async () => {
                const { annotations, notSentNumber } = await buildAnnotations(reportResult, allAnnotationsInputs, 2, resolvePath);
                assert.deepStrictEqual(titles(annotations), ['Scenario KO Failed.', 'Scenario undefined Undefined.']);
                assert.strictEqual(notSentNumber, 2);
            });

            it('should give the remaining annotations to the global summary report', async () => {
                const { annotations, notSentNumber } = await buildAnnotations(reportResult, allAnnotationsInputs, 4, resolvePath);
                assert.deepStrictEqual(titles(annotations).slice(3), ['Feature: Feature A Report']);
                assert.strictEqual(notSentNumber, 0);
            });

            it('should not resolve the path of the annotations not sent', async () => {
                const resolvedFiles = [];
                await buildAnnotations(reportResult, allAnnotationsInputs, 1, async file => resolvedFiles.push(file) && file);
                assert.deepStrictEqual(resolvedFiles, ['a.feature']);
            });
        });
    });
});
