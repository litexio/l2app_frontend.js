import { AbiItem } from 'web3/node_modules/web3-utils';
export declare type SOL_TYPE = 'address' | 'uint256' | 'bytes32' | 'bytes';
export declare const CITA_SYNC_EVENT_TIMEOUT = 15;
export declare const ETH_MESSAGE_COMMIT_BLOCK_EXPERITION = 250;
export declare const CITA_TX_COMMIT_BLOCK_EXPERITION = 88;
export declare const CITA_TX_BLOCK_INTERVAL = 1000;
export declare const SETTLE_WINDOW = 5;
export declare const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export declare enum PUPPET_STATUS {
    NULL = 0,
    ENABLED = 1,
    DISABLED = 2
}
export declare enum CHANNEL_STATUS {
    CHANNEL_STATUS_INIT = 0,
    CHANNEL_STATUS_OPEN = 1,
    CHANNEL_STATUS_CLOSE = 2,
    CHANNEL_STATUS_SETTLE = 3,
    CHANNEL_STATUS_PENDING_CO_SETTLE = 4
}
export declare enum SESSION_STATUS {
    SESSION_STATUS_INIT = 0,
    SESSION_STATUS_OPEN = 1,
    SESSION_STATUS_CLOSE = 2
}
export declare type L2_EVENT = 'Deposit' | 'Withdraw' | 'ForceWithdraw' | 'Transfer' | 'PuppetChanged';
export declare type DEPOSIT_EVENT = {
    user: string;
    type: number;
    token: string;
    amount: string;
    totalDeposit: string;
    txhash: string;
};
export declare type WITHDRAW_EVENT = {
    user: string;
    type: number;
    token: string;
    amount: string;
    totalWithdraw: string;
    txhash: string;
};
export declare type FORCEWITHDRAW_EVENT = {
    closer: string;
    token: string;
    userSettleAmount: string;
    providerSettleAmount: string;
    txhash: string;
};
export declare type TRANSFER_EVENT = {
    from: string;
    to: string;
    token: string;
    amount: string;
    additionalHash: string;
    totalTransferredAmount: string;
};
export declare type PUPPETCHANGED_EVENT = {
    user: string;
    puppet: string;
    type: number;
};
export declare type L2_CB = (err: any, res: DEPOSIT_EVENT | WITHDRAW_EVENT | FORCEWITHDRAW_EVENT | TRANSFER_EVENT | PUPPETCHANGED_EVENT) => void;
export declare type ContractInfo = {
    address: string;
    abi: AbiItem[] | AbiItem;
};
