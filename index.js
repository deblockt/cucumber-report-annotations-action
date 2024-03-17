const core = require('@actions/core');
const github = require('@actions/github');
const glob = require("@actions/glob");
const fs = require("fs");
const reportReaderJson = require('./reportReader-json');
const reportReaderJsond = require('./reportReader-jsond');

function memoize(fn) {
    const cache = {};

    return (...args) => {
        let argsString = JSON.stringify(args);
        return argsString in cache
          ? cache[argsString]
          : (cache[argsString] = fn(...args));
    }
}

async function findBestFileMatch(file) {
    let searchFile = file;
    if (searchFile.startsWith('classpath:')) {
        searchFile = searchFile.substring(10);
    }
    const globber = await glob.create('**/' + searchFile, {
        followSymbolicLinks: false,
    });
    const files = await globber.glob()
    if (files.length > 0) {
        const featureFile = files[0];
        const repoName = github.context.repo.repo;
        const indexOfRepoName = featureFile.indexOf(repoName);
        const filePathWithoutWorkspace = featureFile.substring(indexOfRepoName + repoName.length * 2 + 2);
        return filePathWithoutWorkspace;
    }

    return undefined;
}

const memoizedFindBestFileMatch = memoize(findBestFileMatch)

async function buildStepAnnotation(cucumberError, status, errorType) {
    return {
        path: (await memoizedFindBestFileMatch(cucumberError.file)) || cucumberError.file,
        start_line: cucumberError.line || 0,
        end_line: cucumberError.line || 0,
        start_column: 0,
        end_column: 0,
        annotation_level: status,
        title: cucumberError.title + ' ' + errorType + '.',
        message: 'Scenario: ' + cucumberError.title + '\nStep: ' + cucumberError.step + '\nError: \n' + cucumberError.error
    }
}

async function buildReportDetailAnnotation(fileReport) {
    const message = fileReport.scenarios
        .map(scenario => `${emojiByStatus(scenario.status)} Scenario: ${scenario.name}`)
        .join('\n');

    return {
        path: (await memoizedFindBestFileMatch(fileReport.file)) || fileReport.file,
        start_line: 0,
        end_line: 0,
        start_column: 0,
        end_column: 0,
        annotation_level: 'notice',
        title: `Feature: ${fileReport.name} Report`,
        message
    };
}

async function buildErrorAnnotations(cucumberError, statusOnError) {
    return await buildStepAnnotation(cucumberError, statusOnError, 'Failed');
}

async function buildUndefinedAnnotation(cucumberError, statusOnSkipped) {
    return await buildStepAnnotation(cucumberError, statusOnSkipped, 'Undefined');
}

async function buildPendingAnnotation(cucumberError, statusOnPending) {
    return await buildStepAnnotation(cucumberError, statusOnPending, 'Pending');
}

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

function setOutput(core, outputName, summaryScenario, summarySteps) {
    for (const type in summaryScenario) {
        core.setOutput(`${outputName}_${type}_scenarios`, summaryScenario[type]);
    }
    for (const type in summarySteps) {
        core.setOutput(`${outputName}_${type}_steps`, summaryScenario[type]);
    }
}

