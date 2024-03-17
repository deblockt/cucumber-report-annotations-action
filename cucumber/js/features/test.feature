Feature: Test file 

    @NonFailedTest
    @SuccessTest
    Scenario: Scenario OK
        When this step will success


    Scenario: Scenario KO
        When this step will fail

    @SuccessTest
    @NonFailedTest
    @UndefinedStepTest
    Scenario: Scenario with undefined step
        Given this step will success
        When this step is undefined

    @NonFailedTest
    Scenario: Scenario with pending step
        When this step is pending

    Scenario Outline: Scenario with Outline
        Given this step will success using example <variable>
    Examples: 
        | variable |
        | tets     |
        | test2    |