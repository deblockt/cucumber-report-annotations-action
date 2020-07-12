const core = require('@actions/core');
const github = require('@actions/github');
const glob = require("@actions/glob");
const fs = require("fs");
const reportReader = require('./reportReader');

(async() => {
    const inputPath = core.getInput("path");
    const accessToken = core.getInput("access-token");
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
            ${globalInformation.stepsNumber} Steps (${globalInformation.failedStepsNumber} failed, ${globalInformation.stepsNumber - globalInformation.failedStepsNumber} passed)
        `;

        const pullRequest = github.context.payload.pull_request;
        const link = (pullRequest && pullRequest.html_url) || github.context.ref;
        const status = "completed";
        const head_sha = (pullRequest && pullRequest.head.sha) || github.context.sha;
        const annotations = [
            {
                path: "test",
                start_line: 0,
                end_line: 0,
                start_column: 0,
                end_column: 0,
                annotation_level: 'notice',
                message: summary,
            }
        ];
        const createCheckRequest = {
            ...github.context.repo,
            name: 'Cucumber report',
            head_sha,
            status,
            conclusion: 'success',
            output: {
              title: 'Cucumber report',
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