Feature: Test file 

    @SuccessTest
    Scenario: Scenario OK
        When this step will success


    Scenario: Scenario KO
        When this step will fail

    @SuccessTest
    @UndefinedStepTest
    Scenario: Scenario with undefined step
        When this step is undefined
