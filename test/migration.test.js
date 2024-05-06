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
        this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
        this.CapitalAgent1 = await ethers.getContractFactory("CapitalAgent1")
        this.PremiumPool = await ethers.getContractFactory("PremiumPool")
        this.Rewarder = await ethers.getContractFactory("Rewarder")
        this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
        this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
        this.RiskPool = await ethers.getContractFactory("RiskPool")
        this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
        this.MockUNO = await ethers.getContractFactory("MockUNO")
        this.MockUSDT = await ethers.getContractFactory("MockUSDT")
        this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
        this.SalesPolicy = await ethers.getContractFactory("SalesPolicy")
        this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
        this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
        this.EscalationManager = await ethers.getContractFactory("EscalationManager")
        this.PayoutRequest = await ethers.getContractFactory("PayoutRequest")
        this.signers = await ethers.getSigners()
        this.zeroAddress = ethers.ZeroAddress;
        this.routerContract = new ethers.Contract(
          UNISWAP_ROUTER_ADDRESS.sepolia,
          JSON.stringify(UniswapV2Router.abi),
          ethers.provider,
        )
        this.devWallet = this.signers[0]
        this.chainId = (await ethers.provider.getNetwork()).chainId
        this.domainType = [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "verifyingContract", type: "address" },
          { name: "salt", type: "bytes32" },
        ]
        this.metaTransactionType = [
          { name: "nonce", type: "uint256" },
          { name: "from", type: "address" },
          { name: "functionSignature", type: "bytes" },
        ]
    
        this.owners = [
          this.signers[0].address,
          this.signers[1].address,
          this.signers[2].address,
          this.signers[3].address,
          this.signers[4].address,
        ]
    
        this.numConfirmationsRequired = 2
      })
    
    beforeEach(async function () {
        this.mockUNO = await this.MockUNO.deploy()
        this.mockUSDT = await this.MockUSDT.deploy()
        await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber("500000000"), { from: this.signers[0].address })
        await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber("500000"), { from: this.signers[0].address })
        await this.mockUNO.connect(this.signers[1]).faucetToken(getBigNumber("500000000"), { from: this.signers[1].address })
        await this.mockUSDT.connect(this.signers[1]).faucetToken(getBigNumber("500000"), { from: this.signers[1].address })
        await this.mockUNO.connect(this.signers[2]).faucetToken(getBigNumber("500000000"), { from: this.signers[2].address })
        await this.mockUSDT.connect(this.signers[2]).faucetToken(getBigNumber("500000"), { from: this.signers[2].address })
        await this.mockUNO.connect(this.signers[4]).faucetToken(getBigNumber("500000"), { from: this.signers[4].address })
        await this.mockUNO.connect(this.signers[5]).faucetToken(getBigNumber("500000"), { from: this.signers[5].address })
        await this.mockUNO.connect(this.signers[6]).faucetToken(getBigNumber("500000"), { from: this.signers[6].address })
        this.masterChefOwner = this.signers[0].address
        this.claimAssessor = this.signers[3].address
        this.assertor = this.signers[6]
        this.disputor = this.signers[7]
        this.riskPoolFactory = await this.RiskPoolFactory.deploy()
        this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
        this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))
        this.mockUNO.transfer(this.disputor.address, getBigNumber("3000000"))
    
    
        const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]
        const timestamp = new Date().getTime()
    
        // multisig address
        this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6")
        await hre.network.provider.request({
          method: "hardhat_impersonateAccount",
          params: ["0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"],
        });
    
        await network.provider.send("hardhat_setBalance", [
          "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
          "0x1000000000000000000000000000000000",
        ]);
    
        await (
          await this.mockUNO
            .connect(this.signers[0])
            .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("10000000"), { from: this.signers[0].address })
        ).wait()
        await (
          await this.mockUSDT
            .connect(this.signers[0])
            .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("10000000"), { from: this.signers[0].address })
        ).wait()
    
        await (
          await this.routerContract
            .connect(this.signers[0])
            .addLiquidity(
              this.mockUNO.target,
              this.mockUSDT.target,
              getBigNumber("3000000"),
              getBigNumber("3000", 6),
              getBigNumber("3000000"),
              getBigNumber("3000", 6),
              this.signers[0].address,
              timestamp,
              { from: this.signers[0].address, gasLimit: 9999999 },
            )
        ).wait()
    
        this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired);
        this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.mockUNO.target, this.mockUSDT.target);
        this.rewarderFactory = await this.RewarderFactory.deploy()
    
        this.exchangeAgent = await this.ExchangeAgent.deploy(
          this.mockUSDT.target,
          WETH_ADDRESS.sepolia,
          this.mockOraclePriceFeed.target,
          UNISWAP_ROUTER_ADDRESS.sepolia,
          UNISWAP_FACTORY_ADDRESS.sepolia,
          this.multisig.address,
          getBigNumber("60")
        )
    
        this.premiumPool = await this.PremiumPool.deploy(
          this.exchangeAgent.target,
          this.mockUNO.target,
          this.mockUSDT.target,
          this.multisig.address,
          this.signers[0].address,
        )
    
        await this.premiumPool.connect(this.multisig).grantRole((await this.premiumPool.ADMIN_ROLE()), this.signers[0].address);
    
        this.capitalAgent = await upgrades.deployProxy(this.CapitalAgent, [
          this.exchangeAgent.target,
          this.mockUSDT.target,
          this.multisig.address,
          this.signers[0].address,
        ])
        this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(
          this.mockUSDT.target,
          this.exchangeAgent.target,
          this.premiumPool.target,
          this.capitalAgent.target,
          this.multisig.address,
        )
    
        let encodedCallData
        this.txIdx = 0
    
        // add 2 protocols
        for (let idx = 0; idx < 3; idx++) {
          await this.salesPolicyFactory.connect(this.multisig).addProtocol(this.signers[idx + 1].address);
        }
    
        expect(await this.salesPolicyFactory.connect(this.multisig).allProtocolsLength()).equal(3)
    
        await this.premiumPool.addCurrency(this.mockUSDT.target);
    
        // await (await this.premiumPool.addCurrency(this.mockUSDT.address)).wait()
        this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB");
        // this.AddressWhitelist = await ethers.getContractAt("IAddressWhitelist", "0x63fDfF29EBBcf1a958032d1E64F7627c3C98A059")
        // this.MockOracleAncillary = await ethers.getContractAt('MockOracleAncillaryInterface', '0x20570E9e27920aC5E2601E0bef7244DeFf7F0B28');
        // this.FeeManager = await ethers.getContractAt("IFeeManger", "0x07417cA264170Fc5bD3568f93cFb956729752B61")
        this.admin = await ethers.getImpersonatedSigner("0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D");
        // await this.AddressWhitelist.connect(this.admin).addToWhitelist(this.mockUNO.target);
        // await this.FeeManager.connect(this.admin).setFinalFee(this.mockUNO.target, [10]);
        // await this.optimisticOracleV3.connect(this.admin).setAdminProperties(this.mockUNO.target, 120, ethers.parseEther("0.1"))
    
        this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address);
    
        this.singleSidedInsurancePool = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
          this.capitalAgent.target,
          "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
        ]);

        this.singleSidedInsurancePool1 = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
            this.capitalAgent.target,
            "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
        ]);
    
        await this.singleSidedInsurancePool.connect(this.multisig).createRewarder(
          this.signers[0].address,
          this.rewarderFactory.target,
          this.mockUNO.target,
        )

        await this.singleSidedInsurancePool1.connect(this.multisig).createRewarder(
            this.signers[0].address,
            this.rewarderFactory.target,
            this.mockUNO.target,
          )

        this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
        this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

        this.rewarderAddress1 = await this.singleSidedInsurancePool1.rewarder()
        this.rewarder1 = await this.Rewarder.attach(this.rewarderAddress1)
    
        this.payoutRequest = await upgrades.deployProxy(this.PayoutRequest, [
          this.singleSidedInsurancePool.target,
          this.optimisticOracleV3.target,
          await (this.optimisticOracleV3.defaultCurrency()),
          this.escalationManager.target,
          this.signers[0].address,
          this.signers[0].address,
        ]);
    
        await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.singleSidedInsurancePool.CLAIM_PROCESSOR_ROLE()), this.payoutRequest.target)
    
        await this.capitalAgent.connect(this.multisig).addPoolWhiteList(this.singleSidedInsurancePool.target);
        await this.capitalAgent.connect(this.multisig).addPoolWhiteList(this.singleSidedInsurancePool1.target);
    
        await this.capitalAgent.connect(this.multisig).setSalesPolicyFactory(this.salesPolicyFactory.target);
    
        console.log('[setSalesPolicyFactory]')
    
        await this.singleSidedInsurancePool.connect(this.multisig).createRiskPool(
          "UNO-LP",
          "UNO-LP",
          this.riskPoolFactory.target,
          this.mockUNO.target,
          getBigNumber("1"),
          getBigNumber("0", 6),
        )

        await this.singleSidedInsurancePool1.connect(this.multisig).createRiskPool(
            "UNO-LP",
            "UNO-LP",
            this.riskPoolFactory.target,
            this.mockUNO.target,
            getBigNumber("1"),
            getBigNumber("0"),
          )
    
        await this.mockUNO.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
        await this.mockUNO
          .connect(this.signers[1])
          .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })
    
        await (
          await this.mockUNO
            .connect(this.signers[0])
            .transfer(this.rewarder.target, getBigNumber("100000"), { from: this.signers[0].address })
        ).wait()

        await (
            await this.mockUNO
              .connect(this.signers[0])
              .transfer(this.rewarder1.target, getBigNumber("100000"), { from: this.signers[0].address })
          ).wait()

        await this.singleSidedInsurancePool.enterInPool(getBigNumber("100000"))
        let amount = await this.capitalAgent.checkCapitalByMCR(this.singleSidedInsurancePool.target, getBigNumber("100000"));

        // // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
    
        await advanceBlockTo(beforeBlockNumber + 10000)
    
        await this.capitalAgent.setMCR(getBigNumber("1", 16));
    
        await this.capitalAgent.setMLR(getBigNumber("3"));
        // // another one will deposit in pool with the same amount
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("100000"), { from: this.signers[1].address })
            
          await this.singleSidedInsurancePool.enterInPool(getBigNumber("100000"))
    
    
        await this.salesPolicyFactory.connect(this.multisig).newSalesPolicy(this.exchangeAgent.target, this.premiumPool.target, this.capitalAgent.target);
    
        this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
        this.salesPolicy = await this.SalesPolicy.attach(await this.salesPolicyFactory.salesPolicy())
    
        await this.salesPolicyFactory.connect(this.multisig).setSignerInPolicy(this.signers[0].address);
    
        await this.payoutRequest.setCapitalAgent(this.capitalAgent.target);
        let riskPool1 = await this.singleSidedInsurancePool1.riskPool();
        await this.mockUNO.transfer(riskPool1, getBigNumber("20000000"))
      })
    
      describe("migration of users in ssip and ssrp", function () {
        it("Should update rewardDebt and user amount in new version of ssip", async function () {
            let poolCapital = (await this.capitalAgent.poolInfo(this.singleSidedInsurancePool.target)).totalCapital;
            await this.capitalAgent.connect(this.multisig).setPoolCapital(this.singleSidedInsurancePool1.target, poolCapital);
            let userInfo1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address);
            await this.singleSidedInsurancePool1.connect(this.multisig).setUserDetails(this.signers[0].address, userInfo1.amount, userInfo1.rewardDebt);
            expect((await this.singleSidedInsurancePool.userInfo(this.signers[0].address)).rewardDebt).to.equal((await this.singleSidedInsurancePool1.userInfo(this.signers[0].address)).rewardDebt);

            let userInfo2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address);
            await this.singleSidedInsurancePool1.connect(this.multisig).setUserDetails(this.signers[1].address, userInfo2.amount, userInfo2.rewardDebt);
            expect((await this.singleSidedInsurancePool.userInfo(this.signers[1].address)).rewardDebt).to.equal((await this.singleSidedInsurancePool1.userInfo(this.signers[1].address)).rewardDebt);
            let poolInfoInssip = await this.singleSidedInsurancePool.poolInfo();
            await this.singleSidedInsurancePool1.connect(this.multisig).setAccUnoPerShare(poolInfoInssip.accUnoPerShare, poolInfoInssip.lastRewardBlock);
            let poolInfoINssip1 = await this.singleSidedInsurancePool1.poolInfo();
            expect(poolInfoInssip.accUnoPerShare).to.equal(poolInfoINssip1.accUnoPerShare);

            await this.singleSidedInsurancePool1.connect(this.multisig).setLockTime(1);
            await this.singleSidedInsurancePool.connect(this.multisig).setLockTime(1);

            await this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200000"));
            await this.singleSidedInsurancePool1.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("100000"));

            await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("200000"));

            const beforeBlockNumber = await ethers.provider.getBlockNumber()
            await advanceBlockTo(beforeBlockNumber + 10000)

            let beforeBalanceOfuser1 = await this.mockUNO.balanceOf(this.signers[0].address);
            let beforeBalanceOfuser2 = await this.mockUNO.balanceOf(this.signers[1].address);

            await this.singleSidedInsurancePool1.leaveFromPending(getBigNumber("200000"));
            await this.singleSidedInsurancePool1.connect(this.signers[1]).leaveFromPending(getBigNumber("100000"));

            let afterBalanceOfuser1 = await this.mockUNO.balanceOf(this.signers[0].address);
            let afterBalanceOfuser2 = await this.mockUNO.balanceOf(this.signers[1].address);

            expect(beforeBalanceOfuser1 + getBigNumber("200000")).to.equal(afterBalanceOfuser1);
            expect(beforeBalanceOfuser2 + getBigNumber("100000")).to.equal(afterBalanceOfuser2);

            let difffInUnoBalancOfUser1 = afterBalanceOfuser1 - beforeBalanceOfuser1;
            await this.singleSidedInsurancePool.leaveFromPending(getBigNumber("200000"));
            let afterLeaveFromSSIPuser1 = await this.mockUNO.balanceOf(this.signers[0].address);

            expect(afterLeaveFromSSIPuser1 - afterBalanceOfuser1).to.equal(difffInUnoBalancOfUser1);
        })

      })
})