const { expect } = require("chai")


const { ethers, network } = require("hardhat")
const { getBigNumber } = require("../scripts/shared/utilities")
const { Pool, Position, nearestUsableTick } = require('@uniswap/v3-sdk')
const {abi:IUniswapV3PoolABI } = require("@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json")
const {abi: INonfungiblePositionManagerABI } = require('@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json')

const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")
const UniswapV2Factory = require("../scripts/abis/UniswapV2Factory.json")

const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,

} = require("../scripts/shared/constants")


describe("ExchangeAgent", function () {
  before(async function () {
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

    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UniswapV2Router.abi,
      ethers.provider,
    )

    // this.nonfungiblePositionManagerContract = new ethers.Contract(
    //   positionManagerAddress,
    //   INonfungiblePositionManagerABI,
    //   ethers.provider
    // )
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

  beforeEach(async function () {
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
    this.uniswapV3Factory = new ethers.Contract(UNISWAP_FACTORY_ADDRESS.rinkeby, UniswapV2Factory.abi, ethers.provider);


    const createPoolTx = await this.uniswapV3Factory.connect(this.signers[0]).createPool(this.mockUNO.target,
      this.mockUSDT.target, 3000);
    const createPoolReceipt = await createPoolTx.wait();


    // Get the newly created pool address from the event logs
    // const poolCreatedEvent = createPoolReceipt.events.find(
    //   (event) => event.event === 'PoolCreated'
    // );
    const events = await this.uniswapV3Factory.queryFilter("PoolCreated", createPoolReceipt.blockNumber, createPoolReceipt.blockNumber);

    const eventData = events[0].args;
    const poolAddress = eventData.pool;
    expect(eventData.token0).to.equal(this.mockUNO.target)
    expect(eventData.token1).to.equal(this.mockUSDT.target)
    console.log(poolAddress, 'xyz');
    let uniswapV3Pool = new ethers.Contract(
      poolAddress,
      IUniswapV3PoolABI,
      ethers.provider
    )
    await uniswapV3Pool.connect(this.signers[0]).initialize(ethers.parseEther('1'));
     uniswapV3Pool = new ethers.Contract(poolAddress, [
      'function mint(uint256 amount0, uint256 amount1, uint160 tickLower, uint160 tickUpper, address recipient, bytes memory data) external returns (uint256 amount0, uint256 amount1)'
    ], ethers.provider);

    const amount0Desired = getBigNumber("3000");
    const amount1Desired = getBigNumber("3000", 6);
    await this.mockUNO.approve(poolAddress, amount0Desired);
    await this.mockUSDT.approve(poolAddress, amount1Desired);

    // Add liquidity to the pool
    
    const mintTx = await uniswapV3Pool.connect(this.signers[0]).mint(
      amount0Desired,
      amount1Desired,
      10000,
      10000,
      this.signers[0].address,
      ethers.zeroPadValue('0x', 0)
    );
    console.log('Liquidity added successfully:', mintTx.hash);
    // const uniswapV3Pool = new ethers.Contract(poolAddress, [
    //   'function mint(uint256 amount0, uint256 amount1, uint160 tickLower, uint160 tickUpper, address recipient, bytes memory data) external returns (uint256 amount0, uint256 amount1)'
    // ], ethers.provider);

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
    const poolData = await getPoolData(uniswapV3Pool);

    const UNO_USDT_POOL = new Pool(
      this.mockUNO.target,
      this.mockUSDT.target,
      poolData.fee,
      poolData.sqrtPriceX96.toString(),
      poolData.liquidity.toString(),
      poolData.tick
    )

    const position = new Position({
      pool: UNO_USDT_POOL,
      liquidity: ethers.utils.parseUnits('1', 18),
      tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
      tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
    })

    const wallet = new ethers.Wallet(WALLET_SECRET)
    const connectedWallet = wallet.connect(provider);
    const positionManagerAddress = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const nonfungiblePositionManagerContract = new ethers.Contract(
      positionManagerAddress,
      INonfungiblePositionManagerABI,
      ethers.provider
    )

    const approvalAmount = ethers.utils.parseUnits('10', 18).toString()

    await this.mockUNO.connect(this.signers[0]).approve(
      positionManagerAddress,
      approvalAmount
    )
   
    await this.mockUSDT.connect(this.signers[0]).approve(
      positionManagerAddress,
      approvalAmount
    )

    const { amount0: amount0Desired1, amount1: amount1Desired1 } = position.mintAmounts
    // mintAmountsWithSlippage

    params = {
      token0: address0,
      token1: address1,
      fee: poolData.fee,
      tickLower: nearestUsableTick(poolData.tick, poolData.tickSpacing) - poolData.tickSpacing * 2,
      tickUpper: nearestUsableTick(poolData.tick, poolData.tickSpacing) + poolData.tickSpacing * 2,
      amount0Desired: amount0Desired1.toString(),
      amount1Desired: amount1Desired1.toString(),
      amount0Min: amount0Desired1.toString(),
      amount1Min: amount1Desired1.toString(),
      recipient: this.signers[0].address,
      deadline: Math.floor(Date.now() / 1000) + (60 * 10)
    }

    nonfungiblePositionManagerContract.connect(this.signers[0]).mint(
      params,
      { gasLimit: ethers.toBeHex(1000000) }
    ).then((res) => {
      console.log(res)
    })


    const fee = 3000;
  
    const tick = eventData.tickSpacing;

    await this.mockUNO.approve(poolAddress, amount0Desired);
    await this.mockUSDT.approve(poolAddress, amount1Desired);

    // Add liquidity to the pool
    // const mintTx = await uniswapV3Pool.connect(this.signers[0]).mint(
    //   amount0Desired,
    //   amount1Desired,
    //   10000,
    //   10000,
    //   this.signers[0].address,
    //   ethers.zeroPadValue('0x', 0)
    // );
    // console.log('Liquidity added successfully:', mintTx.hash);

    console.log("Adding liquidity...")


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

    this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired)
    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.mockUNO.target, this.mockUSDT.target);
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
