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

// failed steps annotations, followed by the undefined and pending ones when their annotation status is set
async function buildStepAnnotations(reportResult, { annotationStatusOnError, annotationStatusOnUndefined, annotationStatusOnPending }, resolvePath) {
    const stepsByType = [
        [reportResult.failedSteps, annotationStatusOnError, 'Failed'],
        [annotationStatusOnUndefined ? reportResult.undefinedSteps : [], annotationStatusOnUndefined, 'Undefined'],
        [annotationStatusOnPending ? reportResult.pendingSteps : [], annotationStatusOnPending, 'Pending']
    ];
    return Promise.all(stepsByType.flatMap(([steps, status, errorType]) =>
        steps.map(step => buildStepAnnotation(step, status, errorType, resolvePath))
    ));
}

function buildReportDetailAnnotations(reportResult, resolvePath) {
    return Promise.all(reportResult.listAllScenarioByFile.map(fileReport => buildReportDetailAnnotation(fileReport, resolvePath)));
}

module.exports = {
    buildStepAnnotations,
    buildReportDetailAnnotations
};
