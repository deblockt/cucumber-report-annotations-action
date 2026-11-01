function emojiByStatus(status) {
    switch (status) {
        case 'success':
            return '✅';
        case 'failed':
            return '❌'
        case 'pending':
            return '⌛';
        default:
            return '-';
    }
}

async function buildStepAnnotation(cucumberError, status, errorType, resolvePath) {
    return {
        path: (await resolvePath(cucumberError.file)) || cucumberError.file,
        start_line: cucumberError.line || 0,
        end_line: cucumberError.line || 0,
        start_column: 0,
        end_column: 0,
        annotation_level: status,
        title: cucumberError.title + ' ' + errorType + '.',
        message: 'Scenario: ' + cucumberError.title + '\nStep: ' + cucumberError.step + '\nError: \n' + cucumberError.error
    }
}

async function buildReportDetailAnnotation(fileReport, resolvePath) {
    const message = fileReport.scenarios
        .map(scenario => `${emojiByStatus(scenario.status)} Scenario: ${scenario.name}`)
        .join('\n');

    return {
        path: (await resolvePath(fileReport.file)) || fileReport.file,
        start_line: 0,
        end_line: 0,
        start_column: 0,
        end_column: 0,
        annotation_level: 'notice',
        title: `Feature: ${fileReport.name} Report`,
        message
    };
}

function listStepsToAnnotate(reportResult, { annotationStatusOnError, annotationStatusOnUndefined, annotationStatusOnPending }) {
    const stepsWithType = (steps, status, errorType) => steps.map(step => ({ step, status, errorType }));
    return [
        ...stepsWithType(reportResult.failedSteps, annotationStatusOnError, 'Failed'),
        ...(annotationStatusOnUndefined ? stepsWithType(reportResult.undefinedSteps, annotationStatusOnUndefined, 'Undefined') : []),
        ...(annotationStatusOnPending ? stepsWithType(reportResult.pendingSteps, annotationStatusOnPending, 'Pending') : [])
    ];
}

// annotations over the maximum are not built, as resolving their path is costly
async function buildAnnotations(reportResult, inputs, maxNumberOfAnnotations, resolvePath) {
    const steps = listStepsToAnnotate(reportResult, inputs);
    const fileReports = inputs.showGlobalSummaryReport === 'true' ? reportResult.listAllScenarioByFile : [];
    const sentSteps = steps.slice(0, maxNumberOfAnnotations);
    const sentFileReports = fileReports.slice(0, maxNumberOfAnnotations - sentSteps.length);

    const annotations = await Promise.all([
        ...sentSteps.map(({ step, status, errorType }) => buildStepAnnotation(step, status, errorType, resolvePath)),
        ...sentFileReports.map(fileReport => buildReportDetailAnnotation(fileReport, resolvePath))
    ]);
    return {
        annotations,
        errorNumber: steps.length,
        notSentNumber: steps.length + fileReports.length - annotations.length
    };
}

module.exports = { buildAnnotations };
