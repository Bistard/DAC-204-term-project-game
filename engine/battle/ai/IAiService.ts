export interface IAiService {
    queueTurn(): void;
    cancelProcessing(): void;
}
