// // SPDX-License-Identifier: BSD-3-Clause

pragma solidity ^0.8.6;
import "hardhat/console.sol";

contract DAOExampleExecutor {
    uint256 public constant GRACE_PERIOD = 14 days;
    uint256 public constant MINIMUM_DELAY = 2 days;
    uint256 public constant MAXIMUM_DELAY = 30 days;
    address public admin;
    address public pendingAdmin;
    uint256 public delay;

    mapping(bytes32 => bool) public queuedTransactions;
    event NewAdmin(address indexed newAdmin);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event CancelTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );
    event ExecuteTransaction(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    constructor(address admin_, uint256 delay_) {
        require(
            delay_ >= MINIMUM_DELAY,
            "NounsDAOExecutor::constructor: Delay must exceed minimum delay."
        );
        require(
            delay_ <= MAXIMUM_DELAY,
            "NounsDAOExecutor::setDelay: Delay must not exceed maximum delay."
        );

        admin = admin_;
        delay = delay_;
    }
    function setDelay(uint256 delay_) public {
        require(msg.sender == address(this), 'DAOExampleExecutor::setDelay: Call must come from DAOExampleExecutor.');
        require(delay_ >= MINIMUM_DELAY, 'DAOExampleExecutor::setDelay: Delay must exceed minimum delay.');
        require(delay_ <= MAXIMUM_DELAY, 'DAOExampleExecutor::setDelay: Delay must not exceed maximum delay.');
        delay = delay_;
    }

    function acceptAdmin() public {
        require(
            msg.sender == pendingAdmin,
            "NounsDAOExecutor::acceptAdmin: Call must come from pendingAdmin."
        );
        admin = msg.sender;
        emit NewAdmin(admin);
    }

    function setPendingAdmin(address pendingAdmin_) public {
        require(
            msg.sender == address(this),
            "NounsDAOExecutor::setPendingAdmin: Call must come from NounsDAOExecutor."
        );
        pendingAdmin = pendingAdmin_;

        emit NewPendingAdmin(pendingAdmin);
    }

    function queueTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public returns (bytes32) {
        require(
            msg.sender == admin,
            "NounsDAOExecutor::queueTransaction: Call must come from admin."
        );
        require(
            eta >= getBlockTimestamp() + delay,
            "NounsDAOExecutor::queueTransaction: Estimated execution block must satisfy delay."
        );

        bytes32 txHash = keccak256(
            abi.encode(target, value, signature, data, eta)
        );
        queuedTransactions[txHash] = true;

        return txHash;
    }

     function cancelTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public {
        require(msg.sender == admin, 'DAOExampleExecutor::cancelTransaction: Call must come from admin.');

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, signature, data, eta);
    }

    function executeTransaction(
        address target,
        uint256 value,
        string memory signature,
        bytes memory data,
        uint256 eta
    ) public returns (bytes memory) {
        require(msg.sender == admin, 'DAOExampleExecutor::executeTransaction: Call must come from admin.');

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "DAOExampleExecutor::executeTransaction: Transaction hasn't been queued.");
        require(
            getBlockTimestamp() >= eta,
            "DAOExampleExecutor::executeTransaction: Transaction hasn't surpassed time lock."
        );
        require(
            getBlockTimestamp() <= eta + GRACE_PERIOD,
            'DAOExampleExecutor::executeTransaction: Transaction is stale.'
        );

        queuedTransactions[txHash] = false;

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solium-disable-next-line security/no-call-value
        (bool success, bytes memory returnData) = target.call{ value: value }(callData);
        require(success, 'DAOExampleExecutor::executeTransaction: Transaction execution reverted.');

        emit ExecuteTransaction(txHash, target, value, signature, data, eta);

        return returnData;
    }

    function getBlockTimestamp() internal view returns (uint256) {
        return block.timestamp;
    }

    receive() external payable {}

    fallback() external payable {}
}
