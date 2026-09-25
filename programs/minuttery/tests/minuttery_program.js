"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const web3_js_1 = require("@solana/web3.js");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
// Node 24 can load this ESM package from the CommonJS test runner.
const { SecretKey } = require("@blueshift-gg/solana-ecvrf");
const LAMPORTS_PER_SOL = 1000000000;
const ROOM_TIER_01 = 0;
const ROOM_TIER_02 = 1;
const TIER_AMOUNTS = [100000000, 200000000];
const BET_AMOUNT = TIER_AMOUNTS[ROOM_TIER_01];
const ROOM_TIER = ROOM_TIER_01;
const SETTLE_GRACE_SEC = 30;
const ECVRF_KEYPAIR_PATH = (0, node_path_1.resolve)((_a = process.env.ECVRF_KEYPAIR_PATH) !== null && _a !== void 0 ? _a : ".solana/ecvrf-test-keypair.json");
function print(label, value) {
    if (value === undefined) {
        console.log(`\n[MINUTTERY] ${label}`);
        return;
    }
    console.log(`[MINUTTERY] ${label}`, value);
}
function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function i64Bytes(value) {
    const bytes = Buffer.alloc(8);
    bytes.writeBigInt64LE(BigInt(value));
    return bytes;
}
function loadOrCreateOperator() {
    (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(ECVRF_KEYPAIR_PATH), { recursive: true });
    if (!(0, node_fs_1.existsSync)(ECVRF_KEYPAIR_PATH)) {
        const keypair = web3_js_1.Keypair.generate();
        (0, node_fs_1.writeFileSync)(ECVRF_KEYPAIR_PATH, JSON.stringify(Array.from(keypair.secretKey), null, 2));
        print(`Keypair ECVRF local creada: ${ECVRF_KEYPAIR_PATH}`);
    }
    return SecretKey.fromKeypair(JSON.parse((0, node_fs_1.readFileSync)(ECVRF_KEYPAIR_PATH, "utf8")));
}
function waitForBettingWindow(provider) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        for (;;) {
            const slot = yield provider.connection.getSlot("confirmed");
            const timestamp = (_a = (yield provider.connection.getBlockTime(slot))) !== null && _a !== void 0 ? _a : Math.floor(Date.now() / 1000);
            const second = timestamp % 60;
            if (second < 35)
                return { roundId: Math.floor(timestamp / 60), timestamp };
            print(`Esperando el siguiente minuto. Segundo actual: ${second}`);
            yield sleep(2000);
        }
    });
}
describe("minuttery devnet end-to-end", function () {
    this.timeout(180000);
    anchor.setProvider(anchor.AnchorProvider.env());
    const provider = anchor.getProvider();
    const program = anchor.workspace.minuttery;
    const payer = provider.wallet.publicKey;
    const operator = loadOrCreateOperator();
    it("inicializa, apuesta, genera ECVRF y liquida", () => __awaiter(this, void 0, void 0, function* () {
        print("Inicio del test en devnet");
        print("Program ID", program.programId.toBase58());
        print("Wallet pagadora", payer.toBase58());
        print("Operador ECVRF", operator.publicKey.toString());
        const [config] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
        print("Config PDA", config.toBase58());
        const configInfo = yield program.account.config.fetchNullable(config);
        if (!configInfo) {
            print("Config no existe. Ejecutando initialize()");
            const signature = yield program.methods
                .initialize(Array.from(operator.publicKey.bytes), payer)
                .accountsPartial({ authority: payer, config, systemProgram: web3_js_1.SystemProgram.programId })
                .rpc();
            print("initialize() confirmado", signature);
        }
        else {
            print("Config ya existe; verificando operador y house", configInfo);
            if (Buffer.from(configInfo.operator).compare(Buffer.from(operator.publicKey.bytes)) !== 0) {
                throw new Error(`La config usa otro operador. Keypair esperada: ${ECVRF_KEYPAIR_PATH}`);
            }
            if (!configInfo.house.equals(payer))
                throw new Error("La config usa otra house");
        }
        const players = [web3_js_1.Keypair.generate(), web3_js_1.Keypair.generate(), web3_js_1.Keypair.generate()];
        print("Jugadores temporales", players.map((player) => player.publicKey.toBase58()));
        const fundingSignature = yield provider.sendAndConfirm(new web3_js_1.Transaction().add(...players.map((player) => web3_js_1.SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: player.publicKey,
            lamports: 500000000,
        }))));
        print("Jugadores financiados", fundingSignature);
        const { roundId, timestamp } = yield waitForBettingWindow(provider);
        const roundDefinitions = [
            { tier: ROOM_TIER_01, amount: TIER_AMOUNTS[ROOM_TIER_01], firstPlayer: payer, firstSigner: undefined, secondPlayer: players[0] },
            { tier: ROOM_TIER_02, amount: TIER_AMOUNTS[ROOM_TIER_02], firstPlayer: players[1].publicKey, firstSigner: players[1], secondPlayer: players[2] },
        ];
        const rounds = roundDefinitions.map(({ tier }) => web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("round"), Buffer.from([tier]), i64Bytes(roundId)], program.programId)[0]);
        print("Rondas seleccionadas en el mismo minuto", {
            roundId,
            timestamp,
            rounds: roundDefinitions.map(({ tier, amount }, index) => ({
                tier,
                amount,
                round: rounds[index].toBase58(),
            })),
        });
        for (const [index, definition] of roundDefinitions.entries()) {
            const { tier, amount, firstPlayer, firstSigner, secondPlayer } = definition;
            const round = rounds[index];
            print(`Tier ${tier}: enviando primera apuesta`, { amount, player: firstPlayer.toBase58() });
            const firstBetSignature = yield program.methods
                .placeBet(new anchor.BN(roundId), tier, new anchor.BN(amount))
                .accountsPartial({ player: firstPlayer, round, systemProgram: web3_js_1.SystemProgram.programId })
                .signers(firstSigner ? [firstSigner] : [])
                .rpc();
            print(`Tier ${tier}: primera apuesta confirmada`, firstBetSignature);
            print(`Tier ${tier}: enviando segunda apuesta`, { amount, player: secondPlayer.publicKey.toBase58() });
            const secondBetSignature = yield program.methods
                .placeBet(new anchor.BN(roundId), tier, new anchor.BN(amount))
                .accountsPartial({ player: secondPlayer.publicKey, round, systemProgram: web3_js_1.SystemProgram.programId })
                .signers([secondPlayer])
                .rpc();
            print(`Tier ${tier}: segunda apuesta confirmada`, secondBetSignature);
            print(`Tier ${tier}: estado`, yield program.account.roundState.fetch(round));
            print(`Tier ${tier}: balance`, `${(yield provider.connection.getBalance(round)) / LAMPORTS_PER_SOL} SOL`);
        }
        const settleAt = roundId * 60 + 55;
        while (Math.floor(Date.now() / 1000) < settleAt) {
            const secondsLeft = settleAt - Math.floor(Date.now() / 1000);
            print(`Esperando liquidación. Faltan ${secondsLeft}s`);
            yield sleep(3000);
        }
        print("Apuestas cerradas; esperando que el worker liquide ambas rondas", roundId);
        const workerDeadline = settleAt + SETTLE_GRACE_SEC;
        const resolvedRounds = new Set();
        while (Math.floor(Date.now() / 1000) < workerDeadline) {
            for (const [index, round] of rounds.entries()) {
                const key = round.toBase58();
                if (resolvedRounds.has(key))
                    continue;
                const currentRound = yield program.account.roundState.fetchNullable(round);
                // LiquidateRound closes the account; RoundState only stores n and players.
                if (currentRound === null) {
                    resolvedRounds.add(key);
                    print(`Tier ${roundDefinitions[index].tier}: worker cerró la cuenta`);
                }
            }
            if (resolvedRounds.size === rounds.length)
                break;
            print(`Esperando liquidación del worker: ${resolvedRounds.size}/${rounds.length}`);
            yield sleep(3000);
        }
        if (resolvedRounds.size !== rounds.length) {
            throw new Error(`El worker liquidó ${resolvedRounds.size}/${rounds.length} rondas dentro de la ventana permitida`);
        }
        print("Balances finales", {
            payer: `${(yield provider.connection.getBalance(payer)) / LAMPORTS_PER_SOL} SOL`,
            players: yield Promise.all(players.map((player) => __awaiter(this, void 0, void 0, function* () {
                return ({
                    wallet: player.publicKey.toBase58(),
                    balance: `${(yield provider.connection.getBalance(player.publicKey)) / LAMPORTS_PER_SOL} SOL`,
                });
            }))),
        });
        print("Test E2E de dos rondas completado correctamente");
    }));
});
