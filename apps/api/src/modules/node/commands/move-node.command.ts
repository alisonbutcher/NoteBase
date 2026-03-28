export class MoveNodeCommand {
  constructor(
    public readonly userId: string,
    public readonly nodeId: string,
    public readonly newParentId: string | null,
    public readonly newPosition: number,
  ) {}
}
