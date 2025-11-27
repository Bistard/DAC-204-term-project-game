import { describe, expect, it } from 'vitest';
import { GamePhase, MetaState } from '@/common/types';
import { GameStore } from '@/engine/state/gameStore';
import { createInitialGameState } from '@/engine/state/gameState';

const createMetaState = (): MetaState => ({
    gold: 0,
    upgrades: { hpLevel: 0, inventoryLevel: 0 },
});

describe('GameStore layered updates', () => {
    it('updateRunState writes only run fields', () => {
        const store = new GameStore(createInitialGameState(createMetaState()));
        store.updateRunState(run => ({ ...run, message: 'Ready', runLevel: 2 }));
        const snapshot = store.snapshot.state;
        expect(snapshot.message).toBe('Ready');
        expect(snapshot.runLevel).toBe(2);
        expect(snapshot.roundCount).toBe(0);
    });

    it('updateBattleState mutates combat data without touching run state', () => {
        const store = new GameStore(createInitialGameState(createMetaState()));
        store.updateBattleState(battle => {
            battle.roundCount = 3;
            battle.player.hp = 7;
            return battle;
        });
        const snapshot = store.snapshot.state;
        expect(snapshot.roundCount).toBe(3);
        expect(snapshot.player.hp).toBe(7);
        expect(snapshot.phase).toBe(GamePhase.MENU);
    });

    it('updateRoundState toggles round flags safely', () => {
        const store = new GameStore(createInitialGameState(createMetaState()));
        store.updateRoundState(round => ({
            ...round,
            playerStood: true,
            turnOwner: 'ENEMY',
        }));
        const snapshot = store.snapshot.state;
        expect(snapshot.playerStood).toBe(true);
        expect(snapshot.turnOwner).toBe('ENEMY');
        expect(snapshot.enemyStood).toBe(false);
    });
});
