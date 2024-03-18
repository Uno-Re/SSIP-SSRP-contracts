const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")

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
        this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
        this.capitalAgent = await ethers.getContractAt("CapitalAgent", "0x62151616725e5bF4ca6Dc310b1fd4a5bf63fDB6c");
        this.CapitalAgent1 = await ethers.getContractFactory("CapitalAgent1")
        this.mockUSDT = await ethers.getContractAt("MockUSDT", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d");
        this.mockUNO = await ethers.getContractAt("MockUNO", "0x474021845C4643113458ea4414bdb7fB74A01A77")

        this.SalesPolicy = await ethers.getContractFactory("SalesPolicy");
        this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
        this.SingleSidedInsurancePool1 = await ethers.getContractFactory("SingleSidedInsurancePool1")
        this.singleSidedInsurancePool = await ethers.getContractAt("SingleSidedInsurancePool", "0xd87a4214EDa400Ed376EaaC0aEd9d1414D71581C");
        this.riskPool = await ethers.getContractAt("RiskPool", "0x8978d08bd89B9415eB08A4D52C1bDDf070F19fA2");
        this.signers = await ethers.getSigners()
        this.zeroAddress = ethers.ZeroAddress;

        this.whale = await ethers.getImpersonatedSigner('0xF977814e90dA44bFA03b6295A0616a897441aceC');
        this.usdtWhale = await ethers.getImpersonatedSigner("0x8894E0a0c962CB723c1976a4421c95949bE2D4E3");
        this.unoWhale = await ethers.getImpersonatedSigner("0xCBCe172d7af2616804ab5b2494102dAeC47B2635");
        this.deployer = await ethers.getImpersonatedSigner("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e");
        
        await this.whale.sendTransaction({
            to: this.usdtWhale.address,
            value: getBigNumber('100'),
        });
        await this.whale.sendTransaction({
            to: this.deployer.address,
            value: getBigNumber('100'),
        });
        await this.whale.sendTransaction({
            to: this.unoWhale.address,
            value: getBigNumber('100'),
        });
        await this.whale.sendTransaction({
            to: this.signers[0].address,
            value: getBigNumber('100'),
        });
        await this.whale.sendTransaction({
            to: this.signers[0].address,
            value: getBigNumber('100'),
        });
        await this.whale.sendTransaction({
            to: this.signers[0].address,
            value: getBigNumber('100'),
        });

        this.devWallet = this.signers[0]
        this.chainId = (await ethers.provider.getNetwork()).chainId

        await this.mockUNO.connect(this.unoWhale).transfer(this.signers[0].address, getBigNumber("10000"))
        await this.mockUNO.connect(this.unoWhale).transfer(this.signers[1].address, getBigNumber("10000"));
        await this.mockUNO.connect(this.unoWhale).transfer(this.signers[2].address, getBigNumber("10000"));
        await this.mockUNO.connect(this.unoWhale).transfer(this.signers[3].address, getBigNumber("10000"));
        await this.mockUNO.connect(this.unoWhale).transfer(this.signers[4].address, getBigNumber("10000"));
        await this.mockUNO.connect(this.unoWhale).transfer(this.signers[5].address, getBigNumber("500000")); await this.mockUNO.connect(this.unoWhale).transfer(this.signers[6].address, getBigNumber("10000"));
        await this.mockUNO.connect(this.unoWhale).transfer(this.signers[2].address, getBigNumber("10000"))
    })

    before(async function () {
        this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
        this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))
        this.masterChefOwner = this.signers[0].address
        this.claimAssessor = this.signers[3].address
        this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
        this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))

    })

    describe("migration of users in ssip and ssrp", function () {
        before(async function () {
            this.admin = await ethers.getImpersonatedSigner("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e")
            this.mexc = await ethers.getImpersonatedSigner("0xcCF6b410f534e0f8fC39CAE4814471D9f6A90d4D")
            this.kucoin = await ethers.getImpersonatedSigner("0x446B86A33E2a438f569B15855189e3dA28d027ba")
            await this.whale.sendTransaction({
                to: this.mexc.address,
                value: getBigNumber('10'),
            });
            await this.whale.sendTransaction({
                to: this.kucoin.address,
                value: getBigNumber('10'),
            });


            await this.mockUNO.connect(this.mexc).transfer("0xeF21cB3eE91EcB498146c43D56C2Ef9Bae6B7d53", await this.mockUNO.balanceOf(this.mexc.address));
            await this.mockUNO.connect(this.kucoin).transfer("0xeF21cB3eE91EcB498146c43D56C2Ef9Bae6B7d53", await this.mockUNO.balanceOf(this.kucoin.address));

            await this.singleSidedInsurancePool.connect(this.deployer).setRewardMultiplier("966702114403293700")
            await this.singleSidedInsurancePool.connect(this.deployer).setAccUnoPerShare(0,19445358);
            await this.singleSidedInsurancePool.connect(this.deployer).setUserDetails(this.signers[0].address,ethers.parseEther("1000"),1);
        })

        it("check pendingUno apy", async function () {
            const pending1= await this.singleSidedInsurancePool.pendingUno(this.signers[0].address);
            console.log(ethers.formatEther(pending1));
            await advanceBlockTo(22052713);
            const pending2= await this.singleSidedInsurancePool.pendingUno(this.signers[0].address);
            console.log(ethers.formatEther(pending2));
        })
    })
})