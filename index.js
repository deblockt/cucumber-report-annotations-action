const core = require('@actions/core');
const github = require('@actions/github');
const glob = require("@actions/glob");
const fs = require("fs");
const reportReader = require('./reportReader');

async function findBestFileMatch(file) {
    if (file.startsWith('classpath:')) {
        file = file.substring(10);
    }
    const glober = await glob.create('**/' + file, {
        followSymbolicLinks: false,
    });

    const match = [];
    for await (const featureFile of glober.globGenerator()) {
        const repoName = github.context.repo.repo;
        const indexOfRepoName = featureFile.indexOf(repoName);
        // convert /home/...../repoName/repoName/filePath to filePath
        const filePathWithoutWorkspace = featureFile.substring(indexOfRepoName + repoName.length * 2 + 2);
        match.push(filePathWithoutWorkspace);
    }

    return match[0];
}

async function buildErrorAnnotations(cucumberError, statusOnError) {
    return {
        path: (await findBestFileMatch(cucumberError.file)) || cucumberError.file,
        start_line: cucumberError.line,
        end_line: cucumberError.line,
        start_column: 0,
        end_column: 0,
        annotation_level: statusOnError,
        title: cucumberError.title + ' Failed.',
        message: 'Scenario: ' + cucumberError.title + '\nStep: ' + cucumberError.step + '\nError: \n' + cucumberError.error
    }
}

async function buildUndefinedAnnotation(cucumberError, statusOnSkipped) {
    return {
        path: (await findBestFileMatch(cucumberError.file)) || cucumberError.file,
        start_line: cucumberError.line,
        end_line: cucumberError.line,
        start_column: 0,
        end_column: 0,
        annotation_level: statusOnSkipped,
        title: cucumberError.title + ' Undefined.',
        message: 'Scenario: ' + cucumberError.title + '\nStep: ' + cucumberError.step
    }   
}

(async() => {
    const inputPath = core.getInput('path');
    const checkName = core.getInput('name');
    const accessToken = core.getInput('access-token');
    const checkStatusOnError = core.getInput('check-status-on-error');
    const checkStatusOnUndefined = core.getInput('check-status-on-undefined');
    const annotationStatusOnError = core.getInput('annotation-status-on-error');
    const annotationStatusOnUndefined = core.getInput('annotation-status-on-undefined');
    const showNumberOfErrorOnCheckTitle = core.getInput('show-number-of-error-on-check-title');
    
    const globber = await glob.create(inputPath, {
        followSymbolicLinks: false,
    });

    core.info("start to read cucumber logs using path " + inputPath);
    
    for await (const cucumberReportFile of globber.globGenerator()) {
        core.info("found cucumber report " + cucumberReportFile);

        const reportResultString = await fs.promises.readFile(cucumberReportFile);
        const reportResult = JSON.parse(reportResultString);
        const globalInformation = reportReader.globalInformation(reportResult);
        const summary = `
            ${globalInformation.scenarioNumber} Scenarios (${globalInformation.failedScenarioNumber} failed, ${globalInformation.scenarioNumber - globalInformation.failedScenarioNumber} passed)
            ${globalInformation.stepsNumber} Steps (${globalInformation.failedStepsNumber} failed, ${globalInformation.undefinedStepsNumber} undefined, ${globalInformation.skippedStepsNumber} skipped, ${globalInformation.succeedStepsNumber} passed)
        `;
        const errors = reportReader.failures(reportResult);
        var errorAnnotations = await Promise.all(errors.map(e => buildErrorAnnotations(e, annotationStatusOnError)));
        if (annotationStatusOnUndefined) {
            const undefined = reportReader.updefined(reportResult);
            var undefinedAnnotations = await Promise.all(undefined.map(e => buildUndefinedAnnotation(e, annotationStatusOnUndefined)));
            errorAnnotations.push(...undefinedAnnotations);
        }

        // TODO make an update request if there are more than 50 annotations
        errorAnnotations = errorAnnotations.slice(0, 49);
        const pullRequest = github.context.payload.pull_request;
        const head_sha = (pullRequest && pullRequest.head.sha) || github.context.sha;
        const annotations = [
            {
                path: "test",
                start_line: 0,
                end_line: 0,
                start_column: 0,
                end_column: 0,
                annotation_level: 'notice',
                title: 'Cucumber repport summary',
                message: summary,
            },
            ...errorAnnotations 
        ];
        var additionnalTitleInfo = '';
        if (showNumberOfErrorOnCheckTitle == 'true' && globalInformation.failedScenarioNumber > 0) {
            additionnalTitleInfo = ` (${globalInformation.failedScenarioNumber} error${globalInformation.failedScenarioNumber > 1 ? 's': ''})`;
        }
        var checkStatus = '';
        if (globalInformation.failedScenarioNumber > 0) {
            checkStatus = checkStatusOnError;
        } else if (globalInformation.undefinedStepsNumber > 0) {
            checkStatus = checkStatusOnUndefined;
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

        core.info(summary);
        core.info("send global cucumber report data");
        const octokit = github.getOctokit(accessToken); 
        await octokit.checks.create(createCheckRequest);
    }
})();