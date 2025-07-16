// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Interface for Chainlink price feed
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

// Basic ERC20 interface
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract ReachToken is IERC20 {
    // ERC20 state variables
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;
    string public name = "Reach 9D-RC";
    string public symbol = "9D-RC";
    uint8 public decimals = 18;
    
    // Access control
    address public owner;
    bool public paused = false;
    
    // Reentrancy guard
    bool private _locked = false;
    // Chainlink ETH/USD price feed
    AggregatorV3Interface internal priceFeed;
    
    // Bonding curve parameters
    uint256 public basePrice = 27e18; // $27 USD in wei (18 decimals)
    uint256 public bondingConstant = 1e15; // k parameter for quadratic curve
    uint256 public floorPrice = 27e18; // $27 USD floor price
    uint256 public tokensSold; // Total tokens sold for bonding curve calculation
    
    // Token sale parameters
    uint256 public constant TOKEN_DECIMALS = 18;
    uint256 private constant PRICE_FEED_DECIMALS = 8; // Chainlink ETH/USD decimals
    
    // Staking and governance variables
    mapping(address => uint256) public stakedBalances;
    mapping(address => uint256) public stakingRewards;
    uint256 public totalStaked;
    uint256 public rewardRate = 100; // 1% annual reward rate (100 basis points)
    
    // Buyback variables
    uint256 public buybackReserve;
    bool public buybackEnabled = true;
    
    // Events
    event TokensPurchased(address indexed buyer, uint256 tokens, uint256 ethPaid, uint256 pricePerToken);
    event TokensStaked(address indexed staker, uint256 amount);
    event TokensUnstaked(address indexed staker, uint256 amount);
    event BuybackExecuted(uint256 ethAmount, uint256 tokensBought);
    event PriceParametersUpdated(uint256 basePrice, uint256 bondingConstant, uint256 floorPrice);
    
    constructor(address _priceFeed) {
        owner = msg.sender;
        priceFeed = AggregatorV3Interface(_priceFeed);
        _totalSupply = 1000000 * 10**decimals;
        _balances[address(this)] = _totalSupply; // Initial supply held by contract
        emit Transfer(address(0), address(this), _totalSupply);
    }
    
    // Access control modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }
    
    modifier nonReentrant() {
        require(!_locked, "Reentrant call");
        _locked = true;
        _;
        _locked = false;
    }
    
    // ERC20 implementation
    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }
    
    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }
    
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }
    
    function allowance(address tokenOwner, address spender) public view override returns (uint256) {
        return _allowances[tokenOwner][spender];
    }
    
    function approve(address spender, uint256 amount) public override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address sender, address recipient, uint256 amount) public override returns (bool) {
        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, currentAllowance - amount);
        
        return true;
    }
    
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to != address(0), "ERC20: transfer to zero address");
        require(_balances[from] >= amount, "ERC20: transfer amount exceeds balance");
        
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }
    
    function _approve(address tokenOwner, address spender, uint256 amount) internal {
        require(tokenOwner != address(0), "ERC20: approve from zero address");
        require(spender != address(0), "ERC20: approve to zero address");
        
        _allowances[tokenOwner][spender] = amount;
        emit Approval(tokenOwner, spender, amount);
    }
    
    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to zero address");
        
        _totalSupply += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }
    
    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from zero address");
        require(_balances[account] >= amount, "ERC20: burn amount exceeds balance");
        
        _balances[account] -= amount;
        _totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }
    
    /**
     * @dev Get the latest ETH/USD price from Chainlink
     * @return price ETH/USD price with 8 decimals
     */
    function getLatestETHPrice() public view returns (uint256) {
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price feed");
        return uint256(price);
    }
    
    /**
     * @dev Calculate token price using bonding curve
     * @return price Token price in USD (18 decimals)
     */
    function getBondingCurvePrice() public view returns (uint256) {
        // Quadratic bonding curve: price = basePrice + k * (tokensSold^2)
        uint256 curveComponent = (bondingConstant * tokensSold * tokensSold) / 1e18;
        return basePrice + curveComponent;
    }
    
    /**
     * @dev Get current token price considering all factors
     * @return price Token price in USD (18 decimals)
     */
    function getCurrentTokenPrice() public view returns (uint256) {
        uint256 curvePrice = getBondingCurvePrice();
        
        // Convert Chainlink ETH/USD to USD per token format
        uint256 ethUsdPrice = getLatestETHPrice(); // 8 decimals
        uint256 chainlinkFloor = (floorPrice * 1e8) / ethUsdPrice; // Convert to ETH terms then back to USD
        
        // Return the highest of: curve price, chainlink reference, or floor price
        uint256 maxPrice = curvePrice;
        if (chainlinkFloor > maxPrice) maxPrice = chainlinkFloor;
        if (floorPrice > maxPrice) maxPrice = floorPrice;
        
        return maxPrice;
    }
    
    /**
     * @dev Calculate ETH required for token purchase
     * @param tokenAmount Number of tokens to purchase
     * @return ethRequired ETH amount required
     */
    function calculateETHRequired(uint256 tokenAmount) public view returns (uint256) {
        uint256 tokenPriceUSD = getCurrentTokenPrice(); // USD price per token (18 decimals)
        uint256 totalUSD = (tokenPriceUSD * tokenAmount) / 1e18; // Total USD needed
        uint256 ethUsdPrice = getLatestETHPrice(); // ETH/USD price (8 decimals)
        
        // Convert USD to ETH: totalUSD * 1e8 / ethUsdPrice * 1e18 / 1e18
        return (totalUSD * 1e8) / ethUsdPrice;
    }
    
    /**
     * @dev Buy tokens with ETH
     * @param minTokens Minimum tokens to receive (slippage protection)
     */
    function buyTokens(uint256 minTokens) external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Must send ETH");
        require(minTokens > 0, "Invalid token amount");
        
        uint256 ethUsdPrice = getLatestETHPrice();
        uint256 tokenPriceUSD = getCurrentTokenPrice();
        
        // Calculate tokens that can be bought with sent ETH
        uint256 ethValueUSD = (msg.value * ethUsdPrice) / 1e8; // Convert ETH to USD
        uint256 tokensToMint = (ethValueUSD * 1e18) / tokenPriceUSD; // Calculate tokens
        
        require(tokensToMint >= minTokens, "Insufficient ETH for requested tokens");
        require(balanceOf(address(this)) >= tokensToMint, "Insufficient token supply");
        
        // Update tokens sold for bonding curve
        tokensSold += tokensToMint;
        
        // Transfer tokens from contract to buyer
        _transfer(address(this), msg.sender, tokensToMint);
        
        // Allocate portion to buyback reserve
        uint256 buybackAmount = msg.value / 10; // 10% to buyback
        buybackReserve += buybackAmount;
        
        emit TokensPurchased(msg.sender, tokensToMint, msg.value, tokenPriceUSD);
    }
    
    /**
     * @dev Stake tokens for rewards
     * @param amount Amount of tokens to stake
     */
    function stakeTokens(uint256 amount) external whenNotPaused {
        require(amount > 0, "Invalid amount");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Calculate pending rewards before updating stake
        _updateStakingRewards(msg.sender);
        
        _transfer(msg.sender, address(this), amount);
        stakedBalances[msg.sender] += amount;
        totalStaked += amount;
        
        emit TokensStaked(msg.sender, amount);
    }
    
    /**
     * @dev Unstake tokens
     * @param amount Amount of tokens to unstake
     */
    function unstakeTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(stakedBalances[msg.sender] >= amount, "Insufficient staked balance");
        
        // Calculate and distribute pending rewards
        _updateStakingRewards(msg.sender);
        
        stakedBalances[msg.sender] -= amount;
        totalStaked -= amount;
        _transfer(address(this), msg.sender, amount);
        
        emit TokensUnstaked(msg.sender, amount);
    }
    
    /**
     * @dev Execute buyback using reserve funds
     */
    function executeBuyback() external onlyOwner {
        require(buybackEnabled, "Buyback disabled");
        require(buybackReserve > 0, "No buyback funds");
        
        uint256 ethAmount = buybackReserve;
        buybackReserve = 0;
        
        // Calculate tokens to buy back
        uint256 tokensToDestroy = (ethAmount * getLatestETHPrice()) / (getCurrentTokenPrice() * 1e8 / 1e18);
        
        if (tokensToDestroy > 0 && balanceOf(address(this)) >= tokensToDestroy) {
            _burn(address(this), tokensToDestroy);
            emit BuybackExecuted(ethAmount, tokensToDestroy);
        }
    }
    
    /**
     * @dev Update staking rewards for an address
     */
    function _updateStakingRewards(address staker) internal {
        if (stakedBalances[staker] > 0) {
            // Simple time-based reward calculation (simplified for this example)
            uint256 reward = (stakedBalances[staker] * rewardRate) / 10000;
            stakingRewards[staker] += reward;
        }
    }
    
    /**
     * @dev Claim staking rewards
     */
    function claimRewards() external nonReentrant {
        _updateStakingRewards(msg.sender);
        uint256 reward = stakingRewards[msg.sender];
        require(reward > 0, "No rewards available");
        
        stakingRewards[msg.sender] = 0;
        _mint(msg.sender, reward);
    }
    
    /**
     * @dev Owner function to withdraw ETH
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        payable(owner).transfer(amount);
    }
    
    /**
     * @dev Owner function to update price parameters
     */
    function updatePriceParameters(
        uint256 _basePrice,
        uint256 _bondingConstant,
        uint256 _floorPrice
    ) external onlyOwner {
        require(_basePrice > 0, "Invalid base price");
        require(_floorPrice > 0, "Invalid floor price");
        
        basePrice = _basePrice;
        bondingConstant = _bondingConstant;
        floorPrice = _floorPrice;
        
        emit PriceParametersUpdated(_basePrice, _bondingConstant, _floorPrice);
    }
    
    /**
     * @dev Toggle buyback functionality
     */
    function toggleBuyback() external onlyOwner {
        buybackEnabled = !buybackEnabled;
    }
    
    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        paused = true;
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        paused = false;
    }
    
    /**
     * @dev Get contract info for frontend
     */
    function getContractInfo() external view returns (
        uint256 currentPrice,
        uint256 totalTokensSold,
        uint256 ethPrice,
        uint256 contractBalance,
        uint256 buybackReserveAmount
    ) {
        return (
            getCurrentTokenPrice(),
            tokensSold,
            getLatestETHPrice(),
            balanceOf(address(this)),
            buybackReserve
        );
    }
}