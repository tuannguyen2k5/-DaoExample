import chai from 'chai';
import hardhat from 'hardhat';

const { ethers } = hardhat;

import {  Contract } from 'ethers';
import { BigNumber as EthersBN } from 'ethers';

import { address, blockNumber, encodeParameters, mineBlock } from './utils';
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


describe('DAOToken#castVote', () => {
    let proposalId: EthersBN;
    let targets, values, signatures, callDatas

  before(async () => {
    
    [deployer, account0, account1, account2,account3] = await ethers.getSigners();
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
    targets = [address(0)];
    values = ['0'];
    signatures = ['getBalanceOf(address)'];
    callDatas = [encodeParameters(['address'], [address(0)])];
    await exampleDAOContract.propose(targets, values, signatures, callDatas, 'do nothing')
    proposalId = await exampleDAOContract.latestProposalIds(deployer.address)
  })
  describe("We must revert if:", () => {
    it("There does not exist a proposal with matching proposal id where the current block number is between the proposal's start block (exclusive) and end block (inclusive)", async () => {
        
        await expect(
            exampleDAOContract.connect(deployer).castVote(proposalId,1)
          ).to.be.revertedWith("DAO Token::castVoteInternal: voting is closed"); 
    });
    it("cast vote with invalid type",async () =>{
      await expect(
        exampleDAOContract.connect(deployer).castVote(proposalId,4)
      ).to.be.revertedWith("DAO Token::castVoteInternal: invalid vote type"); 
    })
    it("Such proposal already has an entry in its voters set matching the sender", async () => {
        await mineBlock();
        await mineBlock();
  
        await exampleDAOContract.connect(account2).castVote(proposalId,1)
       
        await expect(
            exampleDAOContract.connect(account2).castVote(proposalId,1)
            ).to.be.revertedWith("DAO Token::castVoteInternal: voter already voted"); 
      });
  });
  describe('Otherwise', () => {
    it("we add the sender to the proposal's voters set", async () => {
      const voteReceipt1 = await exampleDAOContract.getReceipt(proposalId, account1.address);
      expect(voteReceipt1.hasVoted).to.equal(false)

      await exampleDAOContract.connect(account1).castVote(proposalId, 1);
      const voteReceipt2 = await exampleDAOContract.getReceipt(proposalId, account1.address);
      expect(voteReceipt2.hasVoted).to.equal(true);
    });

    describe("and we take the balance returned by GetPriorVotes for the given sender and the proposal's start block, which may be zero,", () => {

      it('and we add that ForVotes', async () => {

       let actor = account3
       await tokenDAO.transfer(actor.address, 400001);
       await tokenDAO.connect(actor).delegate(actor.address);
       
       await exampleDAOContract.connect(actor).propose(targets, values, signatures, callDatas, 'do nothing')
       proposalId = await exampleDAOContract.latestProposalIds(actor.address)
      
        const beforeFors = (await exampleDAOContract.proposals(proposalId)).forVotes;
        await mineBlock();
        await exampleDAOContract.connect(actor).castVote(proposalId, 1);

        const afterFors = (await exampleDAOContract.proposals(proposalId)).forVotes;

        expect(afterFors).to.equal(beforeFors.add(400001));
      });

      it("or AgainstVotes corresponding to the caller's support flag.", async () => {
        let actor = account1;
        await tokenDAO.transfer(actor.address, 400001);
       await tokenDAO.connect(actor).delegate(actor.address);

       await exampleDAOContract.connect(actor).propose(targets, values, signatures, callDatas, 'do nothing')

       proposalId = await exampleDAOContract.latestProposalIds(actor.address)
        
        const beforeAgainst = (await exampleDAOContract.proposals(proposalId)).againstVotes;

        await mineBlock();
        await exampleDAOContract.connect(actor).castVote(proposalId, 0);

        const afterAgainst = (await exampleDAOContract.proposals(proposalId)).againstVotes;

        expect(afterAgainst).to.equal(beforeAgainst.add(400001));
      });
    });
    
    });

});
