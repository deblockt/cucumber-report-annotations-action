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

function buildSummary(globalInformation, counts) {
    return buildSummaryLine(globalInformation.scenarioNumber, 'Scenarios', counts.scenarios)
        + '\n'
        + buildSummaryLine(globalInformation.stepsNumber, 'Steps', counts.steps);
}

module.exports = {
    buildSummaryCounts,
    buildSummary
};
