module.exports.globalInformation = (report) => {
    return report
        .map(fileReport => globalFileInformation(fileReport))
        .reduce((a, b) => sum(a, b));
} 

module.exports.failures = (report) => {
    return report
        .map(fileReport => fileFailures(fileReport))
        .reduce((a, b) => a.concat(b), []);
}

function fileFailures(fileReport) {
    return fileReport.elements
        .filter(scenario => isFailed(scenario))
        .map(failedScenario => buildFailData(fileReport, failedScenario));
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
    const before = scenario.before || [];
    const after = scenario.after || [];
    const steps = scenario.steps || [];

    return before.concat(after, steps)
        .filter(step => step.result.status === 'failed');
}

function isFailed(scenario) {
    return getFailedSteps(scenario).length > 0;
}

function buildFailData(fileReport, scenario) {
    const failedStep = getFailedSteps(scenario)[0];
    return {
        file: fileReport.uri,
        line: failedStep.line, 
        title: scenario.name,
        step: failedStep.name,
        error: failedStep.result.error_message
    }
}