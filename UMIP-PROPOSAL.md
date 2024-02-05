| UMIP-179   |                                                                                                                                          |
|------------|------------------------------------------------------------------------------------------------------------------------------------------|
| UMIP Title | Add UNO as a whitelisted collateral currency              |
| Authors    |                  |
| Status     |                                                  |
| Created    | 05/02/2024   
| Discourse link    |                                |

## Summary

This UMIP will add UNO to the supported collateral currencies on the global whitelist contract, allowing the usage of this assets as collateral currencies.

## Motivation

UNO is an ERC20 token. We designed the UNO token to bind stakeholders to the platform and to assure the quality of the services provided build loyalty into the ecosystem. 

With the introduction of the UNO token into the business model, the incentive to use the UnoRe platform increases in strength. 
On top of UnoRe’s existing strengths, the addition of UNO token adds further benefits and enhanced user engagement as outlined below:

Adding UNO as collateral will allow policy holder to claim policy, asserter and disputer will transfer UNO token bond amount to Optimistic Oracle

## Technical Specification

To accomplish this upgrade, two changes need to be made:

- The UNO address, (address), needs to be added to the collateral currency whitelist introduced in UMIP-8.
- A final fee of 400 UNO needs to be added for UNO in the Store contract.

## Rationale

The rationale behind this change is giving deployers more useful collateral currency options.	


400 UNO was chosen as the final fee for UNO because this is the practical equivalent to the final fee of already
approved stablecoins.


## Implementation

This change has no implementation other than proposing the two aforementioned governor transactions that will be proposed.

## Security considerations
UNO bear the centralized risks of USDC and the technical risks of Yearn: yearn's vault  are investing depositors' USDC into other protocols in order to generate yield, therefore, in addition to yearn's own smart contract, UNO also bears the risk of the underlying protocols used for generating the yield.

Although, Unore's team has quite a conservative risk management and assessment matrix, so the risk is limited.

Using UNO as collateral for contract deployers and users should be done without considering 1 UNO = 1 USD; UNO is an interest-bearing stablecoin which constantly grows in value. Contract deployers would need to use the UNO/USDC exchange rate.   // to discussed 1 UNO = 1 USD
