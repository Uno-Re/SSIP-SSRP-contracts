const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

const {
    getBigNumber,
    advanceBlockTo,
} = require("../scripts/shared/utilities")

const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")

const {
    WETH_ADDRESS,
    UNISWAP_FACTORY_ADDRESS,
    UNISWAP_ROUTER_ADDRESS
} = require("../scripts/shared/constants")
const OptimisticOracleV3Abi = require("../scripts/abis/OptimisticOracleV3.json");

describe("Migration", function () {
    before(async function () {
        this.admin = await ethers.getImpersonatedSigner("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e")
        this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
        this.capitalAgent = await ethers.getContractAt("CapitalAgent", "0x62151616725e5bF4ca6Dc310b1fd4a5bf63fDB6c");
        this.CapitalAgent1 = await ethers.getContractFactory("CapitalAgent1")
        this.mockUSDT = await ethers.getContractAt("MockUSDT", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");
        this.mockUNO = await ethers.getContractAt("MockUNO", "0x474021845C4643113458ea4414bdb7fB74A01A77");

        this.SalesPolicy = await ethers.getContractFactory("SalesPolicy");
        this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool", this.admin)
        this.SingleSidedInsurancePool1 = await ethers.getContractFactory("SingleSidedInsurancePool1", this.admin)
        this.singleSidedInsurancePool = await ethers.getContractAt("SingleSidedInsurancePool", "0xE34DBacff7078dA18260d9321982E588AA30d4B6", this.admin);

        this.mockUSDT = await ethers.getContractAt("MockUSDT", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d")

        this.signers = await ethers.getSigners()
        this.zeroAddress = ethers.ZeroAddress;


        this.whale = await ethers.getImpersonatedSigner('0xF977814e90dA44bFA03b6295A0616a897441aceC');
        this.usdtWhale = await ethers.getImpersonatedSigner("0x8894E0a0c962CB723c1976a4421c95949bE2D4E3");
        this.unoWhale = await ethers.getImpersonatedSigner("0xCBCe172d7af2616804ab5b2494102dAeC47B2635");
        this.deployer = await ethers.getImpersonatedSigner("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e")

        this.devWallet = this.signers[0]
        this.chainId = (await ethers.provider.getNetwork()).chainId

        await this.whale.sendTransaction({
            to: this.unoWhale.address,
            value: ethers.parseEther('100'),
        });
        await this.whale.sendTransaction({
            to: this.admin.address,
            value: ethers.parseEther('100'),
        });

    })

    before(async function () {
    })

    describe("migration of users in ssip and ssrp", function () {
        before(async function () {
            //await this.singleSidedInsurancePool.setAccUnoPerShare("17756066182516656631666706957795424", 19475073);

            //await this.singleSidedInsurancePool.setRewardMultiplier(ethers.parseUnits('5.85',17));
            //await this.singleSidedInsurancePool.setRewardMultiplier(434961939037000);
            await this.singleSidedInsurancePool.setRewardMultiplier(ethers.parseUnits('6.707', 45));
            // this.mexc = await ethers.getImpersonatedSigner("0x4982085C9e2F89F2eCb8131Eca71aFAD896e89CB")
            //  this.kucoin = await ethers.getImpersonatedSigner("0x53f78A071d04224B8e254E243fFfc6D9f2f3Fa23")
            //    // await this.whale.sendTransaction({
            //         to: this.mexc.address,
            //         value: getBigNumber('10'),
            //     });
            // await this.whale.sendTransaction({
            //     to: this.kucoin.address,
            //     value: getBigNumber('10'),
            // });
            // //console.log(this.signers[0].address,'jgjh');

            // await this.mockUNO.connect(this.mexc).transfer("0xeF21cB3eE91EcB498146c43D56C2Ef9Bae6B7d53", await this.mockUNO.balanceOf(this.mexc.address));
            // await this.mockUNO.connect(this.kucoin).transfer("0xeF21cB3eE91EcB498146c43D56C2Ef9Bae6B7d53", await this.mockUNO.balanceOf(this.kucoin.address));


            // this.singleSidedInsurancePool = await upgrades.forceImport(this.singleSidedInsurancePool.target, this.SingleSidedInsurancePool, { from: this.admin });


            // console.log(await this.singleSidedInsurancePool.userInfo('0x884960C54702492d3DB7f266782AEf29239c1eA1'));
            // await this.singleSidedInsurancePool.transferToriskPool();
        })
        it("Should update rewardDebt and user amount in new version of ssip", async function () {
            const address = "0x91a14c8bb15dbB07397855DFa9b5565b0E209AdA"
            const user1 = await ethers.getImpersonatedSigner(address);
            await this.whale.sendTransaction({
                to: user1.address,
                value: ethers.parseEther('100'),
            });
            //await this.singleSidedInsurancePool.connect(this.admin).setUserDetails("0xD105387b9fFc6523211Ba8B23c925c137Cd9A640", ethers.parseUnits("10000",6), 1);
            const userInfo = await this.singleSidedInsurancePool.userInfo(address);
            console.log(userInfo.amount.toString(), 'amount');

            const currentDate = new Date();
            const afterOneYear = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
            const afterOneYearTimeStampUTC = afterOneYear.getTime() / 1000;

            console.log(afterOneYear); // Output: Date after 1 year from now
            console.log(afterOneYearTimeStampUTC);
            await mine(2598435)
            await this.singleSidedInsurancePool.updatePool()// Output: UNIX timestamp of the date after 1 year

            // await this.singleSidedInsurancePool.setAccUnoPerShare("17756066182516656631666706957795424", 18578648);
            //await this.singleSidedInsurancePool.updatePool()
            //await this.singleSidedInsurancePool.setAccUnoPerShare("16254299390444533346127", 18578648);
            //await this.singleSidedInsurancePool.setRewardMultiplier("1");
            // //await this.singleSidedInsurancePool.updatePool();
            // const poolInfo = await this.singleSidedInsurancePool.poolInfo()
            // console.log('accUno',poolInfo.accUnoPerShare);
            // console.log("rew",poolInfo.unoMultiplierPerBlock);
            // console.log('block',poolInfo.lastRewardBlock);
            // //expect((await this.singleSidedInsurancePool.poolInfo()).accUnoPerShare).to.equal(ethers.parseEther("10"))

            const rewarder = await this.singleSidedInsurancePool.rewarder();
            console.log(ethers.formatEther(await this.singleSidedInsurancePool.pendingUno(address)), 'jju');
            // await this.mockUNO.connect(this.unoWhale).transfer(rewarder, ethers.parseEther('150000'))
            // // console.log('hii');
            // const riskPool = await this.singleSidedInsurancePool.riskPool();
            // await this.mockUNO.connect(this.unoWhale).transfer(riskPool, ethers.parseEther('20000'))
            // await this.singleSidedInsurancePool.connect(user1).leaveFromPoolInPending(userInfo.amount);

            // const currentDate = new Date()
            // const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
            // const afterFiveDaysTimeStampUTC = new Date(afterFiveDays.toUTCString()).getTime() / 1000
            // network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
            // await network.provider.send("evm_mine");
            // console.log('userInfo.amount)', userInfo.amount);

            // await this.singleSidedInsurancePool.connect(user1).leaveFromPending(userInfo.amount);
            // console.log(`${address} withdraw successful`);
        });
        // it("should withdraw from riskPool", async function () {
        //     const bal=await this.mockUSDT.balanceOf("0x53C5C40B4DB912541A4058ee5FB98EAC36A760D4")
        //     this.singleSidedInsurancePool = await upgrades.upgradeProxy(this.singleSidedInsurancePool.target, this.SingleSidedInsurancePool1, { from: this.admin });
        //     await this.singleSidedInsurancePool.connect(this.admin).setRiskPool("0x53C5C40B4DB912541A4058ee5FB98EAC36A760D4");
        //     await this.singleSidedInsurancePool.connect(this.admin).setUserDetails(this.signers[0].address, bal, 1);
        //     await this.singleSidedInsurancePool.connect(this.admin).toggleEmergencyWithdraw();
        //     await expect(this.singleSidedInsurancePool.connect(this.signers[0]).emergencyWithdraw()).changeTokenBalances(this.mockUSDT, [this.signers[0].address,"0x53C5C40B4DB912541A4058ee5FB98EAC36A760D4"],[bal,-bal] );
        //     expect(await this.mockUSDT.balanceOf("0x53C5C40B4DB912541A4058ee5FB98EAC36A760D4")).to.equal(0)
        // })
        // it("Should update rewardDebt and user amount in new version of ssip", async function () {
        //     const addresses = [
        //         "0x884960C54702492d3DB7f266782AEf29239c1eA1",  "0x2cAFe9CBA9da5a49E3FF28eB63958c2583CD552A",  "0xB7c97cA9Ca7c8679935B9C1e53a984b0F6364acf",  "0xEb54b04b7329a8F1f32e6bA1E2419732bcB14647",  "0x7AE85B25b2Db88B3fC2000fA5326efD7abc4E1C0",  "0x46a6B768f76668D2Afd63A99e71d1Cf5718f97c5",  "0x2624FfA81b5d7bAacceEe3eEd7B49de18Be6EE16",  "0xA08a836F8F9b0Ec6B8791e0281992A80c44179DB",  "0x708C05507Beb059951D7e374AC268280f4A7f10e",  "0x6DfDcD9c7771c141a12c411C9150FEda69dAC249",  
        //         "0x6656f99558A55728C02742ade8Df278d22e6cFE9"
        //     ];

        //     for (const address of addresses) {
        //         try {
        //             const user1 = await ethers.getImpersonatedSigner(address);
        //             await this.whale.sendTransaction({
        //                 to: user1.address,
        //                 value: ethers.parseEther('1'),
        //             });
        //             const userInfo = await this.singleSidedInsurancePool.userInfo(address);
        //             console.log(userInfo.amount.toString(), 'amount');
        //             await this.singleSidedInsurancePool.connect(user1).leaveFromPoolInPending(userInfo.amount);

        //             const beforeBlockNumber = await ethers.provider.getBlockNumber();
        //             await advanceBlockTo(beforeBlockNumber + 10000);

        //             await this.singleSidedInsurancePool.connect(user1).leaveFromPending(userInfo.amount);
        //             console.log(`${address} withdraw successful`);
        //         } catch (error) {
        //             console.log(`Failed for ${address}:`, error);
        //         }
        //     }
        // });

    })
})