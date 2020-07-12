module.exports.globalInformation = (report) => {
    return report
        .map(fileReport => globalFileInformation(fileReport))
        .reduce((a, b) => sum(a, b));
} 

function sum(info1, info2) {
    return {
        scenarioNumber: info1.scenarioNumber + info2.scenarioNumber,
        failedScenarioNumber: info1.failedScenarioNumber + info2.failedScenarioNumber,
        stepsNumber: info1.stepsNumber + info2.stepsNumber,
        failedStepsNumber: info1.failedStepsNumber + info2.failedStepsNumber
    }
}

function globalFileInformation(reportFile) {
    const scenario = reportFile.elements
        .filter(scenario => scenario.type === 'scenario');

    const failedScenarioNumber = scenario
        .filter(scenario => isFailed(scenario))
        .length;
    const stepsnumber = reportFile.elements
        .map(scenario => scenario.steps.length)
        .reduce((a, b) => a + b, 0);
    const failedStepsNumber = reportFile.elements
        .map(scenario => getFailedSteps(scenario).length)
        .reduce((a, b) => a + b, 0);

    return {
        scenarioNumber: scenario.length,
        failedScenarioNumber: failedScenarioNumber,
        stepsNumber: stepsnumber,
        failedStepsNumber: failedStepsNumber
    }
}

function getFailedSteps(scenario) {
    return scenario.steps
        .filter(step => step.result.status === 'failed');
}

function isFailed(scenario) {
    return getFailedSteps(scenario).length > 0;
}