// import chai from 'chai';
// import hardhat from 'hardhat';

// const { ethers } = hardhat;

// import {  Contract } from 'ethers';

// import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// const { expect } = chai;

// let exampleDAOExecutor;
// let timelock: Contract;
// let contractDAO;
// let exampleDAOContract: Contract;
// let token;
// let tokenDAO: Contract;
// let deployer: SignerWithAddress;
// let account0: SignerWithAddress;
// let account1: SignerWithAddress;
// let account2: SignerWithAddress;
// let account3: SignerWithAddress;

// let vetoer: string = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


// const votingDelay = 1;
// const votingPeriod = 17280; //3 days
// const proposalThresholdBPS = 900; // 9%
// const quorumVotesBPS = 1000; // 10%
// describe('DAOExampleExecutor#admin', () => {


//   before(async () => {

//     [deployer, account0, account1, account2, account3] = await ethers.getSigners();
//     exampleDAOExecutor = await ethers.getContractFactory("DAOExampleExecutor");
//     timelock = await exampleDAOExecutor.deploy(account1.address, 2 * 86400)

//     token = await ethers.getContractFactory("DAOToken");
//     tokenDAO = await token.deploy(deployer.address)
//     await tokenDAO.delegate(deployer.address)

//     contractDAO = await ethers.getContractFactory("DAOExampleLogicV1")
//     exampleDAOContract = await contractDAO.deploy()
//     // await timelock.harnessSetAdmin(exampleDAOContract.address)

//     await exampleDAOContract.initialize(
//       timelock.address,
//       tokenDAO.address,
//       vetoer,
//       votingPeriod,
//       votingDelay,
//       proposalThresholdBPS,
//       quorumVotesBPS,
//     );

//   })
//   it('should set the admin', async () => {
//     // Get the current admin
//     const currentAdmin = await timelock.admin()
//     console.log(currentAdmin)

//     // Set a new pending admin
//     await timelock.connect(currentAdmin).setPendingAdmin(account2.address)

//     // Get the new pending admin
//     const newPendingAdmin = await timelock.pendingAdmin()
//     console.log(newPendingAdmin)

//     // Accept the admin role
//     await timelock.acceptAdmin({ from: newPendingAdmin })

//     // Get the updated admin
//     const updatedAdmin = await timelock.admin();

//     // Check if the admin has been successfully updated
//     expect(updatedAdmin).to.equal(account2.address);
//   });
// })