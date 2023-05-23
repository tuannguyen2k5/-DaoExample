// SPDX-License-Identifier: BSD-3-Clause

pragma solidity ^0.8.6;
import '../DAOExampleExecutor.sol';
contract DAOExampleExecutorHarness is DAOExampleExecutor {
    constructor(address admin_, uint delay_)
        DAOExampleExecutor(admin_, delay_) {
    }

    function harnessSetPendingAdmin(address pendingAdmin_) public {
        pendingAdmin = pendingAdmin_;
    }

    function harnessSetAdmin(address admin_) public {
        admin = admin_;
    }
}
