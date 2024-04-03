const { expect } = require("chai")
const bn = require('bignumber.js')
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 })
const { ethers, network } = require("hardhat")
const { getBigNumber } = require("../scripts/shared/utilities")
const { Token } = require('@uniswap/sdk-core')
const { Pool, Position, nearestUsableTick, encodeSqrtRatioX96 } = require('@uniswap/v3-sdk')
const { abi: IUniswapV3PoolABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const { abi: IUniswapV3FactoryABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json")
const { abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json')


function encodePriceSqrt(reserve1, reserve0) {
  return BigInt(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  )
}


const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,

} = require("../scripts/shared/constants")


describe("ExchangeAgent", function () {
  before(async function () {
    this.price = encodePriceSqrt(1, 1);
    this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
    this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
    this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
    this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
    this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
    this.RiskPool = await ethers.getContractFactory("RiskPool")
    this.Rewarder = await ethers.getContractFactory("Rewarder")
    this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
    this.SyntheticSSIPFactory = await ethers.getContractFactory("SyntheticSSIPFactory")
    this.MockUNO = await ethers.getContractFactory("MockUNO")
    this.MockUSDT = await ethers.getContractFactory("MockUSDT")
    this.RewardAttack = await ethers.getContractFactory("RewardAttack")
    this.OptimisticOracleV3 = await ethers.getContractFactory("OptimisticOracleV3")
    this.SalesPolicy = await ethers.getContractFactory("MockSalesPolicy")
    this.SalesPolicyFactory = await ethers.getContractFactory("MockSalesPolicyFactory")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
    this.PremiumPool = await ethers.getContractFactory("PremiumPool")
    this.signers = await ethers.getSigners()
    this.zeroAddress = "0x0000000000000000000000000000000000000000";

    this.owners = [
      this.signers[0].address,
      this.signers[1].address,
      this.signers[2].address,
      this.signers[3].address,
      this.signers[4].address,
    ]

    this.numConfirmationsRequired = 2
    this.txIdx = 0

  })

  before(async function () {
    this.mockUNO = await this.MockUNO.deploy()
    this.mockUSDT = await this.MockUSDT.deploy()
    await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber("500000000000000"), { from: this.signers[0].address })
    await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber("50000000000000"), { from: this.signers[0].address })
    await this.mockUNO.connect(this.signers[1]).faucetToken(getBigNumber("500000000"), { from: this.signers[1].address })
    await this.mockUSDT.connect(this.signers[1]).faucetToken(getBigNumber("500000"), { from: this.signers[1].address })
    await this.mockUNO.connect(this.signers[2]).faucetToken(getBigNumber("500000000"), { from: this.signers[2].address })
    await this.mockUSDT.connect(this.signers[2]).faucetToken(getBigNumber("500000"), { from: this.signers[2].address })
    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.rewarderFactory = await this.RewarderFactory.deploy()
    this.syntheticSSIPFactory = await this.SyntheticSSIPFactory.deploy()

    const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]
    const timestamp = new Date().getTime()
    this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"],
    });

    await network.provider.send("hardhat_setBalance", [
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      "0x1000000000000000000000000000000000",
    ]);

    console.log("Adding liquidity...")
    
    await (
      await this.mockUNO
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("100000000000000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("100000000000000"), { from: this.signers[0].address })
    ).wait();
    this.uniswapV3Factory = new ethers.Contract(UNISWAP_FACTORY_ADDRESS.goerli, IUniswapV3FactoryABI, ethers.provider);

    const fee = 3000;
    const createPoolTx = await this.uniswapV3Factory.connect(this.signers[0]).createPool(this.mockUNO.target,
      this.mockUSDT.target, fee);
    const createPoolReceipt = await createPoolTx.wait();

    const events = await this.uniswapV3Factory.queryFilter("PoolCreated", createPoolReceipt.blockNumber, createPoolReceipt.blockNumber);
    
    const eventData = events[0].args;
    const poolAddress = eventData.pool;
    expect(eventData.token0).to.equal(this.mockUNO.target)
    expect(eventData.token1).to.equal(this.mockUSDT.target)

    let uniswapV3Pool = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      ethers.provider
    )

    await uniswapV3Pool.connect(this.signers[0]).initialize(this.price.toString());

    const poolData = await getPoolData(uniswapV3Pool);
    const UNOToken = new Token(31337, this.mockUNO.target, 18, 'UNO', 'UNORE')
    const UsdtToken = new Token(31337, this.mockUSDT.target, 18, 'USDT', 'USDT')

    const configuredPool = new Pool(
      UNOToken,
      UsdtToken,
      Number(poolData.fee),
      poolData.sqrtPriceX96.toString(),
      poolData.liquidity.toString(),
      Number(poolData.tick)
    )
   
    const position = new Position({
      pool: configuredPool,
      liquidity: ethers.toBeHex(ethers.parseEther('1')),
      tickLower: nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) -
        configuredPool.tickSpacing * 2,
      tickUpper: nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) +
        configuredPool.tickSpacing * 2,
    })

    const { amount0: amount0Desired, amount1: amount1Desired} = position.mintAmounts

    params = {
      token0: this.mockUNO.target,
      token1: this.mockUSDT.target,
      fee: poolData.fee,
      tickLower: nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) -
      configuredPool.tickSpacing * 2,
      tickUpper: nearestUsableTick(configuredPool.tickCurrent, configuredPool.tickSpacing) +
      configuredPool.tickSpacing * 2,
      amount0Desired: amount0Desired.toString(),
      amount1Desired: amount1Desired.toString(),
      amount0Min: 0,
      amount1Min: 0,
      recipient: this.signers[0].address,
      deadline: Math.floor(Date.now() / 1000) + (60 * 10)
    }
  
    const positionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const nonfungiblePositionManager = new ethers.Contract(
      positionManagerAddress,
      INonfungiblePositionManagerABI,
      ethers.provider
    )
    
  await this.mockUNO.connect(this.signers[0]).approve(positionManagerAddress, ethers.parseEther('3000'))
  await this.mockUSDT.connect(this.signers[0]).approve(positionManagerAddress, ethers.parseEther('3000'))

    const tx = await nonfungiblePositionManager.connect(this.signers[0]).mint(
      params,
      { gasLimit: '1000000' }
    )
    const receipt = await tx.wait()
   
    async function getPoolData(poolContract) {
      const [tickSpacing, fee, liquidity, slot0] = await Promise.all([
        poolContract.tickSpacing(),
        poolContract.fee(),
        poolContract.liquidity(),
        poolContract.slot0(),
      ])

      return {
        tickSpacing: tickSpacing,
        fee: fee,
        liquidity: liquidity,
        sqrtPriceX96: slot0[0],
        tick: slot0[1],
      }
    }
    console.log("Added liquidity...")

    this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired)
    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.signers[0].address);
    await this.mockOraclePriceFeed.addStableCoin(this.mockUSDT.target)
    await this.mockOraclePriceFeed.addStableCoin(this.mockUNO.target)
    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.target,
      WETH_ADDRESS.rinkeby,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UNISWAP_FACTORY_ADDRESS.rinkeby,
      this.multiSigWallet.target,
      getBigNumber("60")
    )

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [this.multiSigWallet.target],
    });

    await network.provider.send("hardhat_setBalance", [
      this.multiSigWallet.target,
      "0x1000000000000000000000000000000000",
    ]);

    this.multisig = await ethers.getSigner(this.multiSigWallet.target)

  })

  describe("exchangeAgent contract initialiation", function () {
    it("should not allow others to set twapPriceFeed contract address", async function () {
      await expect(
        this.exchangeAgent
          .connect(this.signers[1])
          .setOraclePriceFeed(this.mockOraclePriceFeed.target, { from: this.signers[1].address }),
      ).to.be.revertedWithCustomError(this.exchangeAgent, "OwnableUnauthorizedAccount").withArgs(this.signers[1].address);
    })

    it("should not allow others to set slippage", async function () {
      await expect(
        this.exchangeAgent.connect(this.signers[1]).setSlippage(10, { from: this.signers[1].address }),
      ).to.be.revertedWithCustomError(this.exchangeAgent, "OwnableUnauthorizedAccount").withArgs(this.signers[1].address);
    })

    it("should add white list", async function () {
      await this.exchangeAgent.connect(this.multisig).addWhiteList(this.signers[5].address)
      const whiteList = await this.exchangeAgent.whiteList(this.signers[5].address)
      expect(whiteList).to.equal(true)
    })
  })

  describe("token exchange test", function () {
    beforeEach(async function () {
      let encodedCallData
      encodedCallData = this.exchangeAgent.interface.encodeFunctionData("setSlippage", [5])

      expect(await this.multiSigWallet.submitTransaction(this.exchangeAgent.target, 0, encodedCallData)).to.emit(this.multiSigWallet, "SubmitTransaction").withArgs(this.signers[0].address, this.txIdx, this.exchangeAgent.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = this.exchangeAgent.interface.encodeFunctionData("addWhiteList", [this.signers[1].address])

      await expect(this.multiSigWallet.submitTransaction(this.exchangeAgent.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.exchangeAgent.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      await this.exchangeAgent.connect(this.multisig).setSlippage(5)
    })
    it("Should not allow others to convert tokens", async function () {
      await (
        await this.mockUNO
          .connect(this.signers[1])
          .approve(this.exchangeAgent.target, getBigNumber("10000000"), { from: this.signers[1].address })
      ).wait()

      await expect(
        this.exchangeAgent
          .connect(this.signers[2])
          .convertForToken(this.mockUNO.target, this.mockUSDT.target, getBigNumber("2000"), { from: this.signers[2].address }),
      ).to.be.revertedWith("UnoRe: ExchangeAgent Forbidden")
    })

    // it("should convert UNO to USDT", async function () {
    //   await this.exchangeAgent.addWhiteList(this.signers[0].address)
    // const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.signers[0].address)
    //       await (
    //         await this.mockUNO
    //           .connect(this.signers[0])
    //           .approve(this.exchangeAgent.target, getBigNumber("10000000"), { from: this.signers[0].address })
    //       ).wait()
    //       await this.mockUNO
    //         .connect(this.signers[0])
    //         .transfer(this.exchangeAgent.target, getBigNumber("2000"), { from: this.signers[0].address })
    //       const usdtConvert = await (
    //         await this.exchangeAgent.convertForToken(this.mockUNO.target, this.mockUSDT.target, getBigNumber("2000"))
    //       ).wait()
    //       const convertedAmount = usdtConvert.events[usdtConvert.events.length - 1].args._convertedAmount
    //       const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.signers[0].address)
    //       expect(usdtBalanceAfter).to.equal(usdtBalanceBefore.add(convertedAmount))
    // })
  })
})