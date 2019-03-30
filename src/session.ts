import {
  ADDRESS_ZERO,
  SESSION_STATUS,
  CHANNEL_STATUS,
} from './utils/constants';
import {
  appSession,
  appPN,
  ethPN,
  web3_10,
  user,
  puppet,
  web3_outer,
  cita,
  cp,
} from './main';
import { myEcsignToHex, prepareSignatureForTransfer } from './utils/common';
import { getAppTxOption } from './service/cita';
import * as protobuf from 'protobufjs';
protobuf.common('google/protobuf/descriptor.proto', {});

/**
 * Session manager
 */
export default class L2Session {
  /**-----------------Public Attributes------------------------ */
  sessionID: string;
  status: SESSION_STATUS;
  //   players: Array<string>;
  game: string;
  data: string;
  provider: string;

  callbacks: Map<string, (err: Error, res: any) => void>;

  /**-----------------Static Attributes & APIs------------------------ */
  static sessionList: Map<string, L2Session> = new Map<string, L2Session>();

  /**
   * get session by session id
   *
   * @param {} _sessionID
   * @param {} fromChain  OPTIONAL load session from cita chain. default: true
   *
   * @returns {Promise<L2Session}
   */
  static async getSessionById(
    _sessionID: string,
    fromChain: boolean = true
  ): Promise<L2Session> {
    let session = L2Session.sessionList.get(_sessionID);
    if (!session) {
      let sessionExist = await L2Session.isExists(_sessionID);
      if (!sessionExist) {
        return null;
      }

      session = new L2Session(_sessionID);
      await session.initialize();
      L2Session.sessionList.set(_sessionID, session);
    }
    return session;
  }

  /**
   * check session is initialized on appchain
   *
   * @param {string} _sessionID
   *
   * @returns {Promise<boolean>}
   */
  static async isExists(_sessionID: string): Promise<boolean> {
    let session = await appSession.methods.sessions(_sessionID).call();
    if (Number(session.status) === SESSION_STATUS.SESSION_STATUS_INIT) {
      return false;
    }

    return true;
  }

  /**
   * get all messages of the session
   *
   * @param {string} _sessionID
   *
   * @returns {Promise<Array<any>>}
   */
  static async getMessagesBySessionID(_sessionID: string): Promise<Array<any>> {
    // let messages = await appSession.methods.messages(_sessionID).call();
    let messages = await appSession.methods.exportSession(_sessionID).call();
    console.log('session message is ', messages);
    return messages;
  }

  /**
   * get all players join in the session
   *
   * @param {string} _sessionID
   *
   * @returns {Promise<Array<string>>}
   */
  static async getPlayersBySessionID(
    _sessionID: string
  ): Promise<Array<string>> {
    let players = await appSession.methods.players(_sessionID).call();
    console.log('session players is ', players);
    return [];
  }

  /**-----------------Private Constructor------------------------ */

  /**
   * constructor of L2Session
   *
   * @param {string} _sessionID
   * @param {Contract} _sessionContract
   */
  private constructor(_sessionID: string) {
    this.sessionID = _sessionID;
  }

  /**
   * initialize L2Session, using session from appchain contract
   */
  private async initialize() {
    // query session by _sessionPN
    let {
      status,
      provider,
      game,
      paymentContract,
      data,
    } = await appSession.methods.sessions(this.sessionID).call();
    this.status = Number(status);
    this.game = game;
    this.data = data;
    this.provider = provider;

    this.callbacks = this.callbacks || new Map<string, () => void>();
  }

  /**-----------------Session APIs------------------------ */

