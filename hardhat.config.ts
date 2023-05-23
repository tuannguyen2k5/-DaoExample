import { HardhatUserConfig } from 'hardhat/config';
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'solidity-coverage';

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      outputSelection: {
        "*": {
          "*": ["evm.bytecode", "evm.gasEstimates", "evm.legacyAssembly"],
          "": ["ast"],
        },
      },
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }    
      },
      viaIR: true,
      
    },
  },
};

export default config;
