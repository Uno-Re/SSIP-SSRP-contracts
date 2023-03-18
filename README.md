## v2 Brainstorming Session 1st November 2021 - The Cover Portal
Main topic of discussion was to finalize the implementation logic for Cover Portal which will be utilized to faciltate the sales of insurance policies. There will be two categories of assets.

### contract deployment(mainnet):

#### SSRP:
- pool address: 0x87e1f628225c170a5C0Bf895580686430DEb3322
- staking currency(UNO): 0x474021845C4643113458ea4414bdb7fB74A01A77
- reward currency(UNO): 0x474021845C4643113458ea4414bdb7fB74A01A77

- LP token(RiskPool): 0x1eECc8C8298ed9Bd46c147D44E2D7A7BfACE2034
> name: Synthetic SSRP <br/>
> symbol: SSSRP <br/>

- Rewarder contract: 0x629D346448086ECCC6bD19EcA617074a2dF5b365
- New Rewarder contract: 0xDAbbF682F09D2A01C34021EFE690A5ae2582a11e

#### Selene - SSIP ETH Pool:
- pool address: 0x1342b3dAec4f54F5Af01Aaa34839626f959B362a
- staking currency(ETH): 0x0000000000000000000000000000000000000000
- reward currency(UNO): 0x474021845C4643113458ea4414bdb7fB74A01A77
> the current SCR: 200K USDC <br/>
> the current rewardPerBlock: 0.05749417402375796 UNO <br/>

- LP token(RiskPool): 0x29B4b8674D93b36Bf651d0b86A8e5bE3c378aCF4
> name: Synthetic SSIP-ETH <br/>
> symbol: SSSIP-ETH <br/>

- Rewarder contract: 0xAeFEAB8f99b7705D11A94fc823908103cCADA92a
- New Rewarder contract: 0xd3D3aED42f7F293A6D6e45F9a697BffC12Df7353

#### Ares - SSIP UNO Pool:
- pool address: 0x82E107d2b1Be4347b55FBba4a6fB99669dF3ceb1
- staking currency(UNO): 0x474021845C4643113458ea4414bdb7fB74A01A77
- reward currency(UNO): 0x474021845C4643113458ea4414bdb7fB74A01A77
> the current SCR: 200K USDC <br/>
> the current rewardPerBlock: 0.095129375951293759 <br/>

- LP token(RiskPool): 0xbd3E70819A8Add92B06d6d92A06DcdA9249DF2a3
> name: Synthetic SSIP-UNO <br/>
> symbol: SSSIP-UNO <br/>

- Rewarder contract: 0xE5290071A40F8c724105a3f78036A0EA6b6F3CC3
- New Rewarder contract: 0x147Fdb7DA91cf4BD2054B60cBfC9Ce029aD32a5f

#### Hercules - SSIP USDT Pool:
- pool address: 0xa476b3F7333796D4565a3D3666D54cF8557F0169
- staking currency(USDT): 0xdAC17F958D2ee523a2206206994597C13D831ec7
- reward currency(UNO): 0x474021845C4643113458ea4414bdb7fB74A01A77
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.165 <br/>

- LP token(RiskPool): 0x920D510D5c70C01989b66f4e24687Dddb988DdAe
> name: Synthetic SSIP-USDT <br/>
> symbol: SSSIP-USDT <br/>

- Rewarder contract: 0x0451863C4dc8480D95E9Fb87D73D4f427A671eB6
- New Rewarder contract: 0x18336855F302C2e8A30F72A89EdF62b8241f605d

#### Aphrodite - SSIP USDC Pool:
- pool address: 0x72D1B61B1723900f64d041a80fe4f114d3F0942a
- staking currency(USDC): 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- reward currency(UNO): 0x474021845C4643113458ea4414bdb7fB74A01A77
> the current SCR: 10K USDC <br/>
> the current rewardPerBlock: 0.165 <br/>

- LP token(RiskPool): 0xfdfAA453eF3709D2c26EcF43786a14Ab8bF27E36
> name: Synthetic SSIP-USDC <br/>
> symbol: SSSIP-USDC <br/>

- Rewarder contract: 0xFf0898C3C90c35DBb8A9c64F63f4d9c16C81a479
- New Rewarder contract: 0x7A24B6f16B19496127d859Fe94f1A8746D6c7Aa9

#### Policy Insurance:
- SalesPolicyFactory: 0xbb5fe2d69694b44a64151eaF07199eF8420685dD
- SalesPolicy: 0xdD2715Ec8C6D96E3064063842C47413782C4F66b

#### Factories:
- RiskPoolFactory: 0x60D00f3eb762AB197E6909da4a93aa2F53F041B4(old)
- RiskPoolFactory: 0xe3Ffa053ae0d84280f01901e2d7813d7523CfCf6(new)
- RewarderFactory: 0x87205a4d46D1Cd0b90fe04Aa8FE66F4c28842148
- New RewarderFactory: 0xcdB18293E0738cffFc7EA37072311e22fEeBb7c3

#### Common contracts:
- UNO : 0x474021845C4643113458ea4414bdb7fB74A01A77
- USDC : 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
- USDT : 0xdAC17F958D2ee523a2206206994597C13D831ec7

- CapitalAgent: 0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05
> the current MCR: 50% <br/>
> the current MLR: 400% <br/>
- ExchangeAgent: 0x0b0D83702acbD625aDD45c79c7307C08eecEff4B
- PremiumPool: 0xdB4B701f1a4653BFD5F0f4EFF1913aEAF5E21E68
- PriceOracle: 0x3Ba0A22c1f4FdD2eB5fD84F560efAE19B7bF6aDB
- MultiSigWallet: 