  /**
   * send message to the session contract
   *
   * @param {string} to the destination of the message
   * @param {number} type the type of message encoding
   * @param {string} content encoded message content
   * @param {string} amount token amount transferred to other player
   * @param {string} token token address, default: '0x0000000000000000000000000000000000000000'
   *
   * @returns {Promise<string>} the tx hash of the sendMessage transaction
   */
  async sendMessage(
    to: string,
    type: number,
    content: string,
    amount: string = '0',
    token: string = ADDRESS_ZERO
  ): Promise<string> {
    // check session status
    let { status } = await appSession.methods.sessions(this.sessionID).call();
    if (Number(status) !== SESSION_STATUS.SESSION_STATUS_OPEN) {
      throw new Error('session is not open');
    }

    // build session message
    let from = user;

    // type = 1;

    let messageHash = web3_10.utils.soliditySha3(
      { t: 'address', v: from },
      { t: 'address', v: to },
      { t: 'bytes32', v: this.sessionID },
      { t: 'uint8', v: type },
      { t: 'bytes', v: content }
    );
    let signature = myEcsignToHex(
      web3_10,
      messageHash,
      puppet.getAccount().privateKey
    );

    let { transferData, paymentSignature } = await this.buildTransferData(
      from,
      amount,
      token,
      messageHash
    );
    // call appSession's sendMessage
    let tx = await getAppTxOption();
    let res = await appSession.methods
      .sendMessage(
        from,
        to,
        this.sessionID,
        type,
        content,
        signature,
        transferData,
        paymentSignature
      )
      .send(tx);

    if (res.hash) {
      let receipt = await cita.listeners.listenToTransactionReceipt(res.hash);
      if (receipt.errorMessage) {
        throw new Error(receipt.errorMessage);
      } else {
        console.log('submit sendMessage success');
        return res.hash;
      }
    } else {
      throw new Error('submit sendMessage failed');
    }
  }

  /**
   *
   * @param callback
   *
   */
  async onMessage(callback: (error: Error, res: any) => void) {
    this.callbacks.set('message', callback);
  }

  /**
   *
   * @param callback
   */
  async onSessionClose(callback: (error: Error, res: any) => void) {
    this.callbacks.set('close', callback);
  }

  private async buildTransferData(
    from: string,
    amount: string,
    token: string,
    messageHash: string
  ): Promise<any> {
    let { hexToBytes, numberToHex, soliditySha3 } = web3_10.utils;
    let channelID =
      '0x0000000000000000000000000000000000000000000000000000000000000000';
    let balance = '0';
    let nonce = '0';
    let additionalHash =
      '0x0000000000000000000000000000000000000000000000000000000000000000';
    let paymentSignature = '0x0';
    if (Number(amount) > 0) {
      channelID = await ethPN.methods.getChannelID(from, token).call();
      let channel = await appPN.methods.channelMap(channelID).call();

      // check channel status
      if (Number(channel.status) !== CHANNEL_STATUS.CHANNEL_STATUS_OPEN) {
        throw new Error('app channel status is not open, can not transfer now');
      }
      // check user's balance is enough
      if (
        web3_10.utils.toBN(channel.userBalance).lt(web3_10.utils.toBN(amount))
      ) {
        throw new Error("user's balance is less than transfer amount");
      }

      // build transfer message
      // get balance proof from eth contract
      let balanceProof = await appPN.methods
        .balanceProofMap(channelID, cp)
        .call();

      balance = web3_10.utils
        .toBN(amount)
        .add(web3_10.utils.toBN(balanceProof.balance))
        .toString();
      nonce = web3_10.utils
        .toBN(balanceProof.nonce)
        .add(web3_10.utils.toBN(1))
        .toString();
      additionalHash = soliditySha3(
        { t: 'bytes32', v: messageHash },
        { t: 'uint256', v: amount }
      );

      paymentSignature = await prepareSignatureForTransfer(
        web3_outer,
        ethPN.options.address,
        channelID,
        balance,
        nonce,
        additionalHash,
        user
      );
    }

    let transferPB = protobuf.Root.fromJSON(require('./config/transfer.json'));

    // Obtain a message type
    let Transfer = transferPB.lookupType('TransferData.Transfer');

    // Exemplary payload
    let payload = {
      channelID: hexToBytes(channelID),
      balance: hexToBytes(numberToHex(balance)),
      nonce: hexToBytes(numberToHex(nonce)),
      amount: hexToBytes(numberToHex(amount)),
      // balance: [0],
      // nonce: [0],
      // amount: [0],
      additionalHash: hexToBytes(additionalHash),
    };

    console.log('payload', payload);
    // Verify the payload if necessary (i.e. when possibly incomplete or invalid)
    let errMsg = Transfer.verify(payload);
    if (errMsg) throw Error(errMsg);
    // Create a new message
    let message = Transfer.create(payload); // or use .fromObject if conversion is necessary
    // Encode a message to an Uint8Array (browser) or Buffer (node)
    let buffer = Transfer.encode(message).finish();
    console.log('buildTransferData', {
      transferData: buffer,
      paymentSignature,
    });

    return { transferData: buffer, paymentSignature };
  }
}
