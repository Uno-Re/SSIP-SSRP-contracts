# Uno Re v2.1 [Relaunch version]

Full docs can be viewed here - https://unore.gitbook.io/uno-re/investor-app/v2-penta-launch-dapp

Previous version was audited multiple times and reports can be found here https://github.com/Uno-Re/audit-reports and https://sourcehat.com/audits/CoverPortal/

Post our security incident https://medium.com/@uno.reinsure/security-incident-post-mortem-report-and-the-road-ahead-acb38aaf3f11 we have decided to make some enhancements on our contracts to improve security and increase decentralization of control

# Changes in contracts 

## Capital Agent: 
This contract manages and store sales policy and SSIP-SSRP pools capital and utilised funds


## SingleSidedInsurancePool: 
In this pool staker stake funds to generate rewards, and policyholder claims its policy in this contract 


### UMA integration: 
User can claim its policy, by requesting to uma governance and dao can disputes this policy in uma, if policy is not rejected user can claim funds after delay 


#### flow:
- When comes for claim, it call requestPayout function in SSIP pool
    - Which creates assertionId corresponds to policyId
    - This assertionId will be used to dispute and settle policyId in UMA governance 
    - Set aliveness of assertionId in UMA, policy can not be settled if aliveness time is not passed 
- If policy is rejected by dao, than it can call disputeAssertion function of UMA to reject assertionId 
- After delay passed, user can settleAssertionId in UMA if there is not disputes than it will call assertionCallbackResolved function of SSIP to claim policy to user
- If there is a disputes in assertionId, it will not call assertionCallbackResolved function of SSIP

Issues: 
- Only claim accessor can claim policy and there was no checks to check if claiming amount is valid or not 


## SingleSidedRensurancePool: 
In this pool staker stake funds to generate rewards, and policyholder claims its policy in this contract 

Issues: 
- Only claim accessor can claim policy and there was no checks to check if claiming amount is valid or not 


## EscalatingManager: 
To check if assertion is valid or not at the time of asserTruth and to disputes assertion id, as these function are called by OptimisticOracleV3 


## Counters:
Used to increment index of policy id and fetch current policy id
As new package version of openzeppeline remove counter contract


## ExchangeAgent: 
Get oracle price feed data and used to convert currency amount for USDC and USDC to currency or token to token 


## PremiumPool: 
Collect premium from user into this address and check for available currency to collect premium


# Rewarder: 
This contract used to distribute rewards to stake holder of SSIP and SSRP pools 


## RiskPool:
when user leave and enter in pools riskPool ERC20 token burns into their address, this contract function can only be called by SSIP-SSRP pools


## SalesPolicy:
This contract provides a policy to the user to buy, and collect premium from the user. This policy is ERC721 token id which is burn and mint at the time of buy and sell policy 


## RiskPoolFactory:
Factory contract to create riskPool contract, call by SSIP and SSRP contract to create riskPool


## RewarderFactory:
Factory contract to create rewarder contract, call by SSIP and SSRP contract to distribute rewards token 


## SalesPolicyFactory:
Factory contract to create salesPolicy contract.


## SyntheticSSIPFactory:
Factory contract to create SyntheticSSIP contract, call by SSIP contract.


## SyntheticSSRPFactory:
Factory contract to create SyntheticSSRP contract, call by SSRP contract.


## Changes 

- update solidity version to 0.8.23
- make CapitalAgent, SSIP and SSRP contract upgradable
- use upgradable contracts
- make Counters contract as it is removed in new version
- add getPolicyInfo function in CapitalAgent, to fetch policy information
- add pausable and pool kill functionality in transfer of funds, when there is a hack in protocol governance can deprecate protocol functionality to stop funds flow to hacker and prevent from loss of funds  
    - add killPool and revivePool function
    - add pause and unpause function
    - add modifier to check pool alive or not
    In contracts: 
        - ExchangeAgent
        - PremiumPool
        - Rewarder
        - SalesPolicy
        - SSIP
        - SSRP
        - SyntheticSSIP and SyntheticSSRP
- SSIP changes
    - remove Ownable and use AccessControl as more than one role is required 
    - use admin role instead of owner
    - Make internal function to remove redundant code 
    - Policy struct to store policy details in pools 
    - requestPayout function to request policyId to uma governance 
    - assertionResolvedCallback function called by uma to claim funds to policy holder
- SSRP changes
    - remove Ownable and use AccessControl as more than one role is required 
    - use GUARDIAN_COUNCIL_ROLE to claim policy
    - use admin role instead of owner
    - pausable and kill pool functionality
    - add killPool and revivePool function
    - add pause and unpause function
    - add modifier to check pool alive or not
- Add enforceHasContractCode function in premium pool to check for address is contract or not as new version of openzeppeline remove isContract function from address.sol file 
- Add rollOverReward function to use user reward to stake instead of giving reward in contract if user wants to use reward token to stake: 
    - SSIP
    - SSRP 
    - SyntheticSSIP
    - SyntheticSSRP


## SSIP claim policy coverage splitting into different pools 

Previously claim accessor manually split coverage amount into differents pools and request for policy to claim in different pools. After intergration of UMA, user have to manually split coverage amount into different pools and claim for policy in different pools

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
