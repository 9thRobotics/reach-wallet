# Reach Wallet - ReachToken with Bonding Curve

This repository contains the ReachToken smart contract with a demand-based bonding curve pricing model, along with a frontend interface for token purchases.

## Features

### Smart Contract (ReachToken.sol)
- **Bonding Curve Pricing**: Quadratic pricing model `price = basePrice + k * (tokensSold^2)`
- **Chainlink Integration**: Uses ETH/USD price feed for floor price protection
- **Dynamic Pricing**: Token price increases with demand (tokens sold)
- **Floor Price Protection**: Price never drops below $27 USD or Chainlink reference
- **Owner Functions**: ETH withdrawal, governance controls, parameter updates
- **Staking System**: Token staking with rewards
- **Buyback Mechanism**: Automated token buyback and burn
- **Pausable**: Emergency pause functionality
- **Reentrancy Protection**: Security against reentrancy attacks

### Pricing Logic
The contract uses the highest value among:
1. Bonding curve price: `basePrice + bondingConstant * (tokensSold^2)`
2. Chainlink ETH/USD reference price
3. Floor price ($27 USD)

### Frontend Interface
- **Dynamic Price Display**: Shows current token price and tokens sold
- **Real-time Estimates**: ETH cost calculation with current pricing
- **Enhanced UI**: Price information updates every 30 seconds
- **Slippage Protection**: Extra ETH buffer for price movement during transactions

## Quick Start

### Prerequisites
- Node.js and npm
- Hardhat for smart contract development

### Installation
```bash
npm install
```

### Compile Contracts
```bash
npx hardhat compile
```

### Run Tests
```bash
npx hardhat test
```

### Deploy
```bash
npx hardhat run scripts/deploy.js --network <network>
```

## Contract Addresses
- **Current Seller**: `0x0557afA4318989702376D50B45547F953B7f9B21`
- **Token Address**: `0x41a61cdcf40a074546423bae987b81733f3fbac5`
- **Chainlink ETH/USD**: `0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419`

## Configuration

### Price Parameters
- Base Price: $27 USD (18 decimals)
- Bonding Constant: 1e15 (adjustable)
- Floor Price: $27 USD (18 decimals)

### Frontend Configuration
Update constants in `index.html`:
```javascript
const SELLER_ADDRESS = "0x..."; // Your deployed contract
const TOKEN_ADDRESS  = "0x..."; // Your token contract
const CHAINLINK_FEED = "0x5f4ec3df9cbd43714fe2740f5e3616155c5b8419";
```

## Usage

### For Users
1. Open `index.html` in a web browser
2. Connect MetaMask or compatible wallet
3. Enter desired token amount
4. Review price and ETH cost
5. Confirm purchase

### For Developers
The contract provides several view functions:
- `getCurrentTokenPrice()`: Get current USD price per token
- `getBondingCurvePrice()`: Get bonding curve component
- `calculateETHRequired(amount)`: Calculate ETH needed for purchase
- `getContractInfo()`: Get comprehensive contract state

## Security Features
- Reentrancy protection on all state-changing functions
- Owner-only administrative functions
- Pausable contract for emergency situations
- Minimum token validation
- Slippage protection for buyers

## Testing
The test suite covers:
- Bonding curve price calculations
- Floor price enforcement
- Purchase functionality
- Access controls
- Pause/unpause mechanics

Run tests: `npx hardhat test`

## License
MIT License
