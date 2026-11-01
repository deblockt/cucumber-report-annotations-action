const reportReaderJson = require('./reportReader-json');
const reportReaderNdJson = require('./reportReader-ndjson');
const { createFileMatcher } = require('./fileMatcher');
const { buildStepAnnotations, buildReportDetailAnnotations } = require('./annotations');
const { setOutputs } = require('./outputs');
const { buildSummaryCounts, buildSummary } = require('./summary');
const { buildCheckRequest, shouldFailJob } = require('./check');

function readInputs(core) {
    return {
        inputPath: core.getInput('path'),
        checkName: core.getInput('name'),
        accessToken: core.getInput('access-token'),
        checkStatusOnError: core.getInput('check-status-on-error'),
        checkStatusOnUndefined: core.getInput('check-status-on-undefined'),
        checkStatusOnPending: core.getInput('check-status-on-pending'),
        annotationStatusOnError: core.getInput('annotation-status-on-error'),
        annotationStatusOnUndefined: core.getInput('annotation-status-on-undefined'),
        annotationStatusOnPending: core.getInput('annotation-status-on-pending'),
        showNumberOfErrorOnCheckTitle: core.getInput('show-number-of-error-on-check-title'),
        numberOfTestErrorToFailJob: core.getInput('number-of-test-error-to-fail-job'),
        showGlobalSummaryReport: core.getInput('show-global-summary-report'),
        ignoreNoReportFound: core.getInput('ignore-no-report-found')
    };
}

async function run({ core, github, glob, fs, workspace = process.cwd() }) {
    const inputs = readInputs(core);
    const resolvePath = createFileMatcher({ core, glob, workspace });
    const globber = await glob.create(inputs.inputPath, {
        followSymbolicLinks: false,
    });
    core.info("start to read cucumber logs using path " + inputs.inputPath);

    const reportFiles = await globber.glob();
    if (reportFiles.length === 0) {
        if (inputs.ignoreNoReportFound === 'false') {
            core.setFailed(`No file matching "${inputs.inputPath}" was found in the project.`);
        } else {
            core.info(`No file matching "${inputs.inputPath}" was found in the project.`);
        }
        return;
    }
    const octokit = github.getOctokit(inputs.accessToken);
    for await (const cucumberReportFile of reportFiles) {
        core.info("found cucumber report " + cucumberReportFile);

        const reportResultString = await fs.promises.readFile(cucumberReportFile);
        const reportResult = (cucumberReportFile.endsWith('.json') ? reportReaderJson : reportReaderNdJson).reader(reportResultString);
        const globalInformation = reportResult.globalInformation;
        const counts = buildSummaryCounts(globalInformation);
        setOutputs(core, cucumberReportFile, counts);

        const summary = buildSummary(globalInformation, counts);
        const errorAnnotations = await buildStepAnnotations(reportResult, inputs, resolvePath);

        // TODO make an update request if there are more than 50 annotations
        const createCheckRequest = buildCheckRequest({
            context: github.context,
            inputs,
            globalInformation,
            summary,
            annotations: errorAnnotations.slice(0, 49)
        });
        const checkTitle = createCheckRequest.output.title;

        core.info('Creating summary:\n' + summary);
        await core.summary
          .addHeading(checkTitle, 4)
          .addRaw("\n" + summary)
          .write()

        core.info('Sending cucumber annotations');
        const checksReponse = await octokit.rest.checks.create(createCheckRequest);

        if (shouldFailJob(errorAnnotations.length, inputs)) {
            core.setFailed(`${errorAnnotations.length} test(s) in error`);
        }

        if (inputs.showGlobalSummaryReport === 'true') {
            core.info('Building all scenario summary')
            const allAnnotations = await buildReportDetailAnnotations(reportResult, resolvePath);
            core.info('Send core scenario summary')
            await octokit.rest.checks.update({
                ...github.context.repo,
                check_run_id: checksReponse.data.id,
                output: {
                    title: checkTitle,
                    summary,
                    annotations: allAnnotations
                }
            });
        }
    }
}

module.exports = { run };
