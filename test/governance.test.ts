import chai from 'chai';
import { ethers } from 'hardhat';

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

import { Contract } from 'ethers';

import { mineBlock, minerStart, minerStop,address } from './utils';
const { expect } = chai;


describe('DAO Token', () => {
    let token;
    let tokenDAO: Contract;
    let tokenCallFromGuy: Contract;
    let tokenCallFromDeployer: Contract;
    let account0: SignerWithAddress;
    let account1: SignerWithAddress;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let deployer: SignerWithAddress;


    const Domain = (name: string, verifyingContract: string, chainId: number) => ({
        name,
        chainId,
        verifyingContract,
    });

    let domain: { name: string; verifyingContract: string; chainId: number };

    const Types = {
        Delegation: [
            { name: 'delegatee', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'expiry', type: 'uint256' },
        ],
    };

    beforeEach(async () => {
        [deployer, account0, account1, account2, account3] = await ethers.getSigners();
        const network = await ethers.provider.getNetwork()

        token = await ethers.getContractFactory("DAOToken");
        tokenDAO = await token.deploy(deployer.address)

        domain = Domain('DAO Token', tokenDAO.address, network.chainId);

        tokenCallFromGuy = tokenDAO.connect(account2);
        tokenCallFromDeployer = tokenDAO;
        const balance = await tokenCallFromDeployer.balanceOf(deployer.address)
    });
    describe('governance token', () => {
        it('has given name', async () => {
          expect(await tokenDAO.name()).to.equal("DAO Token");
        });
    
        it('has given symbol', async () => {
          expect(await tokenDAO.symbol()).to.equal("DAO");
        });
      });
    
      describe('balanceOf', () => {
        it('grants to initial account', async () => {
          expect(await tokenDAO.balanceOf(deployer.address)).to.equal("10000000000000000000000000");
        });
      });

    describe('allowance',() =>{
      it('should return the correct allowance for the spender', async () => {
        const expectedAllowance = 100;
        await tokenDAO.approve(account1.address, expectedAllowance, { from: deployer.address });
    
        const allowance = await tokenDAO.allowance(deployer.address, account1.address);
        expect(allowance).to.equal(expectedAllowance);
      });
    
      it('should return 0 allowance for a spender with no allowance', async () => {
        const allowance = await tokenDAO.allowance(deployer.address, account1.address);
        expect(allowance).to.equal(0);
      });
    })

    describe('approve',() =>{
      it('should update the allowance for the spender', async () => {
        const initialAllowance = 0;
        const newAllowance = 100;
    
        await tokenDAO.approve(account1.address, initialAllowance, { from: deployer.address });
        let allowance = await tokenDAO.allowance(deployer.address, account1.address);
        expect(allowance).to.equal(initialAllowance);
    
        await tokenDAO.approve(account1.address, newAllowance, { from: deployer.address });
        allowance = await tokenDAO.allowance(deployer.address, account1.address);
        expect(allowance).to.equal(newAllowance);

      });
    
      it('should emit an Approval event', async () => {
        const newAllowance = 100;
    
        await expect(
          tokenDAO.approve(account1.address, newAllowance, { from: deployer.address }),
        )
          .to.emit(tokenDAO, 'Approval')
          .withArgs(
            deployer.address,account1.address,newAllowance
          );
        
      });
    })

    describe('transfer',() =>{
      it("should transfer tokens successfully", async function () {
        const initialBalance = await tokenDAO.balanceOf(deployer.address);
    
        const amount = ethers.utils.parseEther("10");
    
        // Transfer tokens from owner to recipient
        await tokenDAO.transfer(account2.address, amount);
    
        const finalBalanceOwner = await tokenDAO.balanceOf(deployer.address);
        const finalBalanceRecipient = await tokenDAO.balanceOf(account2.address);
        // Check balances
        expect(finalBalanceOwner).to.equal(initialBalance.sub(amount));
        expect(finalBalanceRecipient).to.equal(amount);     
      });
    
    })

    describe('delegateBySig', () => {
        it('reverts if the signatory is invalid', async () => {
            const delegatee = account1.address,
                nonce = 0,
                expiry = 0;
            const badhex = '0xbad0000000000000000000000000000000000000000000000000000000000000';
            await expect(
                tokenDAO.delegateBySig(delegatee, nonce, expiry, 0, badhex, badhex),
            ).to.be.revertedWith('DAO Token::delegateBySig: invalid signature');
        });

        it('reverts if the nonce is bad ', async () => {
            const delegatee = account1.address,
                nonce = 1,
                expiry = 0;
            const signature = await account0._signTypedData(domain, Types, { delegatee, nonce, expiry });
            const { v, r, s } = ethers.utils.splitSignature(signature);
            await expect(tokenDAO.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith(
                'DAO Token::delegateBySig: invalid nonce',
            );
        });

        it('reverts if the signature has expired', async () => {
            const delegatee = account1.address,
                nonce = 0,
                expiry = 0;
            const signature = await account0._signTypedData(domain, Types, { delegatee, nonce, expiry });
            const { v, r, s } = ethers.utils.splitSignature(signature);
            await expect(tokenDAO.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith(
                'DAO Token::delegateBySig: signature expired',
            );
        });

        it('delegates on behalf of the signatory', async () => {
            const delegatee = account1.address,
                nonce = 0,
                expiry = 10e9;
            const signature = await account0._signTypedData(domain, Types, { delegatee, nonce, expiry });
            const { v, r, s } = ethers.utils.splitSignature(signature);

            expect(await tokenDAO.delegates(account0.address)).to.equal(address(0));

            const tx = await (await tokenDAO.delegateBySig(delegatee, nonce, expiry, v, r, s)).wait();

            expect(tx.gasUsed.toNumber() < 80000);
            expect(await tokenDAO.delegates(account0.address)).to.equal(account1.address);
        });
    });
    describe('numCheckpoints', () => {

        it('returns the number of checkpoints for a delegate', async () => {

            await tokenDAO.transfer(account2.address, 100);

            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(0);

            const t1 = await tokenCallFromGuy.delegate(account1.address);
            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(1);
            const t2 = await tokenCallFromGuy.transfer(account3.address, 10);
            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(2);

            const t3 = await tokenCallFromGuy.transfer(account3.address, 10);
            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(3);

            const t4 = await tokenCallFromDeployer.transfer(account2.address, 20);
            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(4);

            const checkpoint0 = await tokenDAO.checkpoints(account1.address, 0);
            expect(checkpoint0.fromBlock).to.equal(t1.blockNumber);
            expect(checkpoint0.votes.toString()).to.equal('100');

            const checkpoint1 = await tokenDAO.checkpoints(account1.address, 1);

            expect(checkpoint1.fromBlock).to.equal(t2.blockNumber);
            expect(checkpoint1.votes.toString()).to.equal('90');

            const checkpoint2 = await tokenDAO.checkpoints(account1.address, 2);
            expect(checkpoint2.fromBlock).to.equal(t3.blockNumber);
            expect(checkpoint2.votes.toString()).to.equal('80');

            const checkpoint3 = await tokenDAO.checkpoints(account1.address, 3);
            expect(checkpoint3.fromBlock).to.equal(t4.blockNumber);
            expect(checkpoint3.votes.toString()).to.equal('100');
        });
        it("does not add more than one checkpoint in a block", async () => {
            await tokenDAO.transfer(account2.address, 100);

            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(0);

            await minerStop()
            const tx1 = await tokenCallFromGuy.delegate(account1.address);
            const tx2 = await tokenCallFromGuy.transfer(account3.address, 10);
            const tx3 = await tokenCallFromGuy.transfer(account3.address, 10);

            await mineBlock()
            const receipt1 = await tx1.wait();
            await tx2.wait()
            await tx3.wait()

            await minerStart()

            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(1);

            const checkpoint0 = await tokenDAO.checkpoints(account1.address, 0);
            expect(checkpoint0.fromBlock).to.equal(receipt1.blockNumber);
            expect(checkpoint0.votes.toString()).to.equal('80')

            let checkpoint1 = await tokenDAO.checkpoints(account1.address, 1);
            expect(checkpoint1.fromBlock).to.equal(0);
            expect(checkpoint1.votes.toString()).to.equal('0')

            const checkpoint2 = await tokenDAO.checkpoints(account1.address, 2);
            expect(checkpoint2.fromBlock).to.equal(0);
            expect(checkpoint2.votes.toString()).to.equal('0')

            const tx4 = await tokenCallFromDeployer.transferFrom(deployer.address, account2.address, 20);
            expect(await tokenDAO.numCheckpoints(account1.address)).to.equal(2);

            checkpoint1 = await tokenDAO.checkpoints(account1.address, 1);
            expect(checkpoint1.fromBlock).to.equal(tx4.blockNumber);
            expect(checkpoint1.votes.toString()).to.equal('100')
        })

    });
    describe('getCurrentVotes',() =>{
      it('should return the current votes balance for an account', async () =>{    
        // Transfer tokens from owner to recipient
        await tokenDAO.transfer(account2.address, 10);
        expect(await tokenDAO.getCurrentVotes(account2.address)).to.equal(0)
        await tokenDAO.connect(account2).delegate(account2.address)
        const result = await tokenDAO.getCurrentVotes(account2.address)
        console.log(result)
        expect(await tokenDAO.getCurrentVotes(account2.address)).to.equal(10)
      })  
    })
    describe('getPriorVotes', () => {
        it('reverts if block number >= current block', async () => {
          await expect(tokenDAO.getPriorVotes(account1.address, 5e10)).to.be.revertedWith(
            'DAO Token::getPriorVotes: not yet determined',
          );
        });
    
        it('returns 0 if there are no checkpoints', async () => {
          expect(await tokenDAO.getPriorVotes(account1.address, 0)).to.equal(0);
        });
    
        it('returns the latest block if >= last checkpoint block', async () => {
          const t1 = await (await tokenCallFromDeployer.delegate(account1.address)).wait();
          await mineBlock();
          await mineBlock();
    
          expect(await tokenDAO.getPriorVotes(account1.address, t1.blockNumber)).to.equal('10000000000000000000000000');
          expect(await tokenDAO.getPriorVotes(account1.address, t1.blockNumber + 1)).to.equal('10000000000000000000000000');
        });
    
        it('returns zero if < first checkpoint block', async () => {
          await mineBlock();
          const t1 = await (await tokenCallFromDeployer.delegate(account1.address)).wait();
          await mineBlock();
          await mineBlock();
    
          expect(await tokenDAO.getPriorVotes(account1.address, t1.blockNumber - 1)).to.equal(0);
          expect(await tokenDAO.getPriorVotes(account1.address, t1.blockNumber + 1)).to.equal('10000000000000000000000000');
        });
    
        it('generally returns the voting balance at the appropriate checkpoint', async () => {
          const t1 = await (await tokenCallFromDeployer.delegate(account1.address)).wait();
          await mineBlock();
          await mineBlock();
    
          // deployer -> account2.address id 1
          const t2 = await (
            await tokenCallFromDeployer.transfer( account2.address, 10)
          ).wait();
          await mineBlock();
          await mineBlock();
    
          // deployer -> account2.address id 2
          const t3 = await (
            await tokenCallFromDeployer.transferFrom(deployer.address, account2.address, 10)
          ).wait();
          await mineBlock();
          await mineBlock();
    
          // account2.address -> deployer id 1
          const t4 = await (
            await tokenCallFromGuy.transferFrom(account2.address, deployer.address, 20)
          ).wait();
          await mineBlock();
          await mineBlock();
    
          expect(await tokenDAO.getPriorVotes(account1.address, t1.blockNumber - 1)).to.equal(0);
          expect(await tokenDAO.getPriorVotes(account1.address, t1.blockNumber)).to.equal('10000000000000000000000000');
          expect(await tokenDAO.getPriorVotes(account1.address, t1.blockNumber + 1)).to.equal('10000000000000000000000000');
          expect(await tokenDAO.getPriorVotes(account1.address, t2.blockNumber)).to.equal('9999999999999999999999990');
          expect(await tokenDAO.getPriorVotes(account1.address, t2.blockNumber + 1)).to.equal('9999999999999999999999990');
          expect(await tokenDAO.getPriorVotes(account1.address, t3.blockNumber)).to.equal('9999999999999999999999980');
          expect(await tokenDAO.getPriorVotes(account1.address, t3.blockNumber + 1)).to.equal('9999999999999999999999980');
          expect(await tokenDAO.getPriorVotes(account1.address, t4.blockNumber)).to.equal('10000000000000000000000000');
          expect(await tokenDAO.getPriorVotes(account1.address, t4.blockNumber + 1)).to.equal('10000000000000000000000000');
        });
    });

});