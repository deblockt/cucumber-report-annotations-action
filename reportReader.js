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

module.exports.updefined = (report) => {
    return report
        .map(fileReport => fileUndefined(fileReport))
        .reduce((a, b) => a.concat(b), []);
}

function fileFailures(fileReport) {
    return fileReport.elements
        .filter(scenario => isFailed(scenario))
        .map(failedScenario => buildFailData(fileReport, failedScenario));
}

function fileUndefined(fileReport) {
    return fileReport.elements
        .filter(scenario => hasUndefined(scenario))
        .map(undefinedScenario => buildUndefinedData(fileReport, undefinedScenario));
}

function sum(info1, info2) {
    return {
        scenarioNumber: info1.scenarioNumber + info2.scenarioNumber,
        failedScenarioNumber: info1.failedScenarioNumber + info2.failedScenarioNumber,
        stepsNumber: info1.stepsNumber + info2.stepsNumber,
        failedStepsNumber: info1.failedStepsNumber + info2.failedStepsNumber,
        skippedStepsNumber: info1.skippedStepsNumber + info2.skippedStepsNumber,
        undefinedStepsNumber: info1.undefinedStepsNumber + info2.undefinedStepsNumber,
        succeedStepsNumber: info1.succeedStepsNumber + info2.succeedStepsNumber
    }
}

function globalFileInformation(reportFile) {
    const scenario = reportFile.elements
        .filter(scenario => scenario.type === 'scenario');

    const failedScenarioNumber = scenario
        .filter(scenario => isFailed(scenario))
        .length;
    const stepsNumber = reportFile.elements
        .map(scenario => scenario.steps.length)
        .reduce((a, b) => a + b, 0);
    const failedStepsNumber = reportFile.elements
        .map(scenario => getFailedSteps(scenario).length)
        .reduce((a, b) => a + b, 0);
    const skippedSteps = reportFile.elements
        .map(scenario => getSkippedSteps(scenario).length)
        .reduce((a, b) => a + b, 0);
    const undefinedSteps = reportFile.elements
        .map(scenario => getUndefinedSteps(scenario).length)
        .reduce((a, b) => a + b, 0);

    return {
        scenarioNumber: scenario.length,
        failedScenarioNumber: failedScenarioNumber,
        stepsNumber: stepsNumber,
        failedStepsNumber: failedStepsNumber,
        skippedStepsNumber: skippedSteps,
        undefinedStepsNumber: undefinedSteps,
        succeedStepsNumber: stepsNumber - failedStepsNumber - skippedSteps
    }
}

function getFailedSteps(scenario) {
    const before = scenario.before || [];
    const after = scenario.after || [];
    const steps = scenario.steps || [];

    return before.concat(after, steps)
        .filter(step => step.result.status === 'failed');
}
function getSkippedSteps(scenario) {
    const before = scenario.before || [];
    const after = scenario.after || [];
    const steps = scenario.steps || [];

    return before.concat(after, steps)
        .filter(step => step.result.status === 'skipped');
}
function getUndefinedSteps(scenario) {
    const before = scenario.before || [];
    const after = scenario.after || [];
    const steps = scenario.steps || [];

    return before.concat(after, steps)
        .filter(step => step.result.status === 'undefined');
}

function isFailed(scenario) {
    return getFailedSteps(scenario).length > 0;
}

function hasUndefined(scenario) {
    return getUndefinedSteps(scenario).length > 0;
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

function buildUndefinedData(fileReport, scenario) {
    const skippedStep = getUndefinedSteps(scenario)[0];
    return {
        file: fileReport.uri,
        line: skippedStep.line, 
        title: scenario.name,
        step: skippedStep.name,
        error: skippedStep.result.error_message
    }
}