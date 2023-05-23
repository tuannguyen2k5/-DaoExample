import chai from 'chai';
import hardhat from 'hardhat';

const { ethers } = hardhat;

import { Contract } from 'ethers';
import { BigNumber as EthersBN } from 'ethers';

import { address, encodeParameters, mineBlock, advanceBlocks, freezeTime, blockNumber } from './utils';
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
describe('DAOExample#queue', () => {

    beforeEach(async () => {

        [deployer, account0, account1, account2, account3] = await ethers.getSigners();
        exampleDAOExecutor = await ethers.getContractFactory("DAOExampleExecutorHarness");
        timelock = await exampleDAOExecutor.deploy('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 2 * 86400)

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

    })
    describe('Overlapping actions', () => {
        it("reverts on queueing overlapping actions in same proposal", async () => {
            let actor = account2
            await tokenDAO.transfer(actor.address, 400001);
            await tokenDAO.connect(actor).delegate(actor.address);

            const targets = [tokenDAO.address, tokenDAO.address];
            const values = ["0", "0"];
            const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
            const calldatas = [encodeParameters(['address'], [deployer.address]), encodeParameters(['address'], [deployer.address])];

            await exampleDAOContract.connect(actor).propose(targets, values, signatures, calldatas, 'do nothing')
            const proposalId = await exampleDAOContract.latestProposalIds(actor.address)

            await mineBlock();
            await exampleDAOContract.connect(actor).castVote(proposalId, 1);

            await advanceBlocks(20000);
            await expect(
                exampleDAOContract.queue(proposalId),
            ).to.be.revertedWith("DAO Token::queueOrRevertInternal: identical proposal action already queued at eta");

        })
        it('should cancel a proposal', async function () {
            let actor = account3
            await tokenDAO.transfer(actor.address, 400001);
            await tokenDAO.connect(actor).delegate(actor.address);

            const targets = [tokenDAO.address, tokenDAO.address];
            const values = ["0", "0"];
            const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
            const calldatas = [encodeParameters(['address'], [deployer.address]), encodeParameters(['address'], [deployer.address])];

            await exampleDAOContract.connect(actor).propose(targets, values, signatures, calldatas, 'do nothing')
            const proposalId = await exampleDAOContract.latestProposalIds(actor.address)
            await mineBlock()
            await expect(exampleDAOContract.connect(actor).cancel(proposalId))
                .to.emit(exampleDAOContract, "ProposalCanceled")
                .withArgs(proposalId);

            const proposal = await exampleDAOContract.proposals(proposalId);

            expect(proposal.canceled).to.be.true
        });
        
    })
    // describe('execute', () => {
    //     it('should execute proposal', async () =>{
    //         let actor = account1
    //         await tokenDAO.transfer(actor.address, 400001);
    //         await tokenDAO.connect(actor).delegate(actor.address);

    //         const targets = [tokenDAO.address, tokenDAO.address];
    //         const values = ["1", "4"];
    //         const signatures = ["getBalanceOf(address)", "getBalanceOf(address)"];
    //         const calldatas = [encodeParameters(['address'], [deployer.address]), encodeParameters(['address'], [deployer.address])];

    //         await exampleDAOContract.connect(actor).propose(targets, values, signatures, calldatas, 'do nothing')
    //         const proposalId = await exampleDAOContract.latestProposalIds(actor.address)

    //         await mineBlock();
    //         await exampleDAOContract.connect(actor).castVote(proposalId, 1);
    //         await advanceBlocks(20000);

    //         await exampleDAOContract.connect(actor).queue(proposalId);
    //         const gracePeriod = await timelock.GRACE_PERIOD()
    //         const proposal = await exampleDAOContract.proposals(proposalId)
    //         const eta = proposal.eta
    //         console.log(gracePeriod,eta)
            
    //         await freezeTime(eta +gracePeriod-1)
    //         await expect(exampleDAOContract.connect(actor).execute(proposalId))
    //         .to.emit(exampleDAOContract, "ProposalExecuted")
    //         .withArgs(proposalId);
    //     })
    // })
})