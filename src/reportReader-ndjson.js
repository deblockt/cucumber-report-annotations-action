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
    const hooks = {}
    const testCases = {}
    const testCasesStarted = {}
    const finishedTestCases = []
    reportString
        .toString().split('\n')
        .filter(it => it !== '')
        .forEach(line => {
            const element = JSON.parse(line)
            if ("gherkinDocument" in element) {
                const feature = element.gherkinDocument.feature
                // scenarios and backgrounds can be nested in rules
                const children = feature.children
                        .flatMap(it => "rule" in it ? it.rule.children : [it])
                const scenarios = []
                children
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
                children
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
                pk.steps = element.pickle.steps.map(it => {
                    return ({
                        id: it.id,
                        name: it.text,
                        location: steps[it.astNodeIds[0]].location
                    })
                })
                pk.steps.forEach(it => picklesSteps[it.id] = it)
                scenario[element.pickle.astNodeIds[0]].pickles[element.pickle.id] = pk
                pickles[element.pickle.id] = pk
            } else if ("hook" in element) {
                hooks[element.hook.id] = element.hook
            } else if ("testCase" in element) {
                const testCase = {
                    id: element.testCase.id,
                    pickle: pickles[element.testCase.pickleId],
                    // hook steps have a hookId instead of a pickleStepId
                    steps: element.testCase.testSteps.map(it => ({
                        id: it.id,
                        pickleStep: picklesSteps[it.pickleStepId],
                        hook: hooks[it.hookId]
                    }))
                }
                testCases[testCase.id] = testCase
            } else if ("testCaseStarted" in element) {
                testCasesStarted[element.testCaseStarted.id] = {
                    testCase: testCases[element.testCaseStarted.testCaseId],
                    results: {}
                }
            } else if ("testStepFinished" in element) {
                const testCaseStarted = testCasesStarted[element.testStepFinished.testCaseStartedId]
                testCaseStarted.results[element.testStepFinished.testStepId] = element.testStepFinished.testStepResult
            } else if ("testCaseFinished" in element) {
                const testCaseStartedId = element.testCaseFinished.testCaseStartedId
                // only the last attempt of a retried test case is kept
                if (!element.testCaseFinished.willBeRetried) {
                    const testCaseStarted = testCasesStarted[testCaseStartedId]
                    const testCase = testCaseStarted.testCase
                    testCase.steps.forEach(step => step.result = testCaseStarted.results[step.id])
                    testCase.pickle.testCase = testCase
                    finishedTestCases.push(testCase)
                }
                delete testCasesStarted[testCaseStartedId]
            }
        });

    const globalInfo = globalInformation(finishedTestCases)

    return {
        get listAllScenarioByFile() {
            return features
                .map(feature => ({
                    file: feature.uri,
                    name: feature.name,
                    scenarios: feature.scenarios
                        .flatMap(scenario =>
                            Object.values(scenario.pickles)
                                // pickles excluded by a tag filter have no test case
                                .filter(pickle => pickle.testCase)
                                .map(pickle => ({
                                    name: scenario.name,
                                    status: getTestCaseStatus(pickle.testCase)
                                }))
                        )
                }))
                .filter(feature => feature.scenarios.length > 0)
        },
        get globalInformation() {
            return globalInfo
        },
        get failedSteps() {
            return getStepsByStatus(finishedTestCases, 'FAILED')
        },
        get undefinedSteps() {
            return getStepsByStatus(finishedTestCases, 'UNDEFINED')
        },
        get pendingSteps() {
            return getStepsByStatus(finishedTestCases, 'PENDING')
        }
    }
}

function globalInformation(testCases) {
    const globalInfo = { ...EMPTY_GLOBAL_INFO }
    testCases.forEach(testCase => {
        // hooks are used for the scenario status but are not counted as steps
        const allStatuses = testCase.steps.map(step => step.result.status)
        const stepStatuses = testCase.steps
            .filter(step => step.pickleStep)
            .map(step => step.result.status)
        const countSteps = status => stepStatuses.filter(it => it === status).length

        globalInfo.scenarioNumber++
        if (allStatuses.includes('FAILED')) {
            globalInfo.failedScenarioNumber++
        }
        if (allStatuses.includes('PENDING')) {
            globalInfo.pendingScenarioNumber++
        }
        if (allStatuses.includes('UNDEFINED')) {
            globalInfo.undefinedScenarioNumber++
        }

        globalInfo.stepsNumber += stepStatuses.length
        globalInfo.failedStepsNumber += countSteps('FAILED')
        globalInfo.pendingStepNumber += countSteps('PENDING')
        globalInfo.undefinedStepsNumber += countSteps('UNDEFINED')
        globalInfo.skippedStepsNumber += countSteps('SKIPPED')
        globalInfo.succeedStepsNumber += countSteps('PASSED')
    })

    globalInfo.succeedScenarioNumber = globalInfo.scenarioNumber
        - globalInfo.failedScenarioNumber - globalInfo.pendingScenarioNumber - globalInfo.undefinedScenarioNumber;

    return globalInfo
}

function getStepsByStatus(testCases, status) {
    return testCases
                .flatMap(testCase => testCase.steps
                    .filter(it => it.result.status === status)
                    .map(it => {
                        const scenario = testCase.pickle.scenario
                        return ({
                            file: scenario.uri,
                            line: it.pickleStep ? it.pickleStep.location.line : scenario.location.line,
                            title: testCase.pickle.name,
                            step: it.pickleStep ? it.pickleStep.name : getHookName(it.hook),
                            error: it.result.message
                        })
                    })
                )
}

function getHookName(hook) {
    if (hook?.name) {
        return hook.name
    }
    switch (hook?.type) {
        case 'BEFORE_TEST_CASE':
            return 'Before hook'
        case 'AFTER_TEST_CASE':
            return 'After hook'
        default:
            return 'Hook'
    }
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
