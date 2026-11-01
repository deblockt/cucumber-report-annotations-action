function buildSummaryCounts(globalInformation) {
    return {
        scenarios: {
            'failed': globalInformation.failedScenarioNumber,
            'undefined': globalInformation.undefinedScenarioNumber,
            'pending': globalInformation.pendingScenarioNumber,
            'passed': globalInformation.succeedScenarioNumber
        },
        steps: {
            'failed': globalInformation.failedStepsNumber,
            'undefined': globalInformation.undefinedStepsNumber,
            'skipped': globalInformation.skippedStepsNumber,
            'pending': globalInformation.pendingStepNumber,
            'passed': globalInformation.succeedStepsNumber
        }
    };
}

function buildSummaryLine(itemNumber, itemType, itemCounts) {
    const header = itemNumber + ' ' + itemType;
    const counts = Object.keys(itemCounts)
        .filter(key => itemCounts[key] > 0)
        .map(key => itemCounts[key] + ' ' + key)
        .join(', ');
    return `    ${header} (${counts})`;
}

function buildNotSentAnnotationsMessage(notSentNumber, maxNumberOfAnnotations) {
    return notSentNumber > 0
        ? `\n\n${notSentNumber} annotation(s) not sent: the maximum number of annotations (${maxNumberOfAnnotations}) is reached.`
        : '';
}

function buildSummary(globalInformation, counts, notSentAnnotationNumber = 0, maxNumberOfAnnotations) {
    return buildSummaryLine(globalInformation.scenarioNumber, 'Scenarios', counts.scenarios)
        + '\n'
        + buildSummaryLine(globalInformation.stepsNumber, 'Steps', counts.steps)
        + buildNotSentAnnotationsMessage(notSentAnnotationNumber, maxNumberOfAnnotations);
}

module.exports = {
    buildSummaryCounts,
    buildSummary
};
