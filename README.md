## v2 Brainstorming Session 1st November 2021 - The Cover Portal
Main topic of discussion was to finalize the implementation logic for Cover Portal which will be utilized to faciltate the sales of insurance policies. There will be two categories of assets.

### contract deployment(bscTestnet):

#### SSIP USDC Pool:
- pool address: 0x402003901C87c73D85d8FCf4B98228d1B79faDca
- staking currency(USDC): 0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5
- reward currency(UNO): 0x41bA390295F266E38AB3C904D9cbeF5ad9F85424
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.165 <br/>

- LP token(RiskPool): 0xCeeDd150b9B09a865E21acA29DD5F329BaF9c49d
> name: Synthetic SSIP-USDC <br/>
> symbol: SSSIP-USDC <br/>

- Rewarder contract: 0x71Fdc22F7522D7a07d1509205df0DEec538180f2

#### Factories:
- RiskPoolFactory: 0xa9c48c93887CBAFB37bea7D87A2C201C22D435f2
- RewarderFactory: 0x7411F6c596A7E132ef008fe7f3f4dF73126E5C84

#### Common contracts:
- UNO : 0x41bA390295F266E38AB3C904D9cbeF5ad9F85424
- USDC : 0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5

- CapitalAgent: 0xC606C1c1d3d2aB9c16d911C6eA20C3A4B8d26149
> the current MCR: 50% <br/>
> the current MLR:  <br/>
- ExchangeAgent: 0x282193B0f3CF5AE0942cA439f1E302900465b4e9
- PremiumPool: 
- PriceOracle: 
- MultiSigWallet: 


## MockUNO faucet(bscTestnet):
https://testnet.bscscan.com/address/0x41bA390295F266E38AB3C904D9cbeF5ad9F85424#writeContract

total faucet Limit: 500000000 $UNO

## MockUSDC faucet(bscTestnet):
https://testnet.bscscan.com/address/0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5#writeContract

total faucet Limit: 500000000 $USDC

### contract deployment(bsc mainnet):

#### SSIP USDC Pool:
- pool address: 0xBD1105Ce524828f15d7da3CAF098c8E42D0Fbf31
- staking currency(USDC): 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d
- reward currency(UNO): 0x474021845c4643113458ea4414bdb7fb74a01a77
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.165 <br/>

- LP token(RiskPool): 0xFC9a02a13B19F65219034AB03ADcD8CAdf275f35
> name: Synthetic SSIP-USDC <br/>
> symbol: SSSIP-USDC <br/>

- Rewarder contract: 0xc8FFf74f9AB50B68a727bf2c35afe3A3970910D3

#### Factories:
- RiskPoolFactory: 0xc743508A6AD19c31Aff110778EFDE0867E4cEf08
- RewarderFactory: 0xA722FdFBbECdadB79aB27aAE388015dC4FACF6Ca

#### Common contracts:
- UNO : 0x474021845c4643113458ea4414bdb7fb74a01a77
- USDC : 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d

- CapitalAgent: 0x75298ca41f347Ab468f01BDdDA20057603b3AA4d
> the current MCR: 50% <br/>
> the current MLR:  <br/>
- ExchangeAgent: 0x87e1f628225c170a5C0Bf895580686430DEb3322
- PremiumPool: 
- PriceOracle: 
- MultiSigWallet: 


### Staking Pool with UNO block rewards : Yet to be Discussed
For of MasterChef v2 - @terry and @jonas please add your notes here

We would implement the accumulated summing idea of Sushi swap MasterChef in our Uno ReV2 contract.
In the Sushi MasterChef, it is the most fundamental and important that determines the accumulated reward token per share, which users get LP share by staking their funds in the pool.

we would replace this uno reward with accumulated amount per share of LP token and pending RewardDebt, the number of blocks between last reward block and current block, whenever a user submit a deposit or withdraw request.
For this, admin should set the uno reward multiplier per block when initialize reward contract

    Pending reward =  the rewardMultiplierPerBlock * (current block - lastRewardBlock).
        where the last reward block will be updated whenever the user deposits or withdrawals.

    accUnoPerSℎare(n+1) = accUnoPerSℎare(n)+ Pending reward / lpSupply

    where lpSupply means the total supply of Pool ERC20 token issued whenever users deposit. ie. it will be the total staked amount in the pool.

    In the case of deposit
        rewardDebt(n+1) =rewardDebt(n) + depositAmount ∗ accSusℎiPerSℎare(n+1) 

    In the case of  withdraw2
        rewardDebt(n+1) =rewardDebt(n) − witℎdrawAmount ∗ accSusℎiPerSℎare(n+1)

therefore,
 
    unoRewardAmount = stakedUnoAmountPerUser * accUnoPerShare - rewardDebtPerUser.

Note: accUnoPerShare and rewardDebt, lastRewardBlock will be updated whenever user deposit or withdraw.


## Capacity calculation and utilzation determination 

![Utilization and capacity determination](https://user-images.githubusercontent.com/64137744/138263657-0d2f810a-2ada-497c-bd50-1db8ecd451f7.png)


MCR will be a changeable variable, adjusted by UNO according the Uno price and other variable parameters.

## Withdrawal process

Unstaking of funds will be entertained on a first come first serve basis. 

When a user requests for unstaking his funds, there is one condition :  

![Withdrawal amount condition for Cohort 2](https://user-images.githubusercontent.com/64137744/138264415-e481b6eb-5b62-4525-af28-0a4bdd235550.png)


If the above condition is met, the withdrawl request will be accepted automatically onchain. After the withdrawl request is accepted the user will be able to transfer his funds back to his wallet exactly after 10 days.

## Claims management

Each and every user's funds in the pool will the susceptible to utilization for claims management. 

Note : When a user's withdrawl request has been accepted and 10 days have not passed since. His funds will still be suseptible for utilization to settle claims. After 10 days has passed he can then call the "claim" function, which will enable him to transfer back his funds to his wallet. 

## Reward distribution 

![Rewards formula](https://user-images.githubusercontent.com/64137744/138268622-b13293d5-be01-485b-90dd-52c5c0f13c0a.png)


