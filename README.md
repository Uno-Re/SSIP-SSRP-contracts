## v2 Brainstorming Session 1st November 2021 - The Cover Portal
Main topic of discussion was to finalize the implementation logic for Cover Portal which will be utilized to faciltate the sales of insurance policies. There will be two categories of assets.

### contract deployment(rinkeby):
- SingleSidedReinsurancePool(SSRP) : 0xaCDbbF853Fd5a2b3410b92F36c60A7F0d283fcdB

- SSRP RiskPool(SSRP LP token): 0xB4Cc174B009d8780Df702afB9AaCACD970C4463f
- SSRP Rewarder: 0x207e0F0fAc90a690bf23b14B7520d9d7d1F95dE2
- SyntheticSSRP: 0x683E38e76649b599A93073855f1a6335de36Da81
- SyntheticSSRP Rewarder(reward currency - mockUSDT(it will be changed to USDC in the future)): 0x4801B9a7A0fDf18059DcE9f42466Fa5bEC838A91 


- SingleSidedInsurancePool(SSIP) : 0xa4F355fc1dE69AD9718dC5b01ec7Fd7E78ac2248

- SSIP RiskPool(SSIP LP token): 0xbea0F688Ea2E835a9D6257bc962509d7799D534C
- SSIP Rewarder: 0x9E66FfBE92eF224114A6cF08F7F5411bA8AAFde2
- SyntheticSSIP: 0x6c681F6a2AE9109d765960d7Ba795343CE997535
- SyntheticSSIP Rewarder(reward currency - mockUSDT for now): 0x14CCBFB9DD13031CC00554Ef2949cDd1A63A3A02 


- SyntheticSSIPFactory: 0x2Cb164A07f80ccb921621e1076CC19e341D30fbF
- SyntheticSSRPFactory: 0xCf26883fE4E3E2A197088D9ED905b2104180C3F1


- RiskPoolFactory: 0x9911b6670AB11FE9973cd2e058DAB101865dFcDB
- RewarderFactory: 0xc376955429C7637d1b7b2D1DD8D4e4ddaF550F9A
- Migration: 0x966D9Ea65e33Ff5F857b457329CdFe9dfaC33738


- SalesPolicyFactory: 0xd9070bbFbCf10bF6628D265757FfE4FEC89553Ce
- SalesPolicy for protocol 0: 0x2D16C547B666434b5cc77eB71240D67832bafE7c


- CapitalAgent: 0x2D1ADb7A6ED75B23E1C5Dfa8E74462DC39753459


- MockUNO : 0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5
- MockUSDT : 0x40c035016AD732b6cFce34c3F881040B6C6cf71E
- ExchangeAgent: 0xf97Eb2a102Ba485020c9d2EA0ac4BAAC19092Ee9
- PremiumPool: 0x3fCDBcbBb567d7A326b133439A938cC052FAdf1c


### MockUNO faucet:
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


