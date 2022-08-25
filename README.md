# cucumber-report-annotations-action

This action should be used to publish action annotations from cucumber json report.

## Exemple

``` yml
- uses: deblockt/cucumber-report-annotations-action@v1.7
  with:
    access-token: ${{ secrets.GITHUB_TOKEN }}
    path: "**/cucumber-report.json"
```

![demo](doc/demo.png)

## parameters

- **access-token**: mandatory parameter. It's the github token to allow action to add check
- **name** (optional, default: Cucumber report): the check name.
- **path** (optional, default: **/cucumber-report.json): the glob path to get cucumber report on json format
- **check-status-on-error** (optional, default: failure): the check status to use on cucumber error. Can be 'neutral' or 'failure'
- **check-status-on-undefined** (optional, default: success): the check status to use on cucumber undefined steps. Can be 'success', 'neutral' or 'failure'
- **check-status-on-pending** (optional, default: success): the check status to use on cucumber pending steps. Can be 'success', 'neutral' or 'failure'
- **annotation-status-on-error** (optional, default: failure): the annotation status on error. Can be 'notice', 'warning', 'failure'
- **annotation-status-on-undefined** (optional): the annotation status on undefined steps. Can be 'notice', 'warning', 'failure'. if this property is not set, no annotation will be generated for undefined steps
- **annotation-status-on-pending** (optional): the annotation status on pending steps. Can be 'notice', 'warning', 'failure'. if this property is not set, no annotation will be generated for pending steps
- **number-of-test-error-to-fail-job** (optional): indicate the number of test in error to fail the build. If the value is -1 this action will never fail the build. By default, this action will not cause the build to fail.