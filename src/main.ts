import * as reportReaderJson from './reportReader-json';
import * as reportReaderNdJson from './reportReader-ndjson';
import { createFileMatcher } from './fileMatcher';
import { buildAnnotations } from './annotations';
import { setOutputs } from './outputs';
import { buildSummaryCounts, buildSummary } from './summary';
import { buildCheckRequests, shouldFailJob } from './check';
import type { Core, Dependencies, Inputs, Octokit, PathResolver, ReportReader } from './types';

interface PublishDependencies extends Pick<Dependencies, 'core' | 'github' | 'fs'> {
    octokit: Octokit;
    inputs: Inputs;
    resolvePath: PathResolver;
}

function readInputs(core: Core): Inputs {
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
        showNumberOfErrorOnCheckTitle: core.getBooleanInput('show-number-of-error-on-check-title'),
        numberOfTestErrorToFailJob: Number(core.getInput('number-of-test-error-to-fail-job')),
        showGlobalSummaryReport: core.getBooleanInput('show-global-summary-report'),
        ignoreNoReportFound: core.getBooleanInput('ignore-no-report-found'),
        maxNumberOfAnnotations: Number(core.getInput('max-number-of-annotations'))
    };
}

async function publishReportFile({ core, github, fs, octokit, inputs, resolvePath }: PublishDependencies, cucumberReportFile: string, remainingAnnotations: number): Promise<number> {
    const reportResultString = await fs.promises.readFile(cucumberReportFile);
    const reportReader: ReportReader = cucumberReportFile.endsWith('.json') ? reportReaderJson : reportReaderNdJson;
    const reportResult = reportReader.reader(reportResultString);
    const globalInformation = reportResult.globalInformation;
    const counts = buildSummaryCounts(globalInformation);
    setOutputs(core, cucumberReportFile, counts);

    const { annotations, errorNumber, notSentNumber } = await buildAnnotations(reportResult, inputs, remainingAnnotations, resolvePath);

    const summary = buildSummary(globalInformation, counts, notSentNumber, inputs.maxNumberOfAnnotations);
    const checkRequests = buildCheckRequests({
        context: github.context,
        inputs,
        globalInformation,
        summary,
        annotations
    });
    const checkTitle = checkRequests.create.output.title;

    core.info('Creating summary:\n' + summary);
    await core.summary
      .addHeading(checkTitle, 4)
      .addRaw("\n" + summary)
      .write()

    core.info('Sending cucumber annotations');
    const checksReponse = await octokit.rest.checks.create(checkRequests.create);
    for (const updateRequest of checkRequests.updates) {
        await octokit.rest.checks.update({ ...updateRequest, check_run_id: checksReponse.data.id });
    }

    if (shouldFailJob(errorNumber, inputs)) {
        core.setFailed(`${errorNumber} test(s) in error`);
    }
    return annotations.length;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function publishReports({ core, github, glob, fs, workspace = process.cwd() }: Dependencies): Promise<void> {
    const inputs = readInputs(core);
    const resolvePath = createFileMatcher({ core, glob, workspace });
    const globber = await glob.create(inputs.inputPath, {
        followSymbolicLinks: false,
    });
    core.info("start to read cucumber logs using path " + inputs.inputPath);

    const reportFiles = await globber.glob();
    if (reportFiles.length === 0) {
        if (!inputs.ignoreNoReportFound) {
            core.setFailed(`No file matching "${inputs.inputPath}" was found in the project.`);
        } else {
            core.info(`No file matching "${inputs.inputPath}" was found in the project.`);
        }
        return;
    }
    const dependencies = { core, github, fs, octokit: github.getOctokit(inputs.accessToken), inputs, resolvePath };
    let remainingAnnotations = inputs.maxNumberOfAnnotations;
    for (const cucumberReportFile of reportFiles) {
        core.info("found cucumber report " + cucumberReportFile);
        try {
            const sentAnnotationNumber = await publishReportFile(dependencies, cucumberReportFile, remainingAnnotations);
            remainingAnnotations -= sentAnnotationNumber;
        } catch (error) {
            throw new Error(`Unable to publish the cucumber report ${cucumberReportFile}: ${errorMessage(error)}`, { cause: error });
        }
    }
}

function errorStack(error: unknown): string {
    const cause = error instanceof Error ? error.cause ?? error : error;
    return cause instanceof Error && cause.stack ? cause.stack : String(cause);
}

export async function run(dependencies: Dependencies): Promise<void> {
    try {
        await publishReports(dependencies);
    } catch (error) {
        dependencies.core.debug(errorStack(error));
        dependencies.core.setFailed(errorMessage(error));
    }
}
