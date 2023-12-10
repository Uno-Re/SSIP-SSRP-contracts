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

## Contracts in scope (commit: 5a95f1f209638a3246bbfa49b6c964509395253a)

| Type | File   | Logic Contracts | Interfaces | Lines | nLines | nSLOC | Comment Lines | Complex. Score | Capabilities |
| ---- | ------ | --------------- | ---------- | ----- | ------ | ----- | ------------- | -------------- | ------------ | 
| 📝 | ./contracts/EIP712MetaTransaction.sol | 1 | **** | 93 | 81 | 60 | 8 | 59 | **<abbr title='Uses Assembly'>🖥</abbr><abbr title='Payable Functions'>💰</abbr><abbr title='Uses Hash-Functions'>🧮</abbr><abbr title='Handles Signatures: ecrecover'>🔖</abbr>** |
| 📝 | ./contracts/factories/SyntheticSSRPFactory.sol | 1 | **** | 15 | 15 | 11 | 1 | 17 | **<abbr title='create/create2'>🌀</abbr>** |
| 📝 | ./contracts/factories/SalesPolicyFactory.sol | 1 | **** | 144 | 140 | 107 | 7 | 122 | **<abbr title='create/create2'>🌀</abbr>** |
| 📝 | ./contracts/factories/RiskPoolFactory.sol | 1 | **** | 21 | 16 | 11 | 1 | 17 | **<abbr title='create/create2'>🌀</abbr>** |
| 📝 | ./contracts/factories/RewarderFactory.sol | 1 | **** | 16 | 16 | 11 | 1 | 17 | **<abbr title='create/create2'>🌀</abbr>** |
| 📝 | ./contracts/factories/SyntheticSSIPFactory.sol | 1 | **** | 15 | 15 | 11 | 1 | 17 | **<abbr title='create/create2'>🌀</abbr>** |
| 📝 | ./contracts/RiskPoolERC20.sol | 1 | **** | 350 | 350 | 125 | 185 | 90 | **** |
| 📝 | ./contracts/SingleSidedReinsurancePool.sol | 1 | **** | 385 | 377 | 301 | 18 | 300 | **<abbr title='Uses Hash-Functions'>🧮</abbr>** |
| 📚 | ./contracts/libraries/Counters.sol | 1 | **** | 25 | 25 | 10 | 14 | 1 | **<abbr title='doppelganger(Counters)'>🔆</abbr>** |
| 📝 | ./contracts/libraries/EIP712Base.sol | 1 | **** | 49 | 49 | 34 | 8 | 23 | **<abbr title='Uses Assembly'>🖥</abbr><abbr title='Uses Hash-Functions'>🧮</abbr>** |
| 📚 | ./contracts/libraries/TransferHelper.sol | 1 | **** | 28 | 28 | 19 | 5 | 26 | **** |
| 📚 | ./contracts/libraries/AncillaryData.sol | 1 | **** | 143 | 131 | 65 | 55 | 41 | **<abbr title='Unchecked Blocks'>Σ</abbr>** |
| 📝 | ./contracts/libraries/MultiSigWallet.sol | 1 | **** | 151 | 146 | 100 | 9 | 73 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝 | ./contracts/ExchangeAgent.sol | 1 | **** | 268 | 242 | 207 | 7 | 183 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝 | ./contracts/SingleSidedInsurancePool.sol | 1 | **** | 530 | 521 | 416 | 29 | 380 | **<abbr title='Payable Functions'>💰</abbr><abbr title='Uses Hash-Functions'>🧮</abbr>** |
| 📝 | ./contracts/CapitalAgent.sol | 1 | **** | 309 | 303 | 253 | 1 | 226 | **** |
| 📝 | ./contracts/uma/EscalationManager.sol | 1 | **** | 77 | 69 | 47 | 5 | 45 | **<abbr title='Uses Hash-Functions'>🧮</abbr>** |
|  | ./contracts/uma/ClaimData.sol | **** | **** | 4 | 4 | 2 | 1 | **** | **** |
| 📝 | ./contracts/RiskPool.sol | 1 | **** | 222 | 222 | 192 | 10 | 177 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝 | ./contracts/SyntheticSSIP.sol | 1 | **** | 262 | 262 | 206 | 9 | 168 | **** |
| 📝🔍 | ./contracts/Rewarder.sol | 1 | 1 | 131 | 124 | 103 | 1 | 111 | **<abbr title='Payable Functions'>💰</abbr>** |
| 📝 | ./contracts/SyntheticSSRP.sol | 1 | **** | 262 | 262 | 206 | 9 | 168 | **** |
| 📝 | ./contracts/SalesPolicy.sol | 1 | **** | 330 | 291 | 248 | 5 | 183 | **<abbr title='Payable Functions'>💰</abbr><abbr title='Uses Hash-Functions'>🧮</abbr><abbr title='Handles Signatures: ecrecover'>🔖</abbr>** |
| 📝 | ./contracts/PremiumPool.sol | 1 | **** | 272 | 265 | 230 | 7 | 229 | **<abbr title='Uses Assembly'>🖥</abbr><abbr title='Payable Functions'>💰</abbr>** |
| 📝📚🔍 | **Totals** | **23** | **1** | **4102**  | **3954** | **2975** | **397** | **2673** | **<abbr title='Uses Assembly'>🖥</abbr><abbr title='Payable Functions'>💰</abbr><abbr title='Uses Hash-Functions'>🧮</abbr><abbr title='Handles Signatures: ecrecover'>🔖</abbr><abbr title='create/create2'>🌀</abbr><abbr title='doppelganger'>🔆</abbr><abbr title='Unchecked Blocks'>Σ</abbr>** |
