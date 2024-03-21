const core = require('@actions/core');

const EMPTY_GLOBAL_INFO = {
    scenarioNumber: 0,
    failedScenarioNumber: 0,
    pendingScenarioNumber: 0,
    undefinedScenarioNumber: 0,
    stepsNumber: 0,
    succeedScenarioNumber: 0,
    failedStepsNumber: 0,
    skippedStepsNumber: 0,
    undefinedStepsNumber: 0,
    succeedStepsNumber: 0,
    pendingStepNumber: 0
}

module.exports.reader = (reportString) => {
    const features = []
    const scenario = {}
    const steps = {}
    const pickles = {}
    const picklesSteps = {}
    const testCases = {}
    const testSteps = {}
    const globalInfo = { ...EMPTY_GLOBAL_INFO }
    reportString
        .toString().split('\n')
        .filter(it => it !== '')
        .forEach(line => {
            const element = JSON.parse(line)    
            if ("gherkinDocument" in element) {
                const feature = element.gherkinDocument.feature
                const scenarios = []
                feature.children
                        .filter(it => "scenario" in it)
                        .forEach(it => {
                            const sc = {
                                name: it.scenario.name,
                                id: it.scenario.id,
                                location: it.scenario.location,
                                uri: element.gherkinDocument.uri,
                                pickles: {}
                            }
                            scenario[sc.id] = sc
                            scenarios.push(sc)
                        })
                feature.children
                        .filter(it => "background" in it || "scenario" in it)
                        .forEach(it => {
                            const scenarioSteps = it.background?.steps ?? it.scenario?.steps
                            scenarioSteps.forEach(step => {
                                steps[step.id] = {
                                    location: step.location
                                }
                            })
                        })

                features.push({
                    name: feature.name,
                    location: feature.location,
                    uri: element.gherkinDocument.uri,
                    scenarios: scenarios
                })
            } else if ("pickle" in element) {
                const pk = {
                    name: element.pickle.name,
                    scenario: scenario[element.pickle.astNodeIds[0]]
                }
                pk.steps = element.pickle.steps.map(it => ({
                    id: it.id,
                    name: it.text,
                    pickle: pk,
                    location: steps[it.astNodeIds[0]].location.line
                }))
                pk.steps.forEach(it => picklesSteps[it.id] = it)
                scenario[element.pickle.astNodeIds[0]].pickles[element.pickle.id] = pk
                pickles[element.pickle.id] = pk
            } else if ("testCase" in element) {
                globalInfo.scenarioNumber++;
                const caseTestSteps = element.testCase.testSteps.map(it => ({
                    id: it.id,
                    pickleStep: picklesSteps[it.pickleStepId]
                }))
                caseTestSteps.forEach(it => testSteps[it.id] = it)
                const testCase = {
                    id: element.testCase.id,
                    pickleId: element.testCase.pickleId,
                    steps: caseTestSteps
                }
                pickles[element.testCase.pickleId].testCase = testCase
                testCases[testCase.id] = testCase
            } else if ("testStepFinished" in element) {
                globalInfo.stepsNumber++;
                const step = testSteps[element.testStepFinished.testStepId]
                step.result = element.testStepFinished.testStepResult
                if (step.result.status === 'FAILED') {
                    globalInfo.failedScenarioNumber++;
                    globalInfo.failedStepsNumber++;
                } else if (step.result.status === 'PENDING') {
                    globalInfo.pendingScenarioNumber++;
                    globalInfo.pendingStepNumber++;
                } else if (step.result.status === 'UNDEFINED') {
                    globalInfo.undefinedScenarioNumber++;
                    globalInfo.undefinedStepsNumber++;
                } else if (step.result.status === 'SKIPPED') {
                    globalInfo.skippedStepsNumber++
                } else if (step.result.status === 'PASSED') {
                    globalInfo.succeedStepsNumber++;
                }
            }
        });

    globalInfo.succeedScenarioNumber = globalInfo.scenarioNumber 
        - globalInfo.failedScenarioNumber - globalInfo.pendingScenarioNumber - globalInfo.undefinedScenarioNumber;

    return {
        get listAllScenarioByFile() {
            return features
                .map(feature => ({
                    file: feature.uri,
                    name: feature.name,
                    scenarios: feature.scenarios
                        .flatMap(scenario =>
                            Object.values(scenario.pickles).map(pickle => ({
                                name: scenario.name,
                                status: getTestCaseStatus(pickle.testCase)
                            }))
                        )
                }))
        },
        get globalInformation() {
            return globalInfo
        },
        get failedSteps() {
            return getStepsByStatus(testSteps, 'FAILED')
        },
        get undefinedSteps() {
            return getStepsByStatus(testSteps, 'UNDEFINED')
        },
        get pendingSteps() {
            return getStepsByStatus(testSteps, 'PENDING')
        }
    }
}

function getStepsByStatus(testSteps, status) {
    return Object.values(testSteps)
                .filter(it => it.result.status === status)
                .map(it => ({
                    file: it.pickleStep.pickle.scenario.uri,
                    line: it.pickleStep.location.line,
                    title: it.pickleStep.pickle.name,
                    step: it.pickleStep.name,
                    error: it.result.message
                }))
}

function getTestCaseStatus(testCase) {
    const steps = testCase.steps;
    for (const step of steps) {
        if (step.result.status === 'FAILED') {
            return 'failed';
        } else if (step.result.status === 'SKIPPED') {
            return 'skipped';
        } else if (step.result.status === 'UNDEFINED') {
            return 'undefined';
        } else if (step.result.status === 'PENDING') {
            return 'pending';
        }
    }
    return 'success';
}
