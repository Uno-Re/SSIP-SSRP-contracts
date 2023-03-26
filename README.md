## v2 Brainstorming Session 1st November 2021 - The Cover Portal
Main topic of discussion was to finalize the implementation logic for Cover Portal which will be utilized to faciltate the sales of insurance policies. There will be two categories of assets.

### contract deployment(bscTestnet):

#### Zeus(v2) - SSIP USDC Pool:
- pool address: 0x402003901C87c73D85d8FCf4B98228d1B79faDca
- staking currency(USDC): 0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5
- reward currency(UNO): 0x41bA390295F266E38AB3C904D9cbeF5ad9F85424
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.165 <br/>

- LP token(RiskPool): 0xCeeDd150b9B09a865E21acA29DD5F329BaF9c49d
> name: Synthetic SSIP-USDC <br/>
> symbol: SSSIP-USDC <br/>

- Rewarder contract: 0x71Fdc22F7522D7a07d1509205df0DEec538180f2

#### Ares BSC - SSIP UNO Pool:
- pool address: 0x6C91Cde8D17D4a5FA49d4CD5DbFDF9490259B234
- staking currency(UNO): 0x41bA390295F266E38AB3C904D9cbeF5ad9F85424
- reward currency(UNO): 0x41bA390295F266E38AB3C904D9cbeF5ad9F85424
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.095129375951293759 <br/>

- LP token(RiskPool): 0xC44EAc8E7808d5e173E8811625dfE687dB64baA2
> name: Synthetic SSIP-UNO <br/>
> symbol: SSSIP-UNO <br/>

- Rewarder contract: 0xe2D9a972AdFcfBC4629910469C3917aAe8805Afa

#### Thanatos - SSIP HORDE Pool:
- pool address: 0xc75e610A640c88F6cd183247DB469Ee938C209D5
- staking currency(HORDE): 0x199c66ab7273Fa711F5CCe0fbd92f3Ff4a1f2939
- reward currency(UNO): 0x41bA390295F266E38AB3C904D9cbeF5ad9F85424
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.142987451863791467 <br/>

- LP token(RiskPool): 0x901FD16932F009c4c26517f51ff9E10E8c877a79
> name: Synthetic SSIP-HORDE <br/>
> symbol: SSSIP-HORDE <br/>

- Rewarder contract: 0x36137dADD65abA3747f8FE82A1E98F8f770E03b2

#### Factories:
- RiskPoolFactory: 0xa9c48c93887CBAFB37bea7D87A2C201C22D435f2
- RewarderFactory: 0x7411F6c596A7E132ef008fe7f3f4dF73126E5C84

#### Common contracts:
- UNO : 0x41bA390295F266E38AB3C904D9cbeF5ad9F85424
- USDC : 0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5
- HORDE: 0x199c66ab7273Fa711F5CCe0fbd92f3Ff4a1f2939

- CapitalAgent: 0xb2B62606f3f855C03C1baeed7ae3B3a91B64633B
> the current MCR: 50% <br/>
> the current MLR:  <br/>
- ExchangeAgent: 0x282193B0f3CF5AE0942cA439f1E302900465b4e9
- PremiumPool: 
- PriceOracle: 0x6e01a9Da1A531B947ffab813cC9402fB1f79aFe6
- MultiSigWallet: 


### MockUNO faucet(bscTestnet):
https://testnet.bscscan.com/address/0x41bA390295F266E38AB3C904D9cbeF5ad9F85424#writeContract

total faucet Limit: 500000000 $UNO

### MockUSDC faucet(bscTestnet):
https://testnet.bscscan.com/address/0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5#writeContract

total faucet Limit: 500000000 $USDC

### MockHORDE faucet(bscTestnet):
https://testnet.bscscan.com/address/0x199c66ab7273Fa711F5CCe0fbd92f3Ff4a1f2939#writeContract

total faucet Limit: 500000000 $USDC

## contract deployment(bsc mainnet):

#### Zeus v2 - SSIP USDC Pool:
- pool address: 0xBD1105Ce524828f15d7da3CAF098c8E42D0Fbf31
- staking currency(USDC): 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d
- reward currency(UNO): 0x474021845c4643113458ea4414bdb7fb74a01a77
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.165 <br/>

- LP token(RiskPool): 0xFC9a02a13B19F65219034AB03ADcD8CAdf275f35
> name: Synthetic SSIP-USDC <br/>
> symbol: SSSIP-USDC <br/>

- Old Rewarder contract: 0xc8FFf74f9AB50B68a727bf2c35afe3A3970910D3
- Old Rewarder contract 2: 0x99a428Deb40b470FDB35CbcaDbf50cCa878f37ce
- New Rewarder contract: 0x5D75249C121681578a8c387AfFd196A31Ae15c46

#### Ares - SSIP UNO Pool:
- pool address: 0xbb5fe2d69694b44a64151eaF07199eF8420685dD
- staking currency(UNO): 0x474021845c4643113458ea4414bdb7fb74a01a77
- reward currency(UNO): 0x474021845c4643113458ea4414bdb7fb74a01a77
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.443937087772704211 UNO <br/>

- LP token(RiskPool): 0x456d60a7E2a2DA97BDb43759Cf63f7acbC3a700a
> name: Synthetic SSIP-UNO <br/>
> symbol: SSSIP-UNO <br/>

- Old Rewarder contract: 0x9b9fa4bE1c98F5E9A8e774619b2e7056aF48384e
- Old Rewarder contract 2: 0x2dc1537BFadDc176076cC188426AEC86aE7Af797
- New Rewarder contract: 0xf7FF16fdcA5e05fEB8D1609B2b303d5ee1A888c6

#### Factories:
- RiskPoolFactory: 0xc743508A6AD19c31Aff110778EFDE0867E4cEf08
- Old RewarderFactory: 0xA722FdFBbECdadB79aB27aAE388015dC4FACF6Ca
- Old RewarderFactory 2: 0x7d9fEaBfB9c15770eAEcEbC12cc8a339b9086eE4
- New RewarderFactory: 0x3ce9453EE47cf809de920884923C392e0fb84e99

#### Common contracts:
- UNO : 0x474021845c4643113458ea4414bdb7fb74a01a77
- USDC : 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d

- CapitalAgent: 0x62e1D28f3204962852976983cD575Fc2741bfE19
> the current MCR: 50% <br/>
> the current MLR:  <br/>
- ExchangeAgent: 0x87e1f628225c170a5C0Bf895580686430DEb3322
- PremiumPool: 
- PriceOracle: 0xE795C2118b02d468Ed2215CEc44cae4CB63F9E83
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


