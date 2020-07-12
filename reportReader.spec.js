const expect = require('expect.js');
const reportReader = require('./reportReader');

describe('globalInformation', function () {
    it('should return global information from cucumber report', function () {
        const expected = {
            scenarioNumber: 10,
            failedScenarioNumber: 3,
            stepsNumber: 30,
            failedStepsNumber: 3,
        };
        const report = buildReport(expected);

        const result = reportReader.globalInformation(report);
        
        expect(result).to.be.eql(expected);
    }); 

    it('should return 0 for empty report', function () {
        const expected = {
            scenarioNumber: 0,
            failedScenarioNumber: 0,
            stepsNumber: 0,
            failedStepsNumber: 0,
        };
        const report = buildReport(expected);

        const result = reportReader.globalInformation(report);
        
        expect(result).to.be.eql(expected);
    }); 
});

function buildReport(config) {
    return [
        buildFileReport(config)
    ]
}

function buildFileReport(config) {
    const stepsByScenario = config.stepsNumber / config.scenarioNumber;
    const successScenario = Array.from({length: config.scenarioNumber - config.failedScenarioNumber}, () => {
        return {
            start_timestamp: "2020-07-12T13:24:12.754Z",
            before: [],
            after: [],
            steps: buildSteps(stepsByScenario, 0),
            type: 'scenario'
        } 
    });
    const failedScenario = Array.from({length: config.failedScenarioNumber}, () => {
        return {
            start_timestamp: "2020-07-12T13:24:12.754Z",
            before: [],
            after: [],
            steps: buildSteps(stepsByScenario, 1),
            type: 'scenario'
        }
    });
    const background = [];

    return {
        line: 1,
        elements: background.concat(successScenario, failedScenario),
        name: 'Fake',
        description: 'a fake',
        id: 'fake',
        keyword: 'Feature',
        uri: 'classpath:features/a_file.feature',
    }
}

function buildSteps(totalSteps, numberOfFailed) {
    const failed = Array.from({length: numberOfFailed}, () => {
        return {
            result: {
                status: "failed"
            }
        }
    });
    const succeed = Array.from({length: totalSteps - numberOfFailed}, () => {
        return {
            result: {
                status: "passed"
            }
        }
    });
    return failed.concat(succeed);
}