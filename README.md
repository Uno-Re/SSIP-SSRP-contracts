## v2 Brainstorming Session 28th January 2022 - The Cover Portal
Main topic of discussion was to finalize the implementation logic for Cover Portal which will be utilized to faciltate the sales of insurance policies. There will be two categories of assets.

### contract deployment(rinkeby):

#### SSRP:
- pool address: 0xD9f69b8d50295119b002ecE30ec2C87cA33Ed565
- staking currency(UNO): 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5(Mock UNO)
- reward currency(UNO): 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5(Mock UNO)

- LP token(RiskPool): 0xAC51a8F0dc7151D0A18AF23C2FFD4c2dAa9DdEAa
> name: Synthetic SSRP <br/>
> symbol: SSSRP <br/>

- Rewarder contract: 0x8B2E925d4D1CF2C32E85b850b1228001128A75d0

#### Synthetic SSRP
- pool address: 0x472E56df028928cB28042229D329FF399dAF5d10
- staking currency(SSRP LP token): 0xAC51a8F0dc7151D0A18AF23C2FFD4c2dAa9DdEAa
- reward currency(USDC): 0x40c035016AD732b6cFce34c3F881040B6C6cf71E(Mock USDT)
> it will be changed to USDC in the future on mainnet. <br/>

-Rewarder contract: 0x36BEA8AD62B292E76b11f8D5f40Fc90daa46aB61

#### Selene - SSIP ETH Pool:
- pool address: 0x1184c182d5411021f40f693420bA6DDd40E7685e
- staking currency(ETH): 0x0000000000000000000000000000000000000000
- reward currency(UNO): 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5(Mock UNO)
> the current SCR: 15000 USDC <br/>
> the current rewardPerBlock: 0.000000625 <br/>

- LP token(RiskPool): 0x23A7D6A0d9D033353225b4D1b3C7E91cc8e746e0
> name: Synthetic SSIP-ETH <br/>
> symbol: SSSIP-ETH <br/>

- Rewarder contract: 0x4b2D6F15680b71dC2f43e4ffAF5b20492d8079ea

#### Ares - SSIP UNO Pool:
- pool address: 0xDcB84407FD1b8f96489C519d49093A504144C792
- staking currency(UNO): 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5(Mock UNO)
- reward currency(UNO): 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5(Mock UNO)
> the current SCR: 15000 USDC <br/>
> the current rewardPerBlock: 0.0049 <br/>

- LP token(RiskPool): 0x02161410F5594FbD0f73070eD16c4fDD2d84A956
> name: Synthetic SSIP-UNO <br/>
> symbol: SSSIP-UNO <br/>

- Rewarder contract: 0xCfD3E59E5c71A3Fe78BbA4F6D8E7e6Af3d3298c5

#### SSIP USDC Pool:
- pool address: 0x7ee58dc800AE61DF5bCF8FdcEc0D86A6e33036A2
- staking currency(UNO): 0x68C34F54E63664019f59029b9dE344d6219C7758(Mock USDC)
- reward currency(UNO): 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5(Mock UNO)
> the current SCR: 15000 USDC <br/>
> the current rewardPerBlock: 0.00317 <br/>

- LP token(RiskPool): 0x43214aCd27f57B3f8Cef8f962a48056BfbFF01b3
> name: Synthetic SSIP-USDC <br/>
> symbol: SSSIP-USDC <br/>

- Rewarder contract: 0x85d9dBd959Cd180eE44135404625D2acB837d9f3

#### SSIP USDT Pool:
- pool address: 0x3442a97F780769Ff028e4b491EfAA7ca277cEbD4
- staking currency(UNO): 0x40c035016AD732b6cFce34c3F881040B6C6cf71E(Mock USDT)
- reward currency(UNO): 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5(Mock UNO)
> the current SCR: 15000 USDC <br/>
> the current rewardPerBlock: 0.00317 <br/>

- LP token(RiskPool): 0x2bCFa6eE63446452a25E7CEa1Bf3ed1f2D09DB3F
> name: Synthetic SSIP-USDT <br/>
> symbol: SSSIP-USDT <br/>

- Rewarder contract: 0x73e095b80c99221f6eB03DBBD29D857146BE8976

#### Policy Insurance:
- SalesPolicyFactory: 0x2aB01080Db09E8DD6BDaC80745b2Dce7eF55DfBd
- SalesPolicy: 0x9688bEc05126BacE0D67136C7fcC8c20F2299dC0

#### Factories:
- RiskPoolFactory: 0x02CC7B5720FF5b17dB2A30cEa5dfC4a866dc4AE8
- RewarderFactory: 0x566D59b2333df7272BF6CA04aE81045C41828F16

#### Common contracts:
- MockUNO : 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5
- MockUSDT : 0x40c035016AD732b6cFce34c3F881040B6C6cf71E
- MockUSDC : 0x68C34F54E63664019f59029b9dE344d6219C7758
- MockDAI : 0x97bA5a3fBc887c764f321a2d1d4322750D2e156d

- MultiSigWallet: 0x53819C211EC8FFD5885C301EfAa75E420b3c5Fbe
- CapitalAgent: 0xD96f02DC7090e2c143463188F72C6465a61271E9
> the current MCR: 50% <br/>
> the current MLR: 200% <br/>
- ExchangeAgent: 0xE67fC73b8E7099F29b37347Ac2fAB5acd20C1d1F
- PremiumPool: 0xC5425D69ac87e52812AF0F90953d0D3d644eb94D

- Migration: 0x966D9Ea65e33Ff5F857b457329CdFe9dfaC33738

#### uniswap pair
- MockUSDT/MockUNO: 0x6170d27C5A7B76F13882B70Ef7A919051E1E0f2b
- MockUNO/MockUSDC: 0x8645fa06Fa88a1C6DB8eF607b9D1AAb5719E26eA
- MockUNO/MockDAI: 0x4e89F04E8fE4C0F445C8B5aeE6A3eFAd3F49A518
- MockUNO/WETH: 0x37A3f9Ebb46d6cafAcBc75873E6caC103ef586a3
- MockUSDT/WETH: 0x24550BF450aE07b97CC2905395fc5d1b7E45E682
- MockUSDC/WETH: 0xB8D6a2527862E223c5b763C9db3D2B9485259aba
- MockDAI/WETH: 0x359d9e00E2548a7eB9baE41D66bD911214947102



### MockUNO faucet:
https://rinkeby.etherscan.io/address/0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5#writeContract

total faucet Limit: 500000000 $UNO

- AirdropMockUNO: 0x0A47304bF71c086b8d97C6eE079b7795c8253E17

### Formula for checking withdrawable by MCR, SCR in SSIPs throught CapitalAgent:
```sh
 totalCapitalStaked - withdrawRequestAmount >= (totalCapitalStaked * MCR) / CALC_PRECISION
```
> where totalCapitalStaked is the sum(in USDC) of amounts staked in all SSIPs.
> CALC_PRECISION = 1e18
```sh
 totalCapital of the pool - withdrawRequestAmount >= SCR of the pool
```


### Formula for policy purchasing available by MLR in SSIPs throught CapitalAgent:
```sh
 totalUtilizedCapacity + coverageAmount <= (totalCapitalStaked * MLR) / CALC_PRECISION
```
> where totalUtilizedCapacity is the total coverage amount of the policies being insured by our project.
>   totalCapitalStaked is the sum(in USDC) of amounts staked in all SSIPs.
>   CALC_PRECISION = 1e18

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