(async() => {
    const inputPath = core.getInput('path');
    const checkName = core.getInput('name');
    const accessToken = core.getInput('access-token');
    const checkStatusOnError = core.getInput('check-status-on-error');
    const checkStatusOnUndefined = core.getInput('check-status-on-undefined');
    const checkStatusOnPending = core.getInput('check-status-on-pending');
    const annotationStatusOnError = core.getInput('annotation-status-on-error');
    const annotationStatusOnUndefined = core.getInput('annotation-status-on-undefined');
    const annotationStatusOnPending = core.getInput('annotation-status-on-pending');
    const showNumberOfErrorOnCheckTitle = core.getInput('show-number-of-error-on-check-title');
    const numberOfTestErrorToFailJob = core.getInput('number-of-test-error-to-fail-job');
    const showGlobalSummaryReport = core.getInput('show-global-summary-report')
    const globber = await glob.create(inputPath, {
        followSymbolicLinks: false,
    });

    core.info("start to read cucumber logs using path " + inputPath);

    for await (const cucumberReportFile of globber.globGenerator()) {
        core.info("found cucumber report " + cucumberReportFile);

        const reportOutputName = cucumberReportFile.replace(' ', '_').replace('.json', '');
        const reportResultString = await fs.promises.readFile(cucumberReportFile);
        const reportResult = (cucumberReportFile.endsWith('.json') ? reportReaderJson : reportReaderJsond).reader(reportResultString);
        const globalInformation = reportResult.globalInformation;
        const summaryScenario = {
            'failed': globalInformation.failedScenarioNumber,
            'undefined': globalInformation.undefinedScenarioNumber,
            'pending': globalInformation.pendingScenarioNumber,
            'passed': globalInformation.succeedScenarioNumber
        };
        const summarySteps = {
            'failed': globalInformation.failedStepsNumber,
            'undefined': globalInformation.undefinedStepsNumber,
            'skipped': globalInformation.skippedStepsNumber,
            'pending': globalInformation.pendingStepNumber,
            'passed': globalInformation.succeedStepsNumber
        };
        setOutput(core, reportOutputName, summaryScenario, summarySteps);

        const summary =
               buildSummary(globalInformation.scenarioNumber, 'Scenarios', summaryScenario)
            + '\n'
            + buildSummary(globalInformation.stepsNumber, 'Steps', summarySteps);

        const errors = reportResult.failedSteps;
        var errorAnnotations = await Promise.all(errors.map(e => buildErrorAnnotations(e, annotationStatusOnError)));

        if (annotationStatusOnUndefined) {
            const undefined = reportResult.undefinedSteps;
            var undefinedAnnotations = await Promise.all(undefined.map(e => buildUndefinedAnnotation(e, annotationStatusOnUndefined)));
            errorAnnotations.push(...undefinedAnnotations);
        }
        if (annotationStatusOnPending) {
            const pending = reportResult.pendingSteps;
            var pendingAnnotations = await Promise.all(pending.map(e => buildPendingAnnotation(e, annotationStatusOnPending)));
            errorAnnotations.push(...pendingAnnotations);
        }

        // TODO make an update request if there are more than 50 annotations
        const errorAnnotationsToCreate = errorAnnotations.slice(0, 49);
        const pullRequest = github.context.payload.pull_request;
        const head_sha = (pullRequest && pullRequest.head.sha) || github.context.sha;
        const annotations = [
            ...errorAnnotationsToCreate
        ];

        var additionnalTitleInfo = '';
        if (showNumberOfErrorOnCheckTitle == 'true' && globalInformation.failedScenarioNumber > 0) {
            additionnalTitleInfo = ` (${globalInformation.failedScenarioNumber} error${globalInformation.failedScenarioNumber > 1 ? 's': ''})`;
        }
        var checkStatus = '';
        if (globalInformation.failedScenarioNumber > 0 && checkStatusOnError !== 'success') {
            checkStatus = checkStatusOnError;
        } else if (globalInformation.undefinedStepsNumber > 0 && checkStatusOnUndefined !== 'success') {
            checkStatus = checkStatusOnUndefined;
        } else if (globalInformation.pendingStepNumber > 0) {
            checkStatus = checkStatusOnPending;
        } else {
            checkStatus = 'success';
        }
        const createCheckRequest = {
            ...github.context.repo,
            name: checkName,
            head_sha,
            status: 'completed',
            conclusion: checkStatus,
            output: {
              title: checkName + additionnalTitleInfo,
              summary,
              annotations
            },
          };

        core.info('Creating summary: ' + summary);
        await core.summary
          .addHeading(checkName + additionnalTitleInfo, 4)
          .addRaw("\n" + summary)
          .write()

        core.info('Sending cucumber annotations');
        const octokit = github.getOctokit(accessToken);
        const checksReponse = await octokit.rest.checks.create(createCheckRequest);

        if (numberOfTestErrorToFailJob != -1 && errorAnnotations.length >= numberOfTestErrorToFailJob) {
            core.setFailed(`${errorAnnotations.length} test(s) in error`);
        }

        if (showGlobalSummaryReport === 'true') {
            core.info('Building all scenario summary')
            const allScenarioByFile = reportResult.listAllScenarioByFile;
            const allAnnoattions = await Promise.all(
                allScenarioByFile
                    .map(buildReportDetailAnnotation)
                    .reduce((a, b) => a.concat(b), [])
            );
            core.info('Send core scenario summary')
            await octokit.rest.checks.update({
                ...github.context.repo,
                check_run_id: checksReponse.data.id,
                output: {
                    title: checkName + additionnalTitleInfo,
                    summary,
                    annotations: allAnnoattions
                }
            });
        }
    }
})();

function buildSummary(itemNumber, itemType, itemCounts) {
    const header = itemNumber + ' ' + itemType;
    const counts = Object.keys(itemCounts)
        .filter(key => itemCounts[key] > 0)
        .map(key => itemCounts[key] + ' ' + key)
        .join(', ');
    return `    ${header} (${counts})`;
}