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