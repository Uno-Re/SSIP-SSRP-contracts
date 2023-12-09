# Uno Re v2.1 [Relaunch version]

Full docs can be viewed here - https://unore.gitbook.io/uno-re/investor-app/v2-penta-launch-dapp

Previous version was audited multiple times and reports can be found here https://github.com/Uno-Re/audit-reports and https://sourcehat.com/audits/CoverPortal/

Post our security incident https://medium.com/@uno.reinsure/security-incident-post-mortem-report-and-the-road-ahead-acb38aaf3f11 we have decided to make some enhancements on our contracts to improve security and increase decentralization of control

## Changelog in new Contracts:

Update the Solidity version to 0.8.23.
Make CapitalAgent, SSIP, and SSRP contracts upgradable.
Deploy upgradable contracts.
Modify the Counters contract as it's removed in the new version.
Add a getPolicyInfo function in CapitalAgent to fetch policy information.

Incorporate pausable and pool kill functionality in the transfer of funds for the following:
    ExchangeAgent
    PremiumPool
    Rewarder
    SalesPolicy
    SSIP
    SSRP
    SyntheticSSIP and SyntheticSSRP

Changes in SSIP:
    Add a PolicyInfo struct to store policy-approved delay information.
    Remove Ownable and use AccessControl.
    Add policy approval function; use the CLAIM_ACCESSOR_ROLE to approve the policy.
    Add policy rejection function; use the GAURDIAN_COUNCIL_ROLE to reject the policy.
    Use the guardian council to claim policy.
    Add delay in policy claim.

New changes in SSIP and SSRP:
    Governance mechanics, similar to Aave governance V2
    Kill switch, which will be only accessible to Unore mutlisig
    Contracts upgradable, accessible by governance
    Pausable contracts, accessible by Unore multisig
    UMA integration for request-reject-settle policy claim
    Auto compounding on Risk pool which has same deposit and reward tokens
    Testing of all the implementation and features
