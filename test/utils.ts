import { Contract } from "ethers";
import {network,ethers} from "hardhat"

const rpc = <T = unknown>({
  method,
  params,
}: {
  method: string;
  params?: unknown[];
}): Promise<T> => {
  return network.provider.send(method, params);
};
// export function toBigInt(x: NumberLike): bigint {
//   return BigInt(toRpcQuantity(x));
// }

// export function toRpcQuantity(x: NumberLike): string {
//   let hex: string;
//   if (typeof x === "number" || typeof x === "bigint") {
//     // TODO: check that number is safe
//     hex = `0x${x.toString(16)}`;
//   } else if (typeof x === "string") {
    
//     hex = x;
//   } else if ("toHexString" in x) {
//     hex = x.toHexString();
//   } else if ("toString" in x) {
//     hex = x.toString(16);
//   } 

//   if (hex === "0x0") return hex;

//   return hex.startsWith("0x") ? hex.replace(/0x0+/, "0x") : `0x${hex}`;
// }
export const setTotalSupply = async (token: Contract, newTotalSupply: number): Promise<void> => {
    const totalSupply = (await token.totalSupply()).toNumber();
  
    if (totalSupply < newTotalSupply) {
      for (let i = 0; i < newTotalSupply - totalSupply; i++) {
        await token._mint();
      }
      // If Nounder's reward tokens were minted totalSupply will be more than expected, so run setTotalSupply again to burn extra tokens
      await setTotalSupply(token, newTotalSupply);
    }
  
    if (totalSupply > newTotalSupply) {
      for (let i = newTotalSupply; i < totalSupply; i++) {
        await token.burn(i);
      }
    }
  };
  export const minerStop = async (): Promise<void> => {
    await network.provider.send('evm_setAutomine', [false]);
    await network.provider.send('evm_setIntervalMining', [0]);
  };
  export const mineBlock = async (): Promise<void> => {
    await network.provider.send('evm_mine');
  };
  export const minerStart = async (): Promise<void> => {
    await network.provider.send('evm_setAutomine', [true]);
  };
  export const blockNumber = async (parse = true): Promise<number> => {
    const result = await rpc<number>({ method: 'eth_blockNumber' });
    return parse ? parseInt(result.toString()) : result;
  };
  export const advanceBlocks = async (blocks: number): Promise<void> => {
    for (let i = 0; i < blocks; i++) {
      await mineBlock();
    }
  };
  export const increaseTime = async (seconds: number): Promise<unknown> => {
    
    await rpc({ method: 'evm_increaseTime', params: [seconds] });
    return rpc({ method: 'evm_mine' });
  };
  export const freezeTime = async (seconds: number): Promise<unknown> => {
    await rpc({ method: 'evm_setNextBlockTimestamp', params: [ seconds] });
    return rpc({ method: 'evm_mine' });
  };
  
  export const address = (n: number): string => {
    return `0x${n.toString(16).padStart(40, '0')}`;
  };
  export const encodeParameters = (types: string[], values: unknown[]): string => {
    const abi = new ethers.utils.AbiCoder();
    return abi.encode(types, values);
  };
 
  