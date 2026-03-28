export class DeleteNodeCommand {
  constructor(
    public readonly userId: string,
    public readonly nodeId: string,
  ) {}
}
