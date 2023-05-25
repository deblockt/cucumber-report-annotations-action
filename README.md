# cucumber-report-annotations-action

This action should be used to publish action annotations from cucumber json report.

## Example

``` yml
- uses: deblockt/cucumber-report-annotations-action@v1.7
  with:
    access-token: ${{ secrets.GITHUB_TOKEN }}
    path: "**/cucumber-report.json"
```

![demo](doc/demo.png)

## Parameters

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

## Granting Permissions for Annotation Editing

To enable your GitHub Actions workflow to edit annotations, you need to add the necessary permission in your YAML file. Follow the steps below to ensure the required permission is included:

1. Locate the jobs section, where your workflow steps are defined.
2. Within the jobs section, find the specific job where you want to grant annotation editing permissions. This is typically the job responsible for running tests or performing other actions.
3. Add the permissions section under the chosen job, specifying the checks: write permission. The modified snippet should look like this:

```
jobs:
  build:
    permissions:
      checks: write
```

By including the permissions section with the checks: write setting, you grant your workflow the necessary permission to edit annotations for the associated check runs. This ensures that your workflow can update annotations with relevant information and provide insights within the GitHub interface.

