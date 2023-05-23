import chai from 'chai';
import hardhat from 'hardhat';

const { ethers } = hardhat;

import { BigNumber, Contract } from 'ethers';

import { address, encodeParameters, mineBlock, advanceBlocks, freezeTime, blockNumber, increaseTime } from './utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

const { expect } = chai;

let exampleDAOExecutor;
let timelock: Contract;
let contractDAO;
let exampleDAOContract: Contract;
let token;
let tokenDAO: Contract;
let deployer: SignerWithAddress;
let account0: SignerWithAddress;
let account1: SignerWithAddress;
let account2: SignerWithAddress;
let account3: SignerWithAddress;

let vetoer: string = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


const votingDelay = 1;
const votingPeriod = 17280; //3 days
const proposalThresholdBPS = 900; // 9%
const quorumVotesBPS = 1000; // 10%
describe('DAOExample#state', () => {
  let proposalId: BigNumber
  let targets, values, signatures, calldatas

  before(async () => {

    [deployer, account0, account1, account2, account3] = await ethers.getSigners();
    exampleDAOExecutor = await ethers.getContractFactory("DAOExampleExecutorHarness");
    timelock = await exampleDAOExecutor.deploy(account1.address, 2 * 86400)

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

    await tokenDAO.transfer(account1.address, 400001);
    await tokenDAO.connect(account1).delegate(account1.address);

    targets = [deployer.address];
    values = ["0"];
    signatures = ["getBalanceOf(address)"];
    calldatas = [encodeParameters(['address'], [account1.address])];
    await tokenDAO.delegate(deployer.address)

    await exampleDAOContract.propose(targets, values, signatures, calldatas, 'do nothing')
    proposalId = await exampleDAOContract.latestProposalIds(deployer.address)
  })
  // enum ProposalState {
  //     Pending,
  //     Active,
  //     Canceled,
  //     Defeated,
  //     Succeeded,
  //     Queued,
  //     Expired,
  //     Executed,
  //     Vetoed
  // }

  it("Invalid for proposal not found", async () => {
      await expect(exampleDAOContract.state(BigNumber.from(5))).to.be.revertedWith("DAO Token::state: invalid proposal id");
    })

    it("Pending", async () => {
       expect(await exampleDAOContract.state(proposalId)).to.equal(0);
    })

    it("Active", async () => {
      await mineBlock()
      await mineBlock()
      expect(await exampleDAOContract.state(proposalId)).to.equal(1);
    })
    it("Cancel",async () =>{
      let actor = account3
          await tokenDAO.transfer(actor.address, 400001);
          await tokenDAO.connect(actor).delegate(actor.address);

          await exampleDAOContract.connect(actor).propose(targets, values, signatures, calldatas, 'do nothing')
          const proposalId = await exampleDAOContract.latestProposalIds(actor.address)
          await mineBlock()
          await expect(exampleDAOContract.connect(actor).cancel(proposalId))
              .to.emit(exampleDAOContract, "ProposalCanceled")
              .withArgs(proposalId);
              expect(await exampleDAOContract.state(proposalId)).to.equal(2);
    })
    it("Defeated", async () => {
      // travel to end block
      await advanceBlocks(20000)

      expect(await exampleDAOContract.state(proposalId)).to.equal(3);
    })
    it("Succeeded", async () => {

      await mineBlock()
      await exampleDAOContract.connect(account1).propose(targets, values, signatures, calldatas, 'do nothing')
      const newProposalId = await exampleDAOContract.latestProposalIds(account1.address)
      await mineBlock()
      await exampleDAOContract.connect(account1).castVote(newProposalId, 1);
      await advanceBlocks(20000);

      expect(await exampleDAOContract.state(newProposalId)).to.equal(4);
    })
    it("Queued", async () => {
      await mineBlock()
      await exampleDAOContract.connect(account1).propose(targets, values, signatures, calldatas, 'do nothing')
      const newProposalId = await exampleDAOContract.latestProposalIds(account1.address)
      await mineBlock()
      await exampleDAOContract.connect(account1).castVote(newProposalId, 1);
      await advanceBlocks(20000)

      await exampleDAOContract.connect(account1).queue(newProposalId);
      expect(await exampleDAOContract.state(newProposalId)).to.equal(5);

    })
  it("Expired", async () => {
    await mineBlock()
    await exampleDAOContract.connect(account1).propose(targets, values, signatures, calldatas, 'do nothing')
    const newProposalId = await exampleDAOContract.latestProposalIds(account1.address)
    await mineBlock()
    await exampleDAOContract.connect(account1).castVote(newProposalId, 1);
    await advanceBlocks(20000)

    await increaseTime(1)
    await exampleDAOContract.connect(account1).queue(newProposalId);
    const gracePeriod = await timelock.GRACE_PERIOD()
    const proposal = await exampleDAOContract.proposals(newProposalId)
    const eta = BigNumber.from(proposal.eta)
    
    await freezeTime((eta.add(gracePeriod).sub(1)).toNumber());    

    expect(await exampleDAOContract.state(newProposalId)).to.equal(5);

    await freezeTime(eta.add(gracePeriod).toNumber())
    expect(await exampleDAOContract.state(newProposalId)).to.equal(6);
  })
  it("Executed", async () => {
    await mineBlock()
    await exampleDAOContract.connect(account1).propose(targets, values, signatures, calldatas, 'do nothing')
    const newProposalId = await exampleDAOContract.latestProposalIds(account1.address)
    await mineBlock()
    await exampleDAOContract.connect(account1).castVote(newProposalId, 1);
    await advanceBlocks(20000)

    await increaseTime(1)
    await exampleDAOContract.connect(account1).queue(newProposalId)
      const gracePeriod = await timelock.GRACE_PERIOD()
    const proposal = await exampleDAOContract.proposals(newProposalId)
    const eta = BigNumber.from(proposal.eta)

    await freezeTime((eta.add(gracePeriod).sub(10)).toNumber()); 


    expect(await exampleDAOContract.state(newProposalId)).to.equal(5);
    
    await exampleDAOContract.connect(account1).execute(newProposalId)

    expect(await exampleDAOContract.state(newProposalId)).to.equal(7);

  })
  it("Vetoed",async () =>{
    await mineBlock()
    await exampleDAOContract.connect(account1).propose(targets, values, signatures, calldatas, 'do nothing')
    const newProposalId = await exampleDAOContract.latestProposalIds(account1.address)
    await mineBlock()
    await exampleDAOContract.connect(account1).castVote(newProposalId, 1);
    await advanceBlocks(20000)

    await increaseTime(1)
    await exampleDAOContract.connect(account1).queue(newProposalId)
  })
})