## MockUNO faucet(rinkeby):
https://rinkeby.etherscan.io/address/0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5#writeContract

total faucet Limit: 500000000 $UNO

- AirdropMockUNO: 0x0A47304bF71c086b8d97C6eE079b7795c8253E17

### Frontend Pages:
1. @wang - Homescreen: 
Add a search bar to search for protocols which user wants insurance cover for (integrate with coingecko)
Show a Generic List of Protocols (Fetch from Coingecko)

2. Once user selects the protocol, show a loading screen and behind the scenes it will be: 
a. checking for insurance availablity - basic filters like protocol trading for atleast a month, minimum no. of holders, all update token information, daily trading volume.
b. Check if the ERC20 token address of the protocol is listed on the DEX'es we have integrated with on our smart contracts (more about this in next sect.)
b. Running premium factor calculation

@adityavyas and @daskh - For premium Factor calculation we will be building a ML Classification model (use BigML). Data set used will be protocols covered by all existing insruance protocols and token and protocol data available on coingecko. Check to see if there are factors which can determine premium of the protocol depending on certain factors with high enough confidence levels.

3. Insurance Purchase Page:
Ask the user to enter the USD equivalent of assets they want to cover in that particular protocol and select the duration they want the cover for.
Calculate premium using the previously calculated premium factor (using ML model) and show it to the user.
Possible Attach vector - how do we ensure that users are not able to buy insurance cover for a protocol X with a wrong premium factor? Should we calculate premium factor onchain or any other alternate way?

4. My Policies Page: 
List of all the insurance policies purchased by the user and allow user to renew / submit claim for that insurance policy

5. UNO Staking Pool Page: TODO

### Premium Tokens will be Swapped:
Once the premium is submitted to the smart contract (we need to pass the ERC20 token contract address as well) so that the token can be detected and can be swapped into a stablecoin / UNO (decision to be made by Jas / Sujith) + a particular amount will be burnt. 
@daksh - make a list of top 5 DEX's and check if we can integrate with them using an interface in solidity.

-Uniswap V3 
-Uniswap V2
-Sushiswap 

### Detecting Insureable Assets: Yet to be Discussed
Detects tokens available in User's wallet and shows the name of the protocol as well as the total asset worth (Use moralis API for this)
Detects Smart Contract addresses the user has interacted with and allow user to purchase Insurance Cover for the same. The Cover ram - 

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

### Staking Pool with Premium rewards : Yet to be Discussed
@terry MS teams message

### Claims Process (onchain and offchain) : Yet to be Discussed


# ------- OLD UPDATES ------- 

## Overview of the Goals for v2:
- Create a dynamic insurance product that insures any protocol instantly
- Allow on-the-go withdrawal and deposits for the pools
- Allow dyanmically changing size of pools/risk capacity
- Collecting premiums in the native tokens of the protocol being insured and distributing it to all the stakers,
- Providing multiple rewards + UNO rewards
- Allow investments in UNO

## How the pool will work
Uno Re will allow any user to come into the platform and connect their wallet.

Step 1 : As soon as wallet is connected, Uno Re backend will retrieve data on all the ERC20 transfers made by that user. It will filter all the transaction which are interacting with a smart contract (staking pools). It will further calculate the net stake of the user in each smart contract.
(Front end process)

Todo : fluz research

Step 2 : After listing all the smart contracts, Uno will then run analysis on each smart contract interms of :
(Front end process)

- Daily activity in that smart contract
- No. of fund holders in that smart contratc
- No. of tokens deposited in that smart contract.
- Uno will also run a uniswap TWAP price feed api to get the price of the token to convert all the values into USD terms


Step 3 : Uno will rate all the smart contracts/staking pool according to the above mentioned parameters and send the user with the list of staking pools that Uno can insure with their respective risk score (calculated by UNO)
(Front end process)

Step 4 : Uno will calcualte the %COC - Cost of Cover for user's funds in each smart contract.
(Front end process)

## Uno Re analysis on the token (front end process)
Uno Re will use etherscan apis to get the past ERC 20 transaction of the user

Uno Re backend will then filter and calculate the amount of staked tokens of each user for each ERC 20 token in each pool.

## Price determination of the token (front end process)

When purchasing insurance, user will be asked to input the USD value of the amount he wants to cover. 

Example : Suppose if user wants to purchase cover for his $HAKA on the TribeOne staking pool, he will be asked to provide how much $USD worth of coverage he wants on his funds.

Note : This process may lead to the user to either over-insure or under-insure his funds, this will be settled during claims management.

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


## Premium Calculation (front end process)

When the user inputs the token and the particular staking pool that he wants to cover. The backend will calculate the token risk score the staking pool risk score

Token can be put into any of these category : 
- Very Big
- Big
- Medium 
- Small

Staking pool can be put into any of these category : 
- Big
- Medium 
- Small

Combined with the Token category, staking pool category and the utilization rate of the Uno pool the COC% will be calculated

## What is COC%
Coc% = Cost of Cover

Premium to be paid by user = (Amount user wants to insure)*COC

Reward Calculation and Disbursement:
There will be one single pool, users will recieve rewards linearly on a perblock basis. The rewards will be in form of the premium paid by the users + UNO rewards.


