import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chai from 'chai';
import { ethers } from 'hardhat';


import {
  address,
  blockNumber,
  encodeParameters
} from './utils';
import { Contract } from 'ethers';

const { expect } = chai;


let exampleDAOExecutor;
let timelock: Contract;
let contractDAO;
let exampleDAOContract: Contract;
let token;
let tokenDAO: Contract;

let account0: SignerWithAddress;
let account1: SignerWithAddress;
let account2: SignerWithAddress;
let account3: SignerWithAddress;
let deployer: SignerWithAddress;
let vetoer: string = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


const votingDelay = 288; //1 hour
const votingPeriod = 17280; //3 days
const proposalThresholdBPS = 900; // 9%
const quorumVotesBPS = 1000; // 10%

describe('DAOExample#propose', async () => {
  beforeEach(async () => {
    [deployer, account0, account1, account2, account3] = await ethers.getSigners();
    exampleDAOExecutor = await ethers.getContractFactory("DAOExampleExecutorHarness");
    timelock = await exampleDAOExecutor.deploy('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',4 *86400)

    token = await ethers.getContractFactory("DAOToken");
    tokenDAO = await token.deploy(deployer.address)
    await tokenDAO.delegate(deployer.address)

    contractDAO = await ethers.getContractFactory("DAOExampleLogicV1")
    exampleDAOContract = await contractDAO.deploy()
    await timelock.harnessSetAdmin(exampleDAOContract.address)

    await exampleDAOContract.initialize(
        timelock.address,
        tokenDAO.address,
        vetoer,
        votingPeriod,
        votingDelay,
        proposalThresholdBPS,
        quorumVotesBPS,
      );

  });
 
    it("initialize correctly", async () => {
     // Check that variables were set correctly
     expect(await exampleDAOContract.timelock()).to.equal(timelock.address);
     expect(await exampleDAOContract.nouns()).to.equal(tokenDAO.address);
     expect(await exampleDAOContract.vetoer()).to.equal(vetoer);
     expect(await exampleDAOContract.votingPeriod()).to.equal(votingPeriod);
     expect(await exampleDAOContract.votingDelay()).to.equal(votingDelay);
     expect(await exampleDAOContract.proposalThresholdBPS()).to.equal(proposalThresholdBPS);
     expect(await exampleDAOContract.quorumVotesBPS()).to.equal(quorumVotesBPS);
    });

  it('emits ProposalCreated', async () => {
    const targets = [address(0)];
    const values = ['0'];
    const signatures = ['getBalanceOf(address)'];
    const callDatas = [encodeParameters(['address'], [address(0)])];

    const blockNum = await blockNumber();

    await expect(
      exampleDAOContract.connect(deployer).propose(targets, values, signatures, callDatas, 'do nothing'),
    )
      .to.emit(exampleDAOContract, 'ProposalCreated')
      .withArgs(
        1,
        deployer.address,
        targets,
        values,
        signatures,
        callDatas,
        votingDelay + blockNum + 1,
        votingPeriod + votingDelay + blockNum + 1,
        'do nothing',
      );
  });
  describe("This function must revert if", () => {
    it("the length of the values, signatures or calldatas arrays are not the same length,", async () => {
        
      const targets = [address(0)];
      const values = ['0'];
      const signatures = ['getBalanceOf(address)'];
      const callDatas = [encodeParameters(['address'], [address(0)])];
  
      const blockNum = await blockNumber();
        await expect(
          exampleDAOContract.connect(deployer).propose(targets.concat(deployer.address), values, signatures, callDatas, 'do nothing'),
        ).to.be.revertedWith("DAO Token::propose: proposal function information arity mismatch");
        await expect(
          exampleDAOContract.connect(deployer).propose(targets, values.concat(values), signatures, callDatas, 'do nothing'),
        ).to.be.revertedWith("DAO Token::propose: proposal function information arity mismatch");
        await expect(
          exampleDAOContract.connect(deployer).propose(targets, values, signatures.concat(signatures), callDatas, 'do nothing'),
        ).to.be.revertedWith("DAO Token::propose: proposal function information arity mismatch");
        await expect(
          exampleDAOContract.connect(deployer).propose(targets, values, signatures, callDatas.concat(callDatas), 'do nothing'),
        ).to.be.revertedWith("DAO Token::propose: proposal function information arity mismatch");

    });

    it("or if that length is zero or greater than Max Operations.", async () => {
        await expect(
            exampleDAOContract.connect(deployer).propose([], [], [], [], 'do nothing'),
          ).to.be.revertedWith("DAO Token::propose: must provide actions");
    });
});
});